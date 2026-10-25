"use client";

// Robot Collector scene: feeds input + dt into rules.ts every frame and draws the result.
// Modern look (2026-10-25):
// - Sky dome + atmospheric gradient from core/env
// - Sci-fi robotics yard lighting & fog from looks.ts
// - Instanced surroundings decor outside the play area via <Decor />
// - Juicy feedback via core/fx: sparkle burst & floating score on pickup, subtle shake on collision
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { SkyDome } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
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
   wrapPhase,
} from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { followFocus } from "@/arcade3d/core/view";
import { ASSETS } from "./assets";
import { Decor } from "./Decor";
import { ROBOT_SCALE, robotPhaseStep } from "./gait";
import type { RobotLevel } from "./levels";
import { COLORS, FOG, LEVEL_LOOKS } from "./looks";
import { BatteryPrimitive, HazardMarks, RobotPrimitive, WALL, Warehouse, useBatteryParts } from "./Primitives";
import {
   ARENA,
   BATTERY_POINTS,
   ROBOT,
   capScore,
   createRun,
   isActive,
   isComplete,
   runScore,
   stepRun,
   type Run,
} from "./rules";

/** The picked level's config (levels.ts); level 1 when levels are off. */
export const useRobotLevel = () => useLevel<RobotLevel>();

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

const VIEW: FittedViewOptions = {
   area: WAREHOUSE,
   pitch: PITCH,
   yaws: [0, Math.PI / 2],
   focus: followFocus({ lookAt: LOOK_AT, reach: FLOOR, fraction: FOLLOW }),
   margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
};

// ---------- the robot ----------

/** The robot GLB's joints (core/sharedAssets) and its scale here: its height over its feet (its stride: gait.ts). */
const LEGS = ROBOT_LANDMARKS;
const SCALE = ROBOT_SCALE;

/** The walk cycle (looks only): phase from the distance walked, amount eased towards the speed. */
interface Gait {
   phase: number;
   amount: number;
   cheer: number;
   /** the body's height over its planted foot this frame (m): core/rig bodyLift x SCALE */
   lift: number;
}

function Robot({ run, lamp }: { run: Run; lamp?: number }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const rig = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const antenna = useRef<Group>(null);
   const panel = useRef<MeshStandardMaterial>(null);
   const [gait] = useState<Gait>(() => ({ phase: 0, amount: 0, cheer: 0, lift: 0 }));
   const [scratch] = useState(createPose);

   // the GLB robot's limbs (core/rig): idle -> walk -> run with its speed, arms up on a win.
   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase, endReason } = useArcadeStore.getState();
      const v = phase === "playing" ? Math.hypot(run.robot.vx, run.robot.vz) : 0;
      gait.amount += (Math.min(1, v / ROBOT.maxSpeed) - gait.amount) * (1 - Math.exp(-12 * dt));
      gait.phase = wrapPhase(gait.phase + robotPhaseStep(gait.amount, v, dt));
      gait.cheer += ((phase === "over" && endReason === "win" ? 1 : 0) - gait.cheer) * (1 - Math.exp(-8 * dt));
      walkPose(gait.phase, gait.amount, p);
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      if (gait.cheer > 0.001) blendPoses(p, cheerPose(time.now, scratch), gait.cheer, p);
      gait.lift = bodyLift(p, LEGS) * SCALE;
   });

   // looks only: follows the simulated robot.
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
      if (panel.current) panel.current.emissiveIntensity = 0.25 + (1.8 * progress.collected) / progress.taken.length;
   });

   return (
      <group ref={root} name="robot">
         <BlobShadow radius={0.55} />
         {/* player marker: easy to spot on a small phone screen */}
         <mesh rotation-x={-Math.PI / 2} position-y={0.014}>
            <ringGeometry args={[0.6, 0.72, 32]} />
            <meshBasicMaterial color={COLORS.robot} transparent opacity={0.8} depthWrite={false} />
         </mesh>
         {/* night level lamp */}
         {lamp ? <pointLight position={[0, 2.1, 0.4]} color={COLORS.lamp} intensity={lamp} distance={4.5} decay={1.4} /> : null}
         <group ref={rig}>
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
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

function Batteries({ run }: { run: Run }) {
   const time = useGameTime();
   const parts = useBatteryParts();
   const { layout } = run;
   const slots = useRef<Array<Group | null>>([]);
   const bobs = useRef<Array<Group | null>>([]);
   const ring = useRef<Mesh>(null);
   const [fx] = useState(() => ({
      wave: -1,
      appearedAt: new Array<number>(layout.batteries.length).fill(0),
      shownTaken: new Array<boolean>(layout.batteries.length).fill(false),
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

/** The scene of one level: remounted when another level is picked. */
function LevelScene() {
   const view = useFittedView(VIEW);
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const { config, meta, id } = useRobotLevel();
   const levelLook = LEVEL_LOOKS[id] ?? LEVEL_LOOKS[1];
   const hitCooldown = useRef(0);

   // Pre-warm particle & score pools on mount so the first pickup doesn't stutter
   useEffect(() => {
      fx.warm("sparkle", "score");
   }, [fx]);

   const [dir] = useState({ x: 0, z: 0 });
   const [run] = useState<Run>(() => {
      const next = createRun(randomSeed(), config);
      next.robot.heading = view.yaw;
      return next;
   });

   // Movement, collision, pickups, juicy feedback, scoring
   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      inputToWorld(moveX, moveY, view.yaw, dir);

      const prevX = run.robot.x;
      const prevZ = run.robot.z;
      const got = stepRun(run, dir.x, dir.z, dt);

      // Subtle feedback on collision when driving hard against obstacle/wall
      const wantedSpeed = Math.hypot(dir.x, dir.z);
      if (wantedSpeed > 0.4 && time.now - hitCooldown.current > 0.35) {
         const movedDist = Math.hypot(run.robot.x - prevX, run.robot.z - prevZ);
         if (movedDist < wantedSpeed * ROBOT.maxSpeed * dt * 0.35) {
            hitCooldown.current = time.now;
            fx.shake(0.06);
         }
      }

      if (got === 0) return;
      const store = useArcadeStore.getState();
      store.addScore(got * BATTERY_POINTS);
      store.setStat("batteries", run.progress.collected);
      playSfx("pickup");

      // Juicy feedback: sparkle burst + floating score over pickup spot
      const lastIndex = run.progress.taken.lastIndexOf(true);
      if (lastIndex >= 0 && lastIndex < run.layout.batteries.length) {
         const b = run.layout.batteries[lastIndex];
         fx.burst("sparkle", { x: b.x, y: 0.5, z: b.z }, 16);
         fx.score({ x: b.x, y: 0.8, z: b.z }, "+100", { color: COLORS.batteryGlow });
      }

      if (isComplete(run.progress)) {
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(run.progress.taken.length, true, timeLeftMs ?? 0), elapsedMs, meta.scoring));
         store.end("win");
      }
   });

   return (
      <>
         {/* Atmospheric gradient sky dome from core/env */}
         <SkyDome top={levelLook.skyTop} bottom={levelLook.skyBottom} offset={0.08} exponent={0.75} />
         {/* Atmospheric linear fog past arena bounds */}
         <fog attach="fog" args={[levelLook.fog, FOG.near, FOG.far]} />

         {/* Camera follow & fitted safe-area framing */}
         <CameraRig
            camera={{ position: view.offset, lookAt: LOOK_AT }}
            follow={run.robot}
            followFraction={FOLLOW}
            offset={view.offset}
            shift={view.shift}
            damping={4}
         />

         {/* Warehouse: diorama slab, floor with light strips, walls and props */}
         <Warehouse props={run.world.props} />

         {/* Level hazards: oil patches and scrolling conveyor belts */}
         <HazardMarks level={config} />

         {/* Instanced surroundings outside the play area */}
         <Decor />

         {/* The robot character (GLB via auto-rig or deliberate stand-in) */}
         <Robot run={run} lamp={config.lamp} />

         {/* Energy batteries */}
         <Batteries run={run} />
      </>
   );
}

export default function Scene() {
   const { id } = useRobotLevel();
   return <LevelScene key={id} />;
}
