"use client";

// Robot Collector scene: feeds input + dt into rules.ts every frame and draws the result.
// Game logic lives in rules.ts (pure, tested); the warehouse look lives in Primitives.tsx.
// This file is the part to copy for a new game:
// - Run state is a plain object created once per run (GameShell remounts Scene for every run).
//   The frame loop mutates it; nothing in the loop calls setState or allocates.
// - useRunFrame changes the game: only while "playing", dt = the play time the run clock counted,
//   and it runs before every useFrame (core FRAME_PRIORITY), so visuals draw this frame's state
//   wherever they are mounted.
// - Visuals (useFrame) only read the run state and animate with useGameTime() (it stops while
//   paused), never with state.clock.elapsedTime (GameShell's pause resets it).
// - The store is the only way out: addScore / setStat / end(reason). GameShell does the rest.
// - Camera: useFittedView keeps the warehouse on screen and clear of the HUD, the touch controls
//   and the cookie banner (moving the picture with a lens shift when it must); followFocus ties
//   its follow range to CameraRig's; inputToWorld turns input with the yaw.
// - Models: <Model asset fallback={…}> draws the GLB once it is in core/modelManifest.ts and this
//   game's own primitive until then. The robot is a static T-pose GLB: <HumanoidModel> (core/rig)
//   rigs it in code and useHumanoidPose drives its limbs (idle, walk/run by speed, a cheer on a win).
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import {
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   bodyLift,
   cheerPose,
   createPose,
   idlePose,
   useHumanoidPose,
   walkPose,
   walkStride,
   wrapPhase,
} from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { followFocus } from "@/arcade3d/core/view";
import { ASSETS } from "./assets";
import { BatteryPrimitive, COLORS, RobotPrimitive, WALL, Warehouse, useBatteryParts } from "./Primitives";
import {
   ARENA,
   BATTERY_COUNT,
   BATTERY_POINTS,
   ROBOT,
   capScore,
   collectTouched,
   createProgress,
   createRobot,
   generateLayout,
   isActive,
   isComplete,
   runScore,
   stepRobot,
   type Layout,
   type Progress,
   type RobotState,
} from "./rules";

// ---------- camera ----------

/** Camera tilt above the floor: a three-quarter top-down view. */
const PITCH = (56 * Math.PI) / 180;
/** Where the camera looks while the robot is on its start pad: the warehouse centre. */
const LOOK_AT: [number, number, number] = [0, 0, 0];
/** The camera looks this fraction of the way from LOOK_AT towards the robot (CameraRig followFraction). */
const FOLLOW = 0.12;
/** Everywhere the robot can drive. */
const FLOOR: AABB = { min: { x: -ARENA.halfX, y: 0, z: -ARENA.halfZ }, max: { x: ARENA.halfX, y: 0, z: ARENA.halfZ } };
/** The whole warehouse, walls included, stays on screen... */
const WAREHOUSE: AABB = {
   min: { x: -(ARENA.halfX + WALL.thickness), y: 0, z: -(ARENA.halfZ + WALL.thickness) },
   max: { x: ARENA.halfX + WALL.thickness, y: WALL.height, z: ARENA.halfZ + WALL.thickness },
};
/**
 * ...from every point the follow camera can look at (followFocus, with the same LOOK_AT and FOLLOW
 * as the CameraRig below), inside the screen margins (room for the HUD on top) and 8 px clear of
 * the HUD, the touch controls and the cookie banner. `shift` lets the picture move on screen, so
 * the warehouse sits above a joystick the banner lifts instead of shrinking. Landscape screens
 * look across the long side; a portrait phone turns the camera a quarter turn so the 24-unit side
 * runs up the screen.
 */
const VIEW: FittedViewOptions = {
   area: WAREHOUSE,
   pitch: PITCH,
   yaws: [0, Math.PI / 2],
   focus: followFocus({ lookAt: LOOK_AT, reach: FLOOR, fraction: FOLLOW }),
   margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
};

// ---------- run state ----------

interface RunData {
   robot: RobotState;
   progress: Progress;
   /** scratch for inputToWorld (no allocation per frame) */
   dir: { x: number; z: number };
}

// ---------- the robot ----------

/** The robot GLB's joints (core/sharedAssets) and its scale here: its stride and its height over its feet. */
const LEGS = ROBOT_LANDMARKS;
const SCALE = ASSETS.robot.scale ?? 1;
/** The phase never advances by more than a stride this short (m): standing still, the stride is 0. */
const MIN_STRIDE = 0.1;

/** The walk cycle (looks only): phase from the distance walked, amount eased towards the speed. */
interface Gait {
   phase: number;
   amount: number;
   cheer: number;
   /** the body's height over its planted foot this frame (m): core/rig bodyLift x SCALE */
   lift: number;
}

function Robot({ run }: { run: RunData }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const rig = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const antenna = useRef<Group>(null);
   const panel = useRef<MeshStandardMaterial>(null);
   const [gait] = useState<Gait>(() => ({ phase: 0, amount: 0, cheer: 0, lift: 0 }));
   const [scratch] = useState(createPose);

   // the GLB robot's limbs (core/rig): idle -> walk -> run with its speed, arms up on a win. The
   // phase advances by the distance driven over the walk's own stride, so the planted foot stays put.
   // FRAME_PRIORITY.pose: after useRunFrame moved the robot, before the useFrame below reads the lift.
   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase, endReason } = useArcadeStore.getState();
      const v = phase === "playing" ? Math.hypot(run.robot.vx, run.robot.vz) : 0;
      gait.amount += (Math.min(1, v / ROBOT.maxSpeed) - gait.amount) * (1 - Math.exp(-12 * dt));
      const stride = Math.max(MIN_STRIDE, walkStride(gait.amount, LEGS) * SCALE);
      gait.phase = wrapPhase(gait.phase + ((v * dt) / stride) * Math.PI * 2);
      gait.cheer += ((phase === "over" && endReason === "win" ? 1 : 0) - gait.cheer) * (1 - Math.exp(-8 * dt));
      walkPose(gait.phase, gait.amount, p);
      // nearly still: the idle's breath and glance in the upper body (the legs keep the walk's)
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      if (gait.cheer > 0.001) blendPoses(p, cheerPose(time.now, scratch), gait.cheer, p);
      gait.lift = bodyLift(p, LEGS) * SCALE;
   });

   // looks only: follows the simulated robot. The GLB rises and falls with its planted foot (the
   // walk leans its own spine); the stand-in bobs and leans with the speed as before.
   useFrame(() => {
      const g = root.current;
      const body = rig.current;
      if (!g || !body) return;
      const { robot, progress } = run;
      const t = time.now;
      const speed = Math.min(1, Math.hypot(robot.vx, robot.vz) / ROBOT.maxSpeed);
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      const fallback = standIn.current !== null;

      g.position.set(robot.x, 0, robot.z);
      if (won) g.rotation.y += time.delta * 5;
      else g.rotation.y = robot.heading;
      if (won) body.position.y = Math.abs(Math.sin(t * 7)) * 0.25;
      else if (fallback) body.position.y = Math.abs(Math.sin(gait.phase)) * 0.05 * speed + Math.sin(t * 2.2) * 0.012;
      else body.position.y = gait.lift;
      body.rotation.x = fallback ? 0.16 * speed : 0;
      if (antenna.current) antenna.current.rotation.x = -0.3 * speed + Math.sin(t * 11) * 0.1 * speed;
      if (panel.current) panel.current.emissiveIntensity = 0.2 + (1.8 * progress.collected) / BATTERY_COUNT;
   });

   return (
      <group ref={root} name="robot">
         <BlobShadow radius={0.55} />
         {/* player marker: easy to spot on a small phone screen */}
         <mesh rotation-x={-Math.PI / 2} position-y={0.014}>
            <ringGeometry args={[0.6, 0.72, 32]} />
            <meshBasicMaterial color={COLORS.robot} transparent opacity={0.75} depthWrite={false} />
         </mesh>
         <group ref={rig}>
            {/* the group above carries the body's height (gait.lift), so the model does not add it again */}
            <HumanoidModel
               asset={ASSETS.robot}
               pose={pose}
               applyLift={false}
               fallback={
                  <group ref={standIn}>
                     <RobotPrimitive antenna={antenna} panel={panel} />
                  </group>
               }
            />
         </group>
      </group>
   );
}

// ---------- batteries ----------

const POP_S = 0.45;
const RING_S = 0.5;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Overshoots a little, then settles: a "pop" for batteries that appear. */
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

function Batteries({ run, layout }: { run: RunData; layout: Layout }) {
   const time = useGameTime();
   const parts = useBatteryParts();
   const slots = useRef<Array<Group | null>>([]);
   const bobs = useRef<Array<Group | null>>([]);
   const ring = useRef<Mesh>(null);
   // visual bookkeeping only (the rules own the real state); times are time.now values
   const [fx] = useState(() => ({
      wave: -1,
      appearedAt: new Array<number>(BATTERY_COUNT).fill(0),
      shownTaken: new Array<boolean>(BATTERY_COUNT).fill(false),
      ringAt: -10,
   }));

   useFrame(() => {
      const { progress } = run;
      const t = time.now;
      if (fx.wave !== progress.wave) {
         fx.wave = progress.wave;
         for (const b of layout.batteries) if (b.wave === progress.wave) fx.appearedAt[b.index] = t;
      }

      for (const b of layout.batteries) {
         const slot = slots.current[b.index];
         const bob = bobs.current[b.index];
         if (!slot || !bob) continue;
         if (progress.taken[b.index] && !fx.shownTaken[b.index]) {
            fx.shownTaken[b.index] = true;
            fx.ringAt = t;
            ring.current?.position.set(b.x, 0.03, b.z);
         }
         const active = isActive(progress, b);
         slot.visible = active;
         if (!active) continue;
         slot.scale.setScalar(Math.max(0.001, easeOutBack(clamp01((t - fx.appearedAt[b.index]) / POP_S))));
         bob.position.y = 0.16 + Math.sin(t * 2.6 + b.index) * 0.07;
         bob.rotation.y = t * 1.6 + b.index;
      }

      parts.glowMat.opacity = 0.36 + Math.sin(t * 4) * 0.1;
      // pickup flash: a ring that grows and fades where the battery was
      const k = (t - fx.ringAt) / RING_S;
      if (ring.current) {
         ring.current.visible = k >= 0 && k < 1;
         ring.current.scale.setScalar(0.5 + 2 * k);
         parts.ringMat.opacity = 0.9 * (1 - k);
      }
   });

   return (
      <group name="batteries">
         {layout.batteries.map((b) => (
            <group
               key={b.index}
               ref={(el) => {
                  slots.current[b.index] = el;
               }}
               position={[b.x, 0, b.z]}
               name={`battery-${b.index}`}
            >
               <mesh geometry={parts.glow} material={parts.glowMat} rotation-x={-Math.PI / 2} position-y={0.015} />
               <mesh geometry={parts.beam} material={parts.beamMat} position-y={1.6} />
               <group
                  ref={(el) => {
                     bobs.current[b.index] = el;
                  }}
               >
                  <Model asset={ASSETS.battery} fallback={<BatteryPrimitive parts={parts} />} />
               </group>
            </group>
         ))}
         <mesh ref={ring} geometry={parts.ring} material={parts.ringMat} rotation-x={-Math.PI / 2} visible={false} />
      </group>
   );
}

// ---------- the scene ----------

export default function Scene() {
   const view = useFittedView(VIEW);
   const input = useInput();
   // a new seed every run: GameShell remounts the Scene (and its game time) on start and retry
   const [layout] = useState(() => generateLayout(randomSeed()));
   const [run] = useState<RunData>(() => {
      const robot = createRobot();
      robot.heading = view.yaw; // face the camera on the start pad
      return { robot, progress: createProgress(), dir: { x: 0, z: 0 } };
   });

   // the game: move, collect, score, end. Runs only while "playing", before every visual.
   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      inputToWorld(moveX, moveY, view.yaw, run.dir);
      stepRobot(run.robot, run.dir.x, run.dir.z, dt);

      const got = collectTouched(run.progress, layout, run.robot);
      if (got === 0) return;
      const store = useArcadeStore.getState();
      store.addScore(got * BATTERY_POINTS);
      store.setStat("batteries", run.progress.collected);
      playSfx("pickup");

      if (isComplete(run.progress)) {
         // the run clock ticked before this callback, so timeLeftMs/elapsedMs are this frame's
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(BATTERY_COUNT, true, timeLeftMs ?? 0), elapsedMs));
         store.end("win");
      }
   });

   return (
      <>
         {/* the camera reads run.robot, which useRunFrame already moved this frame */}
         <CameraRig
            camera={{ position: view.offset, lookAt: LOOK_AT }}
            follow={run.robot}
            followFraction={FOLLOW}
            offset={view.offset}
            shift={view.shift}
            damping={4}
         />
         <Warehouse />
         <Robot run={run} />
         <Batteries run={run} layout={layout} />
      </>
   );
}
