"use client";

// Robot Collector scene: feeds input + dt into rules.ts every frame and draws the result.
// Game logic lives in rules.ts (pure, tested); the warehouse look lives in Primitives.tsx and the
// camera fit in camera.ts. This file is the part to copy for a new game:
// - Run state is a plain object created once per run (GameShell remounts Scene for every run).
//   The frame loop mutates it; nothing in the loop calls setState or allocates.
// - <Simulation> changes the game (useRunFrame: only while "playing", dt clamped). It is rendered
//   FIRST: R3F runs same-priority frame callbacks in mount order and children mount before their
//   parent, so the simulation must come before any component that draws its state (else every
//   visual shows the previous frame).
// - Visuals (useFrame) only read the run state. They animate with run.time, never with
//   state.clock.elapsedTime: GameShell pauses by switching the frameloop, which resets that clock.
// - The store is the only way out: addScore / setStat / end(reason). GameShell does the rest.
// - Models: useModel says whether the GLB exists. Until it does, a primitive stands in.
import { useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model, useModel } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useInput } from "@/arcade3d/core/input";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { FOLLOW, useWarehouseView } from "./camera";
import { BatteryPrimitive, BlobShadow, COLORS, RobotPrimitive, Warehouse, useBatteryParts } from "./Primitives";
import {
   BATTERY_COUNT,
   BATTERY_POINTS,
   ROBOT,
   capScore,
   collectTouched,
   createProgress,
   createRobot,
   generateLayout,
   inputToWorld,
   isActive,
   isComplete,
   runScore,
   stepRobot,
   type Layout,
   type Progress,
   type RobotState,
} from "./rules";

interface RunData {
   robot: RobotState;
   progress: Progress;
   /** scratch for inputToWorld (no allocation per frame) */
   dir: { x: number; z: number };
   /** animation clock (s since the Scene mounted), advanced by Simulation; pauses with the game */
   time: number;
}

/** A long frame (tab switch, a redraw while paused) never jumps an animation by more than this. */
const MAX_ANIM_DT = 0.1;

// ---------- the simulation (render it first) ----------

function Simulation({
   run,
   layout,
   yaw,
   focus,
}: {
   run: RunData;
   layout: Layout;
   yaw: number;
   focus: RefObject<Group>;
}) {
   const input = useInput();

   // the game: move, collect, score, end. Runs only while "playing", dt is clamped.
   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      inputToWorld(moveX, moveY, yaw, run.dir);
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

   // every frame, after the step: the animation clock and the camera focus, which sits part of
   // the way towards the robot so the whole warehouse stays in frame
   useFrame((_state, delta) => {
      run.time += Math.min(delta, MAX_ANIM_DT);
      focus.current?.position.set(run.robot.x * FOLLOW, 0, run.robot.z * FOLLOW);
   });

   return null;
}

// ---------- the robot ----------

function Robot({ run }: { run: RunData }) {
   const { failed } = useModel(ASSETS.robot);
   const root = useRef<Group>(null);
   const rig = useRef<Group>(null);
   const antenna = useRef<Group>(null);
   const panel = useRef<MeshStandardMaterial>(null);

   // looks only: follows the simulated robot, bobs and leans with its speed
   useFrame((_state, delta) => {
      const g = root.current;
      const body = rig.current;
      if (!g || !body) return;
      const { robot, progress, time: t } = run;
      const speed = Math.min(1, Math.hypot(robot.vx, robot.vz) / ROBOT.maxSpeed);
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";

      g.position.set(robot.x, 0, robot.z);
      if (won) g.rotation.y += delta * 5;
      else g.rotation.y = robot.heading;
      body.position.y = won ? Math.abs(Math.sin(t * 7)) * 0.25 : Math.abs(Math.sin(t * 15)) * 0.05 * speed + Math.sin(t * 2.2) * 0.012;
      body.rotation.x = 0.16 * speed;
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
         <group ref={rig}>{failed ? <RobotPrimitive antenna={antenna} panel={panel} /> : <Model asset={ASSETS.robot} />}</group>
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
   const { failed } = useModel(ASSETS.battery);
   const parts = useBatteryParts();
   const slots = useRef<Array<Group | null>>([]);
   const bobs = useRef<Array<Group | null>>([]);
   const ring = useRef<Mesh>(null);
   // visual bookkeeping only (the rules own the real state); times are run.time values
   const [fx] = useState(() => ({
      wave: -1,
      appearedAt: new Array<number>(BATTERY_COUNT).fill(0),
      shownTaken: new Array<boolean>(BATTERY_COUNT).fill(false),
      ringAt: -10,
   }));

   useFrame(() => {
      const { progress, time: t } = run;
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
                  {failed ? <BatteryPrimitive parts={parts} /> : <Model asset={ASSETS.battery} />}
               </group>
            </group>
         ))}
         <mesh ref={ring} geometry={parts.ring} material={parts.ringMat} rotation-x={-Math.PI / 2} visible={false} />
      </group>
   );
}

// ---------- the scene ----------

const ORIGIN: [number, number, number] = [0, 0, 0];

export default function Scene() {
   const view = useWarehouseView();
   // a new seed every run: GameShell remounts the Scene (key = runId) on start and retry
   const [layout] = useState(() => generateLayout(Math.floor(Math.random() * 2 ** 32)));
   const [run] = useState<RunData>(() => {
      const robot = createRobot();
      robot.heading = view.yaw; // face the camera on the start pad
      return { robot, progress: createProgress(), dir: { x: 0, z: 0 }, time: 0 };
   });
   const focus = useRef<Group>(null);

   return (
      <>
         {/* first child: its frame callbacks run before everything that draws the run */}
         <Simulation run={run} layout={layout} yaw={view.yaw} focus={focus} />
         <CameraRig camera={{ position: view.offset, lookAt: ORIGIN }} follow={focus} offset={view.offset} damping={4} />
         <group ref={focus} />
         <Warehouse />
         <Robot run={run} />
         <Batteries run={run} layout={layout} />
      </>
   );
}
