"use client";

// Penalty Hero scene. rules.ts owns every shot; this file steps it once per frame and draws it.
// The run object is created once per mount (GameShell remounts the Scene on retry). The frame
// loop mutates it and never calls setState. Visuals read it and animate with useGameTime().
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferGeometry,
   Color,
   Float32BufferAttribute,
   Plane,
   Raycaster,
   Vector2,
   Vector3,
   type Camera,
   type Group,
   type MeshBasicMaterial,
} from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { FEEDBACK } from "./Hud";
import { BallPrimitive, Goal, KeeperPrimitive, Stadium, StrikerPrimitive } from "./Primitives";
import {
   AIM_TIMEOUT_MS,
   BALL_SPOT,
   FLIGHT_MS,
   HOLD_MS,
   RETICLE_AMPLITUDE,
   RETICLE_BAND,
   RUNUP_MS,
   ZONES,
   ZONE_CENTRE_X,
   ZONE_CENTRE_Y,
   ZONE_WIDTH,
   aimPresses,
   createRun,
   isAccurate,
   reticleOffset,
   step,
   zoneAt,
   zoneIndex,
   type AimPresses,
   type RunState,
   type StepInput,
   type ZoneId,
} from "./rules";

const FOV = 40;
const LOOK_AT: [number, number, number] = [0, 1.22, 0];
/** README camera: (0, 4, 20) looking at the goal centre. The fit only ever moves it further back. */
const PITCH = Math.atan2(4 - LOOK_AT[1], 20);
const MIN_DISTANCE = Math.hypot(4 - LOOK_AT[1], 20);
/** The goal guard box: the opening plus 0.4 m for the frame, net and the keeper's dive. */
const GOAL_BOX: AABB = {
   min: { x: -4.06, y: -0.4, z: 0 },
   max: { x: 4.06, y: 2.84, z: 0 },
};
const VIEW: FittedViewOptions = {
   area: GOAL_BOX,
   pitch: PITCH,
   yaws: [0],
   focus: [{ x: LOOK_AT[0], y: LOOK_AT[1], z: LOOK_AT[2] }],
   fov: FOV,
   padding: 10,
   shift: true,
   minDistance: MIN_DISTANCE,
};

const SPOT_Z = 11;
const STRIKER_ROOT: [number, number, number] = [-0.65, 0, 11.8];
const KEEPER_ROOT: [number, number, number] = [0, 0, -0.15];
const KEEPER_HIP = 0.95;
const DIVE_ROLL = (65 * Math.PI) / 180;
const ZONE_H = 1.22;
const RING_ON = new Color("#4ade80");
const RING_OFF = new Color("#fbbf24");

interface Scratch {
   ray: Raycaster;
   ndc: Vector2;
   point: Vector3;
   plane: Plane;
   aim: Required<AimPresses>;
   input: StepInput;
}

type ViewRun = RunState & { lastShots: number; aimLeft: number; goalMask: number };

/** Canvas press (pointer coords) -> zone of the goal plane z = 0. Meshes are never hit-tested. */
function tapZone(x: number, y: number, camera: Camera, scratch: Scratch): ZoneId | null {
   scratch.ndc.set(x, y);
   scratch.ray.setFromCamera(scratch.ndc, camera);
   const hit = scratch.ray.ray.intersectPlane(scratch.plane, scratch.point);
   return hit ? zoneAt(hit.x, hit.y) : null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

function Simulation({ run, scratch }: { run: ViewRun; scratch: Scratch }) {
   const input = useInput();
   const camera = useThree((state) => state.camera);

   useRunFrame((_state, dt) => {
      const inp = input.current;
      const frame = scratch.input;
      // Keyboard aim: arrow / WASD keydowns, never lost between frames. Swipes do not aim.
      frame.pressed = aimPresses(inp.pressed, inp.swipe, scratch.aim);
      frame.jumpPressed = inp.jumpPressed;
      frame.actionPressed = inp.actionPressed;
      // Touch / click shoots on the press (tapDown), with the reticle that was on screen then.
      // `tap` would wait for the release and judge the shot 100-350 ms late.
      const down = inp.tapDown;
      frame.zoneId = down && run.phase === "aim" ? tapZone(down.x, down.y, camera, scratch) : null;
      const shotIndex = run.shotsDone;
      const ev = step(run, dt * 1000, frame);
      const store = useArcadeStore.getState();
      if (ev.goal) {
         run.goalMask |= 1 << shotIndex;
         store.setScore(run.score);
         store.setStat("goalMask", run.goalMask);
         store.setStat("feedback", FEEDBACK.goal);
         playSfx("pickup");
      } else if (ev.saved || ev.wide || ev.timeout) {
         store.setStat("feedback", ev.timeout ? FEEDBACK.timeout : ev.wide ? FEEDBACK.wide : FEEDBACK.saved);
         playSfx("hit");
      }
      if (ev.goal || ev.saved || ev.wide || ev.timeout) {
         store.setStat("goals", run.goals);
         store.setStat("streak", run.streak);
      }
      if (run.shotsDone !== run.lastShots) {
         run.lastShots = run.shotsDone;
         store.setStat("shots", run.shotsDone);
         if (!ev.ended) store.setStat("feedback", FEEDBACK.none);
      }
      const aimLeft = run.phase === "aim" ? Math.ceil((AIM_TIMEOUT_MS - run.aimMs) / 1000) : 0;
      if (aimLeft !== run.aimLeft) {
         run.aimLeft = aimLeft;
         store.setStat("aimLeft", aimLeft);
      }
      if (ev.ended) store.end("win");
   });

   return null;
}

/** Zone tiles behind the reticle: the highlighted one is bright, the rest faint. */
function Zones({ run }: { run: RunState }) {
   const time = useGameTime();
   const mats = useRef<Array<MeshBasicMaterial | null>>([]);
   const dividers = useMemo(() => {
      const half = ZONE_WIDTH / 2;
      const g = new BufferGeometry();
      g.setAttribute(
         "position",
         new Float32BufferAttribute([-half, 0, 0, -half, 2 * ZONE_H, 0, half, 0, 0, half, 2 * ZONE_H, 0, -3 * half, ZONE_H, 0, 3 * half, ZONE_H, 0], 3)
      );
      return g;
   }, []);
   useEffect(() => () => dividers.dispose(), [dividers]);

   useFrame(() => {
      const selected = zoneIndex(run.col, run.row);
      for (let i = 0; i < ZONES.length; i++) {
         const mat = mats.current[i];
         if (!mat) continue;
         const on = i === selected;
         const pulse = run.phase === "aim" ? 0.06 * Math.sin(time.now * 5) : 0;
         mat.opacity = on ? 0.36 + pulse : 0.1;
      }
   });

   return (
      <group name="zones" position={[0, 0, 0.02]}>
         <lineSegments geometry={dividers}>
            <lineBasicMaterial color="#f8fafc" transparent opacity={0.55} depthWrite={false} />
         </lineSegments>
         {ZONES.map((id, i) => {
            const col = i % 3;
            const row = i < 3 ? 1 : 0;
            return (
               <mesh key={id} position={[ZONE_CENTRE_X[col], ZONE_CENTRE_Y[row], 0]}>
                  <planeGeometry args={[ZONE_WIDTH - 0.08, ZONE_H - 0.08]} />
                  <meshBasicMaterial
                     ref={(m) => {
                        mats.current[i] = m;
                     }}
                     color="#f472b6"
                     transparent
                     opacity={0.1}
                     depthWrite={false}
                  />
               </mesh>
            );
         })}
      </group>
   );
}

/** Wobbling ring over the highlighted zone, with the white accuracy band at the zone centre. */
function Reticle({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const ring = useRef<Group>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const halfZone = ZONE_WIDTH / 2;

   useFrame(() => {
      const g = root.current;
      const r = ring.current;
      const mat = ringMat.current;
      if (!g || !r || !mat) return;
      g.visible = run.phase === "aim" && !run.ended;
      if (!g.visible) return;
      g.position.set(ZONE_CENTRE_X[run.col], ZONE_CENTRE_Y[run.row], 0.06);
      const offset = reticleOffset(run.aimMs, run.reticlePhase);
      r.position.x = (offset / RETICLE_AMPLITUDE) * halfZone * 0.85;
      const accurate = isAccurate(offset);
      mat.color.copy(accurate ? RING_ON : RING_OFF);
      r.scale.setScalar(1 + 0.05 * Math.sin(time.now * 9));
   });

   const band = (RETICLE_BAND / RETICLE_AMPLITUDE) * halfZone * 0.85 * 2;
   return (
      <group ref={root} name="reticle">
         <mesh>
            <planeGeometry args={[band, ZONE_H - 0.2]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.4} depthWrite={false} />
         </mesh>
         <group ref={ring}>
            <mesh>
               <ringGeometry args={[0.2, 0.28, 32]} />
               <meshBasicMaterial ref={ringMat} color="#fbbf24" depthWrite={false} transparent opacity={0.95} />
            </mesh>
         </group>
      </group>
   );
}

function Ball({ run }: { run: RunState }) {
   const root = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const shadow = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      const s = spin.current;
      const sh = shadow.current;
      if (!g || !s || !sh) return;
      let x: number = BALL_SPOT.x;
      let y: number = BALL_SPOT.y;
      let z = SPOT_Z;
      const shot = run.pending.kind === "shot";
      if (shot && run.phase === "flight") {
         const p = run.phaseMs / FLIGHT_MS;
         x = run.targetX * p;
         y = BALL_SPOT.y + (run.targetY - BALL_SPOT.y) * p + Math.sin(Math.PI * p) * 0.45;
         z = SPOT_Z * (1 - p);
         s.rotation.x = -p * 14;
      } else if (shot && run.phase === "hold") {
         const q = run.phaseMs / HOLD_MS;
         if (run.lastResult === "goal") {
            x = run.targetX * (1 - 0.1 * q);
            y = Math.max(BALL_SPOT.y, run.targetY - run.targetY * q * q);
            z = -1.25 * smooth(q * 2);
         } else if (run.lastResult === "saved") {
            x = run.targetX * (1 - 0.5 * q);
            y = Math.max(BALL_SPOT.y, run.targetY * (1 - q) + Math.sin(Math.PI * q) * 0.6);
            z = 0.3 + 3.2 * q;
         } else {
            x = run.targetX + Math.sign(run.targetX) * 0.8 * q;
            y = Math.max(BALL_SPOT.y, run.targetY * (1 - q));
            z = -3.5 * q;
         }
         s.rotation.x = -14 - q * 4;
      } else {
         s.rotation.x = 0;
      }
      g.position.set(x, y, z);
      sh.position.set(x, 0, z);
      sh.scale.setScalar(1 / (1 + y * 0.6));
   });

   return (
      <>
         <group ref={root} name="ball-root">
            <group ref={spin}>
               <BallPrimitive />
            </group>
         </group>
         <group ref={shadow}>
            <BlobShadow radius={0.16} />
         </group>
      </>
   );
}

function Striker({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const shot = run.pending.kind === "shot";
      let p = 0;
      if (shot && run.phase === "runup") p = run.phaseMs / RUNUP_MS;
      else if (shot && run.phase === "flight") p = 1;
      else if (shot && run.phase === "hold") p = 1 - smooth(run.phaseMs / HOLD_MS);
      const e = smooth(p);
      const stride = run.phase === "runup" && shot ? Math.abs(Math.sin(p * Math.PI * 3)) * 0.05 : 0;
      const idle = run.phase === "aim" ? Math.sin(time.now * 2.4) * 0.01 : 0;
      g.position.set(STRIKER_ROOT[0] + 0.3 * e, stride + idle, STRIKER_ROOT[2] - 0.6 * e);
      const kick = shot && run.phase === "flight" ? Math.sin(Math.PI * clamp01(run.phaseMs / 200)) * 0.12 : 0;
      g.rotation.x = -0.22 * e - kick;
      g.rotation.y = -0.25 * e;
   });

   return (
      <group ref={root} position={STRIKER_ROOT} name="striker">
         <Model asset={ASSETS.striker} fallback={<StrikerPrimitive />} />
         <BlobShadow radius={0.4} />
      </group>
   );
}

function Keeper({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const hip = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      const h = hip.current;
      if (!g || !h) return;
      let dive = 0;
      if (run.keeperIndex >= 0 && run.phase === "flight") dive = smooth((run.phaseMs / FLIGHT_MS) * 1.3);
      else if (run.keeperIndex >= 0 && run.phase === "hold") dive = 1 - smooth((run.phaseMs - HOLD_MS * 0.4) / (HOLD_MS * 0.6));
      const k = run.keeperIndex;
      const col = k >= 0 ? k % 3 : 1;
      const row = k >= 0 && k < 3 ? 1 : 0;
      const side = col === 0 ? -1 : col === 2 ? 1 : 0;
      const sway = run.phase === "aim" || run.phase === "runup" ? Math.sin(time.now * 2.2) * 0.22 : 0;
      const hop = run.phase === "aim" ? Math.abs(Math.sin(time.now * 4.4)) * 0.04 : 0;
      const reachX = side * 2.0;
      // A side dive rolls about the hip, so a low dive drops the hip to keep the body near the grass.
      const lift = side === 0 ? (row === 1 ? 0.55 : 0.12) : row === 1 ? 0.75 : -0.42;
      g.position.set(
         KEEPER_ROOT[0] + sway * (1 - dive) + reachX * dive,
         hop + lift * Math.sin((Math.PI / 2) * dive),
         KEEPER_ROOT[2]
      );
      const roll = side === 0 ? 0 : -side * DIVE_ROLL * (row === 1 ? 1 : 0.95);
      h.rotation.z = roll * dive;
   });

   return (
      <group ref={root} position={KEEPER_ROOT} name="keeper">
         <group ref={hip} position={[0, KEEPER_HIP, 0]}>
            <group position={[0, -KEEPER_HIP, 0]}>
               <Model asset={ASSETS.keeper} fallback={<KeeperPrimitive />} />
            </group>
         </group>
         <BlobShadow radius={0.45} />
      </group>
   );
}

export default function Scene() {
   const view = useFittedView(VIEW);
   const [run] = useState<ViewRun>(() =>
      Object.assign(createRun(randomSeed()), { lastShots: 0, aimLeft: 0, goalMask: 0 })
   );
   const scratch = useMemo<Scratch>(
      () => ({
         ray: new Raycaster(),
         ndc: new Vector2(),
         point: new Vector3(),
         plane: new Plane(new Vector3(0, 0, 1), 0),
         aim: { left: false, right: false, up: false, down: false },
         input: {},
      }),
      []
   );

   return (
      <>
         <Simulation run={run} scratch={scratch} />
         <CameraRig
            camera={{
               position: [LOOK_AT[0] + view.offset[0], LOOK_AT[1] + view.offset[1], LOOK_AT[2] + view.offset[2]],
               fov: FOV,
               lookAt: LOOK_AT,
            }}
            offset={view.offset}
            shift={view.shift}
            damping={6}
         />
         <Stadium />
         <Goal />
         <Zones run={run} />
         <Reticle run={run} />
         <Keeper run={run} />
         <Striker run={run} />
         <Ball run={run} />
      </>
   );
}
