"use client";

// Office Escape scene: one rules.step() per frame, then everything drawn from the run state.
// The outcome lives in rules.ts (pure, tested); the office look in Primitives.tsx; the camera fit
// in camera.ts. Patterns a later runner can copy (README "What a new game copies from here"):
// - Floating origin: the runner stays at z = 0 and the track is drawn at (distance - s) / 1000,
//   so a 28 km run never loses float precision. The corridor is a 12 m pattern whose group slides
//   by distance mod 12 m (a treadmill): nothing in it ever re-spawns.
// - One run object per Scene mount (GameShell remounts the Scene for every run, so every run gets
//   a new seed). The frame loop mutates it in place and never calls setState or allocates.
// - <Simulation> is the first child and runs in useRunFrame (only while "playing", before every
//   plain useFrame), so every visual draws this frame's state with this frame's camera.
// - Rows and coins live in fixed pools; every prop type is a few InstancedMeshes whose matrices
//   and counts are rewritten each frame (Primitives.tsx PropSlot). Nothing mounts after the start.
// - Store calls only on change: setScore on a new metre or coin (capScore, a no-op safety net),
//   setStat("coins") on a pickup, setLevel on a speed-up, end("lose" | "win") once.
// - Visuals animate with useGameTime() (pause-safe), never with state.clock.elapsedTime.
// - The runner GLB is a static T-pose: <HumanoidModel> (core/rig) rigs it in code and
//   useHumanoidPose drives its limbs from the run state (the run cycle by distance, the leap, the
//   crash, the win). RunnerPrimitive, with its own swung limbs, stays as the fallback.
import { memo, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Euler, Matrix4, Quaternion, Vector3, type Group, type MeshBasicMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import {
   BONE,
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   bodyLift,
   cheerPose,
   createPose,
   idlePose,
   jumpPose,
   turnBone,
   useHumanoidPose,
   walkPose,
} from "@/arcade3d/core/rig";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { chaseInsets, fitChase, type ChaseFit } from "./camera";
import { CRASH, crashPlacement, crashPose, type CrashPlacement } from "./crash";
import { RUNNER_SCALE, createRunnerGait, stepRunnerGait, type RunnerGait } from "./gait";
import {
   Backdrop,
   COLORS,
   CORRIDOR,
   InstancedProp,
   OfficeCorridor,
   PropMeshes,
   RunnerPrimitive,
   SHADOW_LOCALS,
   createPropSlot,
   createRunnerRig,
   useStandIns,
   type PropSlot,
   type StandIns,
} from "./Primitives";
import {
   COIN,
   COIN_SLOTS,
   JUMP_APEX,
   LANES,
   LANE_COUNT,
   NO_OBSTACLE,
   OBSTACLE_TYPES,
   ROW_SLOTS,
   capScore,
   createRun,
   readInput,
   speedAt,
   step,
   type OfficeRun,
} from "./rules";

// ---------- visual-only state ----------

/** Things only the look needs (never read by the rules). Times are useGameTime().now values. */
interface Fx {
   landAt: number;
   stageAt: number;
   /** -1 until the runner hits an obstacle */
   crashAt: number;
   hitRow: number;
   hitLane: number;
   blockedAt: number;
   blockedDir: number;
   /** smoothed roll into a lane change (rad) and the airborne pose blend (0..1) */
   roll: number;
   air: number;
   lean: number;
   /** per coin pool slot: the coin slot drawn last frame (-1 none) and when it was taken (-1 not) */
   coinSeen: Int32Array;
   coinTakenAt: Float64Array;
}

function createFx(): Fx {
   return {
      landAt: -10,
      stageAt: -10,
      crashAt: -1,
      hitRow: -1,
      hitLane: -1,
      blockedAt: -10,
      blockedDir: 0,
      roll: 0,
      air: 0,
      lean: 0,
      coinSeen: new Int32Array(COIN_SLOTS).fill(-1),
      coinTakenAt: new Float64Array(COIN_SLOTS).fill(-1),
   };
}

/** Scratch objects for the frame loops (one frame callback uses them at a time, synchronously). */
const M = new Matrix4();
const P = new Matrix4();
const Q = new Quaternion();
const E = new Euler();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const ONE = new Vector3(1, 1, 1);
const NO_TURN = new Quaternion();

/** Writes copy `k` of a prop (every piece of every part) at `placement`. */
function writeCopy(slot: PropSlot, k: number, placement: Matrix4): void {
   const parts = slot.parts;
   for (let p = 0; p < parts.length; p++) {
      const mesh = slot.meshes[p];
      if (!mesh) continue;
      const locals = parts[p].locals;
      const n = locals.length;
      for (let j = 0; j < n; j++) mesh.setMatrixAt(k * n + j, M.multiplyMatrices(placement, locals[j]));
   }
}

/** Shows the first `count` copies of a prop and uploads the matrices. */
function showCopies(slot: PropSlot, count: number): void {
   const parts = slot.parts;
   for (let p = 0; p < parts.length; p++) {
      const mesh = slot.meshes[p];
      if (!mesh) continue;
      mesh.count = count * parts[p].locals.length;
      mesh.instanceMatrix.needsUpdate = true;
   }
}

// ---------- the game ----------

/** Feeds dt and input into rules.step() and reports what happened. Renders nothing. */
const Simulation = memo(function Simulation({ run, fx }: { run: OfficeRun; fx: Fx }) {
   const input = useInput();
   const time = useGameTime();

   useRunFrame((_state, dt) => {
      const ev = step(run, dt * 1000, readInput(run.edges, input.current, run.input));
      const store = useArcadeStore.getState();
      if (ev.laneBlocked) {
         fx.blockedAt = time.now;
         fx.blockedDir = run.lane === 0 ? -1 : 1;
      }
      if (ev.landed) fx.landAt = time.now;
      if (ev.jumped) playSfx("jump");
      if (ev.coin > 0) {
         store.setStat("coins", run.coins);
         playSfx("pickup");
      }
      if (ev.stageChanged) {
         store.setLevel(run.stage + 1);
         fx.stageAt = time.now;
      }
      // elapsedMs is this frame's: the run clock ticks before useRunFrame
      if (ev.scoreChanged || ev.ended) store.setScore(capScore(run.score, store.elapsedMs));
      if (ev.ended === "lose") {
         fx.crashAt = time.now;
         fx.hitRow = ev.hitRow;
         fx.hitLane = ev.hitLane;
         store.end("lose");
         playSfx("hit");
      } else if (ev.ended === "win") {
         store.end("win");
      }
   });

   return null;
});

// ---------- camera ----------

/**
 * The static chase camera (README "Scene and camera"): camera.ts fitChase for the live canvas and
 * safe area, placed by core CameraRig. Only this small component re-renders when the HUD or the
 * cookie banner changes; the fit itself changes only with the canvas size or the safe rect.
 */
const ChaseCamera = memo(function ChaseCamera() {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const safe = useSafeArea();
   const { top, bottom, left, right } = chaseInsets(safe, width, height);
   const fit: ChaseFit = useMemo(() => fitChase(width, height, { top, bottom, left, right }), [width, height, top, bottom, left, right]);
   return <CameraRig camera={{ position: fit.position, lookAt: fit.lookAt, fov: fit.fov }} />;
});

// ---------- the corridor ----------

const TREADMILL_MM = CORRIDOR.period * 1000;
const STAGE_FLASH_S = 0.5;
const STRIPE = new Color(COLORS.stripe);
const FLASH = new Color(COLORS.accent);

const Corridor = memo(function Corridor({ run, fx }: { run: OfficeRun; fx: Fx }) {
   const time = useGameTime();
   const camera = useThree((state) => state.camera);
   const treadmill = useRef<Group>(null);
   const ceiling = useRef<Group>(null);
   const stripes = useRef<MeshBasicMaterial>(null);

   useFrame(() => {
      // integer mm, so the slide is exact however long the run
      if (treadmill.current) treadmill.current.position.z = (run.distance % TREADMILL_MM) / 1000;
      // the ceiling would sit under a camera fitted very high (a very narrow portrait screen)
      if (ceiling.current) ceiling.current.visible = camera.position.y < CORRIDOR.height - 1;
      const mat = stripes.current;
      if (mat) {
         const k = (time.now - fx.stageAt) / STAGE_FLASH_S;
         mat.color.copy(STRIPE);
         if (k >= 0 && k < 1) mat.color.lerp(FLASH, 1 - k * k);
      }
   });

   return (
      <>
         <group ref={treadmill}>
            <OfficeCorridor stripes={stripes} ceiling={ceiling} />
         </group>
         <Backdrop />
      </>
   );
});

// ---------- obstacles ----------

/** 8 row slots x 3 lanes: the most copies of one type that can be alive. */
const CAPACITY = ROW_SLOTS * LANE_COUNT;
/** The GLB each type becomes (boxes stay primitives). */
const OBSTACLE_ASSETS: ReadonlyArray<ModelAsset | null> = OBSTACLE_TYPES.map((o) => (o.name === "boxes" ? null : ASSETS[o.name]));
/** Largest random turn per type (rad), so rows do not look machine-placed. Looks only. */
const TURN: Record<(typeof OBSTACLE_TYPES)[number]["name"], number> = {
   desk: 0.05,
   printer: 0.12,
   boxes: 0.15,
   chair: 0.6,
   coffeeCart: 0.06,
   waterCooler: 0.35,
};
const TURNS = OBSTACLE_TYPES.map((o) => TURN[o.name]);

/** A fixed -1..1 value per row and lane (deterministic, so a row never changes its look). */
function jitter(row: number, lane: number): number {
   const h = Math.sin(row * 12.9898 + lane * 78.233) * 43758.5453;
   return (h - Math.floor(h)) * 2 - 1;
}

const Obstacles = memo(function Obstacles({ run, fx, standIns }: { run: OfficeRun; fx: Fx; standIns: StandIns }) {
   const time = useGameTime();
   const [slots] = useState(() => OBSTACLE_TYPES.map(createPropSlot));
   const [shadowSlot] = useState(createPropSlot);
   const [counts] = useState(() => new Int32Array(OBSTACLE_TYPES.length));

   useFrame(() => {
      counts.fill(0);
      let shadows = 0;
      const shadowMesh = shadowSlot.meshes[0] ?? null;
      const crashK = fx.crashAt >= 0 ? time.now - fx.crashAt : -1;
      for (let r = 0; r < ROW_SLOTS; r++) {
         const row = run.rows[r];
         if (!row.alive) continue;
         const z = (run.distance - row.s) / 1000;
         for (let lane = 0; lane < LANE_COUNT; lane++) {
            const type = row.lanes[lane];
            if (type === NO_OBSTACLE) continue;
            // the obstacle the runner hit rocks back and settles (looks only)
            const knocked = crashK >= 0 && row.index === fx.hitRow && lane === fx.hitLane;
            const tilt = knocked ? -0.2 * Math.exp(-crashK * 3.5) * Math.sin(crashK * 16) : 0;
            Q.setFromEuler(E.set(tilt, jitter(row.index, lane) * TURNS[type], 0));
            P.compose(V.set(LANES[lane] / 1000, 0, z), Q, ONE);
            writeCopy(slots[type], counts[type], P);
            counts[type] += 1;
            if (shadowMesh) shadowMesh.setMatrixAt(shadows++, M.multiplyMatrices(P, SHADOW_LOCALS[type]));
         }
      }
      for (let t = 0; t < slots.length; t++) showCopies(slots[t], counts[t]);
      if (shadowMesh) {
         shadowMesh.count = shadows;
         shadowMesh.instanceMatrix.needsUpdate = true;
      }
   });

   return (
      <group name="obstacles">
         <PropMeshes parts={standIns.shadow} capacity={CAPACITY} slot={shadowSlot} />
         {OBSTACLE_TYPES.map((o, t) => {
            const asset = OBSTACLE_ASSETS[t];
            return asset ? (
               <InstancedProp key={o.name} asset={asset} fallback={standIns.obstacles[t]} capacity={CAPACITY} slot={slots[t]} />
            ) : (
               <PropMeshes key={o.name} parts={standIns.obstacles[t]} capacity={CAPACITY} slot={slots[t]} />
            );
         })}
      </group>
   );
});

// ---------- coins ----------

const PICKUP_S = 0.3;
/** Coins this far behind the runner (m) start to shrink, and are gone this much further back. */
const MISSED_FROM = 1;
const MISSED_OVER = 1.2;

const Coins = memo(function Coins({ run, fx, standIns }: { run: OfficeRun; fx: Fx; standIns: StandIns }) {
   const time = useGameTime();
   const [coinSlot] = useState(createPropSlot);
   const [glowSlot] = useState(createPropSlot);

   useFrame(() => {
      const t = time.now;
      let n = 0;
      for (let i = 0; i < COIN_SLOTS; i++) {
         const coin = run.coinPool[i];
         if (!coin.alive || coin.kind === "removed") {
            fx.coinSeen[i] = -1;
            continue;
         }
         if (fx.coinSeen[i] !== coin.slot) {
            fx.coinSeen[i] = coin.slot;
            fx.coinTakenAt[i] = -1;
         }
         const raised = coin.kind === "raised";
         let x: number, y: number, z: number, scale: number, spin: number;
         if (coin.taken) {
            // collected: it flies up over the runner's head and shrinks away in PICKUP_S, wherever
            // its track position is by then (the missed-coin cull below is for untaken coins only)
            if (fx.coinTakenAt[i] < 0) fx.coinTakenAt[i] = t;
            const k = (t - fx.coinTakenAt[i]) / PICKUP_S;
            if (k >= 1) continue;
            x = run.x / 1000;
            y = run.feet / 1000 + 1.35 + 0.9 * k;
            z = -0.1;
            scale = 1.15 * (1 - k * k);
            spin = t * 14;
         } else {
            x = LANES[coin.lane] / 1000;
            y = (raised ? COIN.raisedY : COIN.groundY) / 1000 + Math.sin(t * 3 + coin.slot) * 0.05;
            z = (run.distance - coin.s) / 1000;
            // a missed coin shrinks away behind the runner instead of flying past the camera
            scale = z > MISSED_FROM ? 1 - (z - MISSED_FROM) / MISSED_OVER : 1;
            if (scale <= 0) continue;
            spin = t * 3.2 + coin.slot * 0.9;
         }
         Q.setFromEuler(E.set(0, spin, 0));
         writeCopy(coinSlot, n, P.compose(V.set(x, y, z), Q, S.setScalar(scale)));
         const glow = (raised ? 1.6 : 1.15) * scale;
         writeCopy(glowSlot, n, P.compose(V.set(x, y, z - 0.06), NO_TURN, S.setScalar(glow)));
         n += 1;
      }
      showCopies(coinSlot, n);
      showCopies(glowSlot, n);
   });

   // the shared coin GLB (ASSETS.coin: the stand-in's size, centred on the coin's point, so the same
   // spin, bob and pickup matrices place it), or the stand-in disc while it is missing or broken
   return (
      <group name="coins">
         <InstancedProp asset={ASSETS.coin} fallback={standIns.coin} capacity={COIN_SLOTS} slot={coinSlot} />
         <PropMeshes parts={standIns.glow} capacity={COIN_SLOTS} slot={glowSlot} />
      </group>
   );
});

// ---------- the runner ----------

const DEG = Math.PI / 180;
const APEX_M = JUMP_APEX / 1000;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** The runner GLB's joints (core/sharedAssets) and its scale here: its height over its planted foot. */
const LEGS = RUNNER_LANDMARKS;
const SCALE = RUNNER_SCALE;

/** The run cycle (looks only) of the GLB runner and the stand-in: phase and amount (gait.ts), cheer and the body's height. */
interface Gait extends RunnerGait {
   cheer: number;
   /** the body's height over its planted foot this frame (m): core/rig bodyLift x SCALE */
   lift: number;
}

const Runner = memo(function Runner({ run, fx }: { run: OfficeRun; fx: Fx }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shadow = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [rig] = useState(createRunnerRig);
   const [gait] = useState<Gait>(() => ({ ...createRunnerGait(), cheer: 0, lift: 0 }));
   const [scratch] = useState(createPose);
   const [crash] = useState<CrashPlacement>(() => ({ e: 0, y: 0, z: 0, tilt: 0, yaw: 0 }));

   // the GLB runner's limbs (core/rig), FRAME_PRIORITY.pose: after the step, before the useFrame
   // below. The run cycle's phase advances by the ground covered over the contact stride (gait.ts:
   // the legs move with the ground and stop when it stops, the planted foot stays put up to
   // 12.4 m/s); the stand-in reads the same phase. Its amount eases from the idle to the full run;
   // the leap blends in by the airborne blend (knees tucked at the apex), the crash into a flail, the
   // win into a cheer. The lean into the run and the roll into a lane change are the spine's (a
   // whole-body lean about the feet would tip the soles into the floor). The smoothed looks shared
   // with the stand-in (fx.lean, fx.roll, fx.air) are advanced here, once per frame.
   const pose = useHumanoidPose((p) => {
      const t = time.now;
      const dt = time.delta;
      const ease = 1 - Math.exp(-14 * dt);
      const moving = run.distance > 0 && !run.over;
      const speed = speedAt(run.simMs);
      const phase = stepRunnerGait(gait, run.distance, moving, dt).phase;
      const grounded = run.jumpMs < 0;
      const { phase: runPhase, endReason } = useArcadeStore.getState();
      const won = runPhase === "over" && endReason === "win";

      // lean into the run (6° + 0.5° per m/s over 8), roll into a lane change (±10°)
      fx.lean += ((moving ? (6 + 0.5 * (speed - 8)) * DEG : 0.03) - fx.lean) * ease;
      const dx = LANES[run.lane] - run.x;
      const slide = moving ? Math.max(-1, Math.min(1, dx / 600)) : 0;
      fx.roll += (-slide * 10 * DEG - fx.roll) * ease;
      fx.air += ((grounded ? 0 : 1) - fx.air) * (1 - Math.exp(-20 * dt));
      gait.cheer += ((won ? 1 : 0) - gait.cheer) * (1 - Math.exp(-8 * dt));

      walkPose(phase, gait.amount, p);
      // nearly still (the countdown, the end): the idle's breath and glance in the upper body
      blendPoses(p, idlePose(t, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      // the roll tips the chest the other way (tilt > 0 = to its right = the world's +x, as the model is turned round)
      turnBone(p, BONE.spine, fx.lean, 0, -fx.roll);
      if (fx.air > 0.001) {
         // a leap: knees tucked at the apex
         const tuck = run.jumpMs >= 0 ? Math.sin((Math.min(run.jumpMs, 700) / 700) * Math.PI) : 0;
         blendPoses(p, jumpPose(0.4 + 0.6 * tuck, scratch), fx.air, p);
      }
      if (gait.cheer > 0.001) blendPoses(p, cheerPose(t, scratch), gait.cheer, p);
      // on its back: the arms flail, the legs kick up off the floor (crash.ts)
      if (fx.crashAt >= 0) blendPoses(p, crashPose(t, scratch), Math.min(1, (t - fx.crashAt) / CRASH.poseS), p);
      gait.lift = bodyLift(p, LEGS) * SCALE;
   });

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      const sh = shadow.current;
      if (!g || !b || !sh) return;
      const t = time.now;
      const x = run.x / 1000;
      const feet = run.feet / 1000;
      const moving = run.distance > 0 && !run.over;
      const speed = speedAt(run.simMs);
      const p = gait.phase;
      const { phase, endReason } = useArcadeStore.getState();
      const { hipL, hipR, kneeL, kneeR, shoulderL, shoulderR, elbowL, elbowR, head, tails } = rig;
      const limbs = hipL && hipR && kneeL && kneeR && shoulderL && shoulderR && elbowL && elbowR;
      const fallback = standIn.current !== null;

      if (fx.crashAt >= 0) {
         // knocked back onto its back (diagonally, towards the middle, so it stays in view), a
         // bounce, then a dizzy head (crash.ts). Looks only: the run is already over.
         const k = t - fx.crashAt;
         const { e, y, z, tilt, yaw } = crashPlacement(k, feet, run.x > 0 ? -1 : 1, crash);
         g.position.set(x, y, z);
         g.rotation.set(tilt, yaw, 0, "YXZ");
         b.position.set(0, 0, 0);
         b.rotation.set(0, 0, 0);
         b.scale.set(1, 1, 1);
         // the shadow lies under the body's middle
         sh.position.set(x + Math.sin(yaw) * 0.75 * e, 0, CRASH.back * e + Math.cos(yaw) * 0.75 * e);
         sh.rotation.set(0, yaw, 0);
         sh.scale.set(1 + 0.3 * e, 1, 1 + 1.3 * e);
         if (limbs) {
            shoulderL.rotation.set(1.2 * e, 0, -1.0 * e);
            shoulderR.rotation.set(1.2 * e, 0, 1.0 * e);
            elbowL.rotation.set(0.5, 0, 0);
            elbowR.rotation.set(0.5, 0, 0);
            hipL.rotation.set(0.5 * e, 0, -0.15 * e);
            hipR.rotation.set(0.3 * e, 0, 0.15 * e);
            kneeL.rotation.set(-0.5 * e, 0, 0);
            kneeR.rotation.set(-0.9 * e, 0, 0);
         }
         if (head) head.rotation.set(0, k > 0.5 ? Math.sin(k * 6) * 0.35 : 0, 0);
         if (tails) tails.rotation.set(1.1, 0, 0);
         return;
      }

      const won = phase === "over" && endReason === "win";
      const hop = won ? Math.abs(Math.sin(t * 5)) * 0.35 : 0;
      g.position.set(x, feet + hop, 0);
      g.rotation.set(0, 0, 0);
      sh.position.set(x, 0, 0);
      sh.rotation.set(0, 0, 0);
      sh.scale.setScalar(1 - 0.45 * Math.min(1, (feet + hop) / APEX_M));

      // the stand-in leans and rolls as a whole and wobbles at the wall; the GLB's spine leans and
      // rolls (pose), the wall wobble stays on the body
      const wk = (t - fx.blockedAt) / 0.3;
      const wobble = wk >= 0 && wk < 1 ? Math.sin(wk * Math.PI * 3) * (1 - wk) * 0.14 * fx.blockedDir : 0;
      if (fallback) b.rotation.set(-fx.lean, 0, fx.roll - wobble);
      else b.rotation.set(0, 0, -wobble);

      // the stand-in bobs per step on the ground and breathes while standing; the GLB rises and
      // falls with its planted foot (the pose's bodyLift)
      const grounded = run.jumpMs < 0;
      if (fallback) b.position.y = moving && grounded ? Math.abs(Math.sin(p)) * 0.06 : Math.sin(t * 3) * 0.008;
      else b.position.y = gait.lift;

      // squash on take-off and landing, stretch while rising (from the jump phase and the landing time)
      let sy = 1;
      if (run.jumpMs >= 0) {
         const j = run.jumpMs;
         if (j < 80) sy = mix(0.85, 1.08, j / 80);
         else if (j < 350) sy = mix(1.08, 1, (j - 80) / 270);
      } else {
         const k = (t - fx.landAt) / 0.08;
         if (k >= 0 && k < 1) sy = mix(0.85, 1, k);
      }
      const sxz = 1 / Math.sqrt(sy);
      b.scale.set(sxz, sy, sxz);

      const air = fx.air;
      if (limbs) {
         // run cycle (±35° at the hips), then blended towards a leap with the knees tucked at the apex
         const sw = moving ? Math.sin(p) : 0;
         const c = moving ? Math.cos(p) : 0;
         const idle = moving ? 0 : Math.sin(t * 2.2) * 0.06;
         const tuck = run.jumpMs >= 0 ? Math.sin((Math.min(run.jumpMs, 700) / 700) * Math.PI) : 0;
         hipL.rotation.set(mix(sw * 0.62 + idle, 0.75 + 0.3 * tuck, air), 0, 0);
         hipR.rotation.set(mix(-sw * 0.62 - idle, -0.3 + 0.3 * tuck, air), 0, 0);
         kneeL.rotation.set(mix(moving ? -(0.15 + 0.95 * Math.max(0, c)) : -0.1, -0.35 - 0.5 * tuck, air), 0, 0);
         kneeR.rotation.set(mix(moving ? -(0.15 + 0.95 * Math.max(0, -c)) : -0.1, -1.3 - 0.2 * tuck, air), 0, 0);
         const arms = won ? 2.8 : 0;
         shoulderL.rotation.set(won ? arms : mix(-sw * 0.75 - idle, -0.6, air), 0, won ? -0.3 : mix(-0.08, -0.35, air));
         shoulderR.rotation.set(won ? arms : mix(sw * 0.75 + idle, 1.2, air), 0, won ? 0.3 : mix(0.08, 0.35, air));
         elbowL.rotation.set(moving || air > 0.01 ? 1.35 : 0.45, 0, 0);
         elbowR.rotation.set(moving || air > 0.01 ? 1.35 : 0.45, 0, 0);
      }
      if (head) head.rotation.set(fx.lean * 0.6, 0, -fx.roll * 0.4);
      if (tails) tails.rotation.set(moving ? 0.45 + Math.sin(t * 18) * 0.22 * (speed / 16) : 1.0, Math.sin(t * 11) * 0.1, 0);
   });

   return (
      <>
         <group ref={shadow}>
            <BlobShadow radius={0.42} opacity={0.3} />
         </group>
         <group ref={root} name="runner">
            <group ref={body}>
               {/* the body group carries the GLB's height over its planted foot (gait.lift), so the model does not add it again */}
               <HumanoidModel
                  asset={ASSETS.runner}
                  pose={pose}
                  applyLift={false}
                  fallback={
                     <group ref={standIn}>
                        <RunnerPrimitive rig={rig} />
                     </group>
                  }
               />
            </group>
         </group>
      </>
   );
});

// ---------- the scene ----------

export default function Scene() {
   // a new seed every run: GameShell remounts the Scene (and its game time) on start and retry.
   // createRun fills the first 74 m of rows and 72 m of coins, so the corridor is set during the countdown.
   const [run] = useState(() => createRun(randomSeed()));
   const [fx] = useState(createFx);
   const standIns = useStandIns();

   return (
      <>
         <Simulation run={run} fx={fx} />
         <ChaseCamera />
         <Corridor run={run} fx={fx} />
         <Obstacles run={run} fx={fx} standIns={standIns} />
         <Coins run={run} fx={fx} standIns={standIns} />
         <Runner run={run} fx={fx} />
      </>
   );
}
