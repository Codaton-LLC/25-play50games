"use client";

// Obstacle Race scene: one rules.step() per frame, then everything drawn from the run state.
// The outcome lives in rules.ts (pure, tested); the course look in Primitives.tsx; the camera fit in
// camera.ts. README "Scene and camera" is the design. Patterns (copy from robot-collector first):
// - One run object per Scene mount (GameShell remounts the Scene for every run). The frame loop
//   mutates it in place and never calls setState or allocates. No seed: one fixed course.
// - <Simulation> runs in useRunFrame (only while "playing", before the camera and every visual):
//   the stick mapped with inputToWorld(…, 0) (yaw 0 on every screen), one step(), then the store:
//   setStat("checkpoint") on an activation, setStat("finishMs") then end("win") on the finish (the
//   exact finish ms, index.tsx finalScore), end("timeup") at the rules' 300 s cap. GameShell plays
//   "win" / "lose" at the end; the Scene plays "jump", "pickup" and "hit".
// - The obstacles are drawn from the same pure functions the rules collide with (barAngle,
//   blockX, beamSlide), fed the visual obstacle time: −countdownMs during the countdown (the bar
//   arrives at its "Go" pose exactly at "Go"), simMs while playing or paused, and simMs plus the
//   game time since the end afterwards (nothing freezes under the arch).
// - The follow camera (camera.ts): CameraRig follows the point F, keyed by run.respawns so a
//   respawn is a cut, never a swoop (FollowCamera below).
// - Visuals animate with useGameTime() (pause-safe), never with state.clock.elapsedTime.
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync, useFrame, useThree } from "@react-three/fiber";
import { Color, type Group, type Matrix4, type Mesh, type MeshStandardMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, turnTowards } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import type { RunPhase } from "@/arcade3d/core/types";
import { COUNTDOWN_MS, useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import type { FittedView } from "@/arcade3d/core/view";
import { ASSETS } from "./assets";
import { DAMPING, followPoint, viewFor, type RaceView } from "./camera";
import {
   COLORS,
   CourseStatic,
   FinishArchPrimitive,
   Gates,
   LaneRopes,
   Pool,
   RunnerPrimitive,
   SweeperBar,
   BalanceBeam,
   createGateRigs,
   createRunnerRig,
   useBlockMesh,
   useFxParts,
   type GateRig,
} from "./Primitives";
import {
   APEX_HEIGHT,
   BEAM,
   COURSE,
   LINES,
   LOST_MS,
   NONE,
   RUNNER,
   SPAWN_MS,
   STAT,
   V_RUN,
   WATER_Y,
   barAngle,
   beamSlide,
   blockX,
   createRun,
   createStepInput,
   groundBelow,
   step,
   type ObstacleRun,
} from "./rules";

// ---------- shared state ----------

/** Things only the look needs (never read by the rules). Times are useGameTime().now values, negative = never. */
interface Fx {
   /** the rules ms the obstacles are drawn at this frame (VisualClock) */
   obstacleMs: number;
   /** when the run ended (the over phase began) */
   endedAt: number;
   jumpAt: number;
   landAt: number;
   knockAt: number;
   /** a knock is in progress (its fall plays no second "hit") */
   flung: boolean;
   lostAt: number;
   lostX: number;
   lostZ: number;
   spawnAt: number;
   spawnX: number;
   spawnY: number;
   spawnZ: number;
   /** per checkpoint (1..3): when it was activated */
   gateAt: number[];
   /** the runner's pose: facing (rad), airborne blend, lean, distance run on the ground (m), last position */
   yaw: number;
   air: number;
   lean: number;
   stride: number;
   lastX: number;
   lastZ: number;
   roll: number;
}

function createFx(): Fx {
   return {
      obstacleMs: -COUNTDOWN_MS,
      endedAt: -1,
      jumpAt: -10,
      landAt: -10,
      knockAt: -10,
      flung: false,
      lostAt: -10,
      lostX: 0,
      lostZ: 0,
      spawnAt: -10,
      spawnX: 0,
      spawnY: 0,
      spawnZ: 0,
      gateAt: [-1, -1, -1, -1],
      yaw: 0,
      air: 0,
      lean: 0,
      stride: 0,
      lastX: 0,
      lastZ: 0,
      roll: 0,
   };
}

/** The camera's follow point F (camera.ts followPoint) and whether it holds until the cut. */
interface Follow {
   x: number;
   y: number;
   z: number;
   /** true from a respawn until the rig keyed with the new respawn count has mounted */
   hold: boolean;
}

/** useFrame priorities between the simulation (-0.5) and CameraRig (-0.25): the visual clock, then the camera cut. */
const VISUAL_CLOCK_PRIORITY = -0.45;
const CUT_PRIORITY = -0.4;
/** After CameraRig (-0.25), before the visuals (0): the cut frame's re-aim (FollowCamera). */
const REAIM_PRIORITY = -0.2;

// ---------- the game ----------

/** Feeds dt and input into rules.step() and reports what happened. Renders nothing. */
const Simulation = memo(function Simulation({ run, fx, follow }: { run: ObstacleRun; fx: Fx; follow: Follow }) {
   const input = useInput();
   const time = useGameTime();
   const [scratch] = useState(() => ({ step: createStepInput(), dir: { x: 0, z: 0 } }));

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed } = input.current;
      // yaw 0 on every screen: up on the stick is always forward (−z)
      inputToWorld(moveX, moveY, 0, scratch.dir);
      const inp = scratch.step;
      inp.moveX = scratch.dir.x;
      inp.moveZ = scratch.dir.z;
      inp.jumpPressed = jumpPressed;
      const ev = step(run, dt * 1000, inp);

      const t = time.now;
      const r = run.runner;
      if (ev.jumped) {
         fx.jumpAt = t;
         playSfx("jump");
      }
      if (ev.landed) fx.landAt = t;
      if (ev.knocked) {
         fx.knockAt = t;
         fx.flung = true;
         playSfx("hit");
      }
      if (ev.lost) {
         fx.lostAt = t;
         fx.lostX = r.x;
         fx.lostZ = r.z;
         if (!fx.flung) playSfx("hit");
      }
      if (ev.respawned) {
         fx.spawnAt = t;
         fx.spawnX = r.x;
         fx.spawnY = r.y;
         fx.spawnZ = r.z;
         fx.flung = false;
         fx.yaw = 0;
         // F holds until FollowCamera's new rig has mounted (it writes F, then snaps to it)
         follow.hold = true;
      }
      if (ev.checkpoint !== NONE) {
         fx.gateAt[ev.checkpoint] = t;
         useArcadeStore.getState().setStat(STAT.checkpoint, ev.checkpoint);
         playSfx("pickup");
      }
      if (ev.finished) {
         // the exact finish ms first: finalScore submits it (README "Scoring")
         const store = useArcadeStore.getState();
         store.setStat(STAT.finishMs, run.finishMs);
         store.end("win");
      } else if (ev.timeup) {
         useArcadeStore.getState().end("timeup");
      }
      if (!follow.hold) followPoint(run, follow);
   });

   return null;
});

/**
 * The rules ms the obstacles are drawn at (Fx.obstacleMs), every frame and in every phase: before
 * the camera and the visuals, after the simulation.
 */
const VisualClock = memo(function VisualClock({ run, fx }: { run: ObstacleRun; fx: Fx }) {
   const time = useGameTime();
   useFrame(() => {
      const { phase, countdownMs } = useArcadeStore.getState();
      fx.obstacleMs = obstacleMs(phase, countdownMs, run.simMs, fx, time.now);
   }, VISUAL_CLOCK_PRIORITY);
   return null;
});

function obstacleMs(phase: RunPhase, countdownMs: number, simMs: number, fx: Fx, now: number): number {
   switch (phase) {
      case "countdown":
         return -countdownMs;
      case "playing":
      case "paused":
         return simMs;
      case "over":
         if (fx.endedAt < 0) fx.endedAt = now;
         return simMs + (now - fx.endedAt) * 1000;
      default:
         // the start screen (its own Scene mount, behind the start panel): already turning
         return now * 1000 - COUNTDOWN_MS;
   }
}

// ---------- camera ----------

const ORIGIN: [number, number, number] = [0, 0, 0];

/**
 * README "Scene and camera": the fitted view for the canvas's aspect, and a CameraRig keyed by the
 * respawn count. A respawn re-keys it in the same frame (flushSync from a useFrame between the
 * simulation and the camera): the new rig's wrapper writes F in a layout effect, the rig snaps to it
 * on mount, and the outgoing rig never eases towards the checkpoint 25 m away.
 * The outgoing rig still runs once more in the cut frame: R3F 8 runs a frame's callbacks from the
 * subscriber list as it was when the frame began, so the unmounted rig's useFrame (-0.25) turns the
 * camera back towards its own look point near the fall, a one-frame pitch up the course. The re-aim
 * at -0.2 looks at F again (the new rig's snap: followFraction 1, no bounds) before anything draws.
 * The position and the lens shift need nothing: the old rig eases the position towards F + offset,
 * where the snap put it, and sets its full shift again after its cleanup cleared it.
 */
const FollowCamera = memo(function FollowCamera({ run, follow }: { run: ObstacleRun; follow: Follow }) {
   const camera = useThree((state) => state.camera);
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const VIEW = viewFor(width, height);
   const view = useFittedView(VIEW);
   const [cut, setCut] = useState(run.respawns);
   const seen = useRef(run.respawns);
   const cutNow = useRef(false);

   useFrame(() => {
      if (run.respawns === seen.current) return;
      seen.current = run.respawns;
      // a render once per respawn, never per frame; synchronous, so the cut lands in this frame
      flushSync(() => setCut(run.respawns));
      cutNow.current = true;
   }, CUT_PRIORITY);

   useFrame(() => {
      if (!cutNow.current) return;
      cutNow.current = false;
      camera.lookAt(follow.x, follow.y, follow.z);
   }, REAIM_PRIORITY);

   return <CutRig key={cut} run={run} follow={follow} view={view} fov={VIEW.fov} />;
});

function CutRig({ run, follow, view, fov }: { run: ObstacleRun; follow: Follow; view: FittedView; fov: RaceView["fov"] }) {
   // layout effects run before CameraRig's mount effect, which snaps the camera to F
   useLayoutEffect(() => {
      followPoint(run, follow);
      follow.hold = false;
   }, [run, follow]);
   return (
      <CameraRig
         camera={{ position: view.offset, lookAt: ORIGIN, fov }}
         follow={follow}
         followFraction={1}
         offset={view.offset}
         shift={view.shift}
         damping={DAMPING}
      />
   );
}

// ---------- the course ----------

const Water = memo(function Water() {
   const time = useGameTime();
   const water = useRef<MeshStandardMaterial>(null);
   useFrame(() => {
      const map = water.current?.map;
      if (!map) return;
      map.offset.x = time.now * 0.012;
      map.offset.y = -time.now * 0.035;
   });
   return <Pool water={water} />;
});

const Sweeper = memo(function Sweeper({ fx }: { fx: Fx }) {
   const bar = useRef<Group>(null);
   useFrame(() => {
      if (bar.current) bar.current.rotation.y = barAngle(fx.obstacleMs);
   });
   return <SweeperBar bar={bar} />;
});

const BLOCKS = COURSE.supports.filter((s) => s.kind === "block");

const Blocks = memo(function Blocks({ fx }: { fx: Fx }) {
   const block = useBlockMesh();
   const place = (i: number, m: Matrix4) => {
      const s = BLOCKS[i];
      m.makeTranslation(blockX(s.block, fx.obstacleMs), 0, -(s.minP + s.maxP) / 2);
   };
   // the children form (one mesh): core DynamicInstanced's `parts` form throws on unmount (README "Known issues")
   return (
      <DynamicInstanced count={BLOCKS.length} update={place} name="blocks">
         <primitive object={block.geometry} attach="geometry" />
         <primitive object={block.material} attach="material" />
      </DynamicInstanced>
   );
});

const TILT = (BEAM.tiltDeg * Math.PI) / 180;

const Beam = memo(function Beam({ fx }: { fx: Fx }) {
   const beam = useRef<Group>(null);
   useFrame(() => {
      // in phase with the slide: the side the runner is pushed towards dips
      if (beam.current) beam.current.rotation.z = (-TILT * beamSlide(fx.obstacleMs)) / BEAM.slide;
   });
   return <BalanceBeam beam={beam} />;
});

const ACCENT = new Color(COLORS.accent);
const REACHED = new Color(COLORS.reached);
const GATE_FLASH_S = 0.6;
const POP_S = 0.45;
/** Overshoots a little, then settles. */
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

const CheckpointGates = memo(function CheckpointGates({ run, fx }: { run: ObstacleRun; fx: Fx }) {
   const time = useGameTime();
   const [rigs] = useState<GateRig[]>(createGateRigs);
   useEffect(() => () => rigs.forEach((rig) => rig.banner.dispose()), [rigs]);
   useFrame(() => {
      const t = time.now;
      for (let k = 0; k < rigs.length; k++) {
         const cp = k + 1;
         const rig = rigs[k];
         const reached = run.checkpoint >= cp;
         const e = fx.gateAt[cp] >= 0 ? t - fx.gateAt[cp] : -1;
         rig.banner.color.copy(reached ? REACHED : ACCENT);
         rig.banner.emissive.copy(reached ? REACHED : ACCENT);
         rig.banner.emissiveIntensity = e >= 0 && e < GATE_FLASH_S ? 0.15 + 0.85 * (1 - e / GATE_FLASH_S) : 0.15;
         const flag = rig.flag;
         if (!flag) continue;
         flag.visible = reached;
         if (reached) {
            flag.scale.setScalar(e >= 0 && e < POP_S ? Math.max(0.001, easeOutBack(e / POP_S)) : 1);
            flag.rotation.y = Math.sin(t * 3 + k) * 0.25;
         }
      }
   });
   return <Gates rigs={rigs} />;
});

// ---------- the runner ----------

/** The stand-in is about 1.55 m tall; the rules' runner is 1.5 m. */
const STAND_IN_SCALE = RUNNER.height / 1.55;
/** Ground covered by one stride cycle (m). */
const STRIDE = 1.7;
const DEG = Math.PI / 180;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** The knocked runner rolls this fast (rad/s), away from the hub, round its waist (m above the feet). */
const TUMBLE = 11;
const WAIST = 0.8;

const Runner = memo(function Runner({ run, fx }: { run: ObstacleRun; fx: Fx }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const shadow = useRef<Group>(null);
   const marker = useRef<Mesh>(null);
   const [rig] = useState(createRunnerRig);
   const parts = useFxParts();

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      const s = spin.current;
      const sh = shadow.current;
      if (!g || !b || !s || !sh) return;
      const r = run.runner;
      const t = time.now;
      const dt = time.delta;
      const ease = 1 - Math.exp(-14 * dt);
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      const slumped = phase === "over" && endReason === "timeup";
      const { hipL, hipR, kneeL, kneeR, shoulderL, shoulderR, elbowL, elbowR, head, tails } = rig;
      const limbs = hipL && hipR && kneeL && kneeR && shoulderL && shoulderR && elbowL && elbowR;

      // ground covered on foot drives the run cycle (a respawn's jump is not a stride)
      const moved = Math.hypot(r.x - fx.lastX, r.z - fx.lastZ);
      fx.lastX = r.x;
      fx.lastZ = r.z;
      if (r.state === "run" && r.grounded && moved < 1) fx.stride += moved;
      const cycle = (fx.stride / STRIDE) * Math.PI * 2;
      const speed = Math.min(1, Math.hypot(r.vx, r.vz) / V_RUN);
      const running = r.state === "run" && r.grounded && speed > 0.08 && !won;

      // facing: towards the input velocity; towards the camera when cheering
      if (won) fx.yaw = turnTowards(fx.yaw, Math.PI, 1 - Math.exp(-6 * dt));
      else if (r.state === "run" && speed > 0.15) fx.yaw = turnTowards(fx.yaw, Math.atan2(-r.vx, -r.vz), 1 - Math.exp(-12 * dt));

      // where the feet are drawn: the rules' position, sunk below the water once lost
      let y = r.y;
      let scale = 1;
      let visible = true;
      if (r.state === "lost") {
         const k = clamp01((t - fx.lostAt) / (LOST_MS / 1000));
         y = Math.min(r.y, WATER_Y + 0.3) - 2.6 * k * k - 0.4 * k;
         visible = k < 1;
      } else if (r.state === "spawn") {
         scale = 0.55 + 0.45 * easeOutBack(clamp01((t - fx.spawnAt) / (SPAWN_MS / 1000)));
      }
      const hop = won ? Math.abs(Math.sin(t * 6)) * 0.32 : 0;
      g.visible = visible;
      g.position.set(r.x, y + hop, r.z);
      g.rotation.set(0, fx.yaw, 0);
      g.scale.setScalar(scale);

      // the shadow and the indigo marker sit on the highest support under the centre (or the water)
      const ground = groundBelow(COURSE, r.x, r.z, r.y, fx.obstacleMs);
      sh.visible = r.state !== "lost";
      sh.position.set(r.x, ground, r.z);
      const above = Math.max(0, r.y - ground);
      sh.scale.setScalar(1 - 0.45 * Math.min(1, above / APEX_HEIGHT));
      if (marker.current) marker.current.visible = r.state === "run" || r.state === "spawn";

      // the body: a tumble while knocked or sinking, lean into the run, wobble on the beam, squash and stretch
      const flailing = r.state === "knocked" || r.state === "lost";
      if (flailing) {
         // roll away from the hub (the fling's side), round the waist
         fx.roll += (r.x < 0 ? 1 : -1) * TUMBLE * dt;
         s.rotation.set(0.35 * Math.sin(t * 9), 0, fx.roll);
         b.rotation.set(0, 0, 0);
         b.position.set(0, 0, 0);
         b.scale.set(1, 1, 1);
      } else {
         fx.roll = 0;
         s.rotation.set(0, 0, 0);
         const onBeam = r.grounded && r.support !== NONE && COURSE.supports[r.support].kind === "beam";
         fx.lean += ((running ? (4 + 6 * speed) * DEG : 0) - fx.lean) * ease;
         const wobble = onBeam ? Math.sin(t * 7) * 6 * DEG + (beamSlide(fx.obstacleMs) / BEAM.slide) * -5 * DEG : 0;
         b.rotation.set(-fx.lean + (slumped ? 0.25 : 0), 0, wobble);
         b.position.set(0, running ? Math.abs(Math.sin(cycle)) * 0.05 : Math.sin(t * 3) * 0.006, 0);
         let sy = 1;
         const sinceJump = t - fx.jumpAt;
         const sinceLand = t - fx.landAt;
         if (!r.grounded && sinceJump >= 0 && sinceJump < 0.35) sy = sinceJump < 0.08 ? mix(0.85, 1.08, sinceJump / 0.08) : mix(1.08, 1, (sinceJump - 0.08) / 0.27);
         else if (r.grounded && sinceLand >= 0 && sinceLand < 0.1) sy = mix(0.86, 1, sinceLand / 0.1);
         const sxz = 1 / Math.sqrt(sy);
         b.scale.set(sxz, sy, sxz);
      }

      fx.air += ((r.grounded || r.state === "spawn" ? 0 : 1) - fx.air) * (1 - Math.exp(-18 * dt));
      const air = flailing ? 0 : fx.air;
      if (limbs) {
         if (flailing) {
            // limbs everywhere
            const f = Math.sin(t * 22);
            shoulderL.rotation.set(2.2 + 0.6 * f, 0, -0.9);
            shoulderR.rotation.set(2.2 - 0.6 * f, 0, 0.9);
            elbowL.rotation.set(0.4, 0, 0);
            elbowR.rotation.set(0.4, 0, 0);
            hipL.rotation.set(0.6 * f, 0, -0.3);
            hipR.rotation.set(-0.6 * f, 0, 0.3);
            kneeL.rotation.set(-0.8, 0, 0);
            kneeR.rotation.set(-0.8, 0, 0);
         } else if (won) {
            // cheering under the arch
            const w = Math.sin(t * 10) * 0.25;
            shoulderL.rotation.set(2.9 + w, 0, -0.35);
            shoulderR.rotation.set(2.9 - w, 0, 0.35);
            elbowL.rotation.set(0.3, 0, 0);
            elbowR.rotation.set(0.3, 0, 0);
            const tuck = Math.abs(Math.sin(t * 6));
            hipL.rotation.set(0.3 * tuck, 0, 0);
            hipR.rotation.set(0.3 * tuck, 0, 0);
            kneeL.rotation.set(-0.6 * tuck, 0, 0);
            kneeR.rotation.set(-0.6 * tuck, 0, 0);
         } else {
            const onBeam = r.grounded && r.support !== NONE && COURSE.supports[r.support].kind === "beam";
            const sw = running ? Math.sin(cycle) * speed : 0;
            const c = running ? Math.cos(cycle) : 0;
            const idle = running ? 0 : Math.sin(t * 2.2) * 0.05;
            const tuck = !r.grounded ? Math.sin(clamp01((t - fx.jumpAt) / 0.68) * Math.PI) : 0;
            hipL.rotation.set(mix(sw * 0.7 + idle, 0.8 + 0.3 * tuck, air), 0, 0);
            hipR.rotation.set(mix(-sw * 0.7 - idle, -0.3 + 0.3 * tuck, air), 0, 0);
            kneeL.rotation.set(mix(running ? -(0.15 + 1.0 * Math.max(0, c) * speed) : -0.08, -0.4 - 0.5 * tuck, air), 0, 0);
            kneeR.rotation.set(mix(running ? -(0.15 + 1.0 * Math.max(0, -c) * speed) : -0.08, -1.2 - 0.2 * tuck, air), 0, 0);
            // arms: swing with the stride, out for balance on the beam, up in a leap, hanging when the time is up
            const out = onBeam ? 1.25 + Math.sin(t * 5) * 0.2 : slumped ? 0.02 : mix(0.08, 0.4, air);
            shoulderL.rotation.set(mix(-sw * 0.8 - idle, -0.7, air), 0, -out);
            shoulderR.rotation.set(mix(sw * 0.8 + idle, 1.3, air), 0, out);
            const bend = running || air > 0.01 ? 1.3 : onBeam ? 0.3 : 0.4;
            elbowL.rotation.set(bend, 0, 0);
            elbowR.rotation.set(bend, 0, 0);
         }
      }
      if (head) head.rotation.set(slumped ? 0.5 : flailing ? Math.sin(t * 13) * 0.3 : fx.lean * 0.5, 0, 0);
      if (tails) tails.rotation.set(running || air > 0.1 ? 0.45 + Math.sin(t * 16) * 0.2 * Math.max(speed, air) : 1.0, Math.sin(t * 9) * 0.1, 0);
   });

   return (
      <>
         <group ref={shadow}>
            <BlobShadow radius={0.4} opacity={0.32} />
            {/* the indigo marker: the runner from far away on a phone */}
            <mesh ref={marker} geometry={parts.marker} material={parts.markerMat} position-y={0.02} renderOrder={2} />
         </group>
         <group ref={root} name="runner">
            {/* body: lean and squash round the feet; spin: the tumble round the waist */}
            <group ref={body}>
               <group ref={spin} position-y={WAIST}>
                  <group position-y={-WAIST}>
                     <Model
                        asset={ASSETS.runner}
                        fallback={
                           <group scale={STAND_IN_SCALE}>
                              <RunnerPrimitive rig={rig} />
                           </group>
                        }
                     />
                  </group>
               </group>
            </group>
         </group>
      </>
   );
});

// ---------- splash and spawn ----------

const DROPS = 10;
const SPLASH_S = 0.9;
const RING_S = 0.8;

const Effects = memo(function Effects({ fx }: { fx: Fx }) {
   const time = useGameTime();
   const parts = useFxParts();
   const splashRing = useRef<Mesh>(null);
   const spawnRing = useRef<Mesh>(null);

   const placeDrop = (i: number, m: Matrix4) => {
      const e = time.now - fx.lostAt;
      if (fx.lostAt < 0 || e < 0 || e > SPLASH_S) return false;
      const a = (i / DROPS) * Math.PI * 2 + i * 0.37;
      const out = 0.6 + 1.6 * e * (0.7 + 0.3 * ((i * 7) % 3));
      const y = WATER_Y + (3.6 + (i % 4) * 0.7) * e - 9 * e * e;
      if (y < WATER_Y - 0.1) return false;
      const s = 1 - (0.5 * e) / SPLASH_S;
      m.makeScale(s, s, s).setPosition(fx.lostX + Math.cos(a) * out, y, fx.lostZ + Math.sin(a) * out);
   };

   useFrame(() => {
      const t = time.now;
      const ring = splashRing.current;
      if (ring) {
         const e = (t - fx.lostAt) / RING_S;
         ring.visible = fx.lostAt >= 0 && e >= 0 && e < 1;
         if (ring.visible) {
            ring.position.set(fx.lostX, WATER_Y + 0.03, fx.lostZ);
            ring.scale.setScalar(0.8 + 3.2 * e);
            parts.splashMat.opacity = 0.85 * (1 - e);
         }
      }
      const spawn = spawnRing.current;
      if (spawn) {
         const e = (t - fx.spawnAt) / 0.5;
         spawn.visible = e >= 0 && e < 1;
         if (spawn.visible) {
            spawn.position.set(fx.spawnX, fx.spawnY + 0.03, fx.spawnZ);
            spawn.scale.setScalar(2.4 - 1.6 * e);
            parts.spawnMat.opacity = 0.9 * (1 - e);
         }
      }
   });

   return (
      <group name="effects">
         <DynamicInstanced count={DROPS} update={placeDrop} name="splash-drops">
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color={COLORS.splash} roughness={0.2} />
         </DynamicInstanced>
         <mesh ref={splashRing} geometry={parts.ring} material={parts.splashMat} visible={false} renderOrder={2} />
         <mesh ref={spawnRing} geometry={parts.ring} material={parts.spawnMat} visible={false} renderOrder={2} />
      </group>
   );
});

// ---------- the scene ----------

export default function Scene() {
   // GameShell remounts the Scene (and its game time) on start and retry: a fresh run every time.
   // One fixed course, no seed (README "Fixed course").
   const [run] = useState(() => createRun());
   const [fx] = useState(createFx);
   const [follow] = useState<Follow>(() => ({ ...followPoint(run, { x: 0, y: 0, z: 0 }), hold: false }));
   const gl = useThree((state) => state.gl);
   const scene = useThree((state) => state.scene);
   const camera = useThree((state) => state.camera);

   // Every shader once, now (about 8 ms, behind the start panel or the countdown), not the first time
   // its object comes into view: the gate banners and flags and the finish checker are off-screen at
   // the start and would compile mid-run (a 40-140 ms frame on a first visit). compile() walks the
   // whole scene, hidden objects included; on a remount the programs are already cached.
   useLayoutEffect(() => {
      gl.compile(scene, camera);
   }, [gl, scene, camera]);

   return (
      <>
         <Simulation run={run} fx={fx} follow={follow} />
         <VisualClock run={run} fx={fx} />
         <FollowCamera run={run} follow={follow} />
         <Water />
         <LaneRopes />
         <CourseStatic />
         <Sweeper fx={fx} />
         <Blocks fx={fx} />
         <Beam fx={fx} />
         <CheckpointGates run={run} fx={fx} />
         {/* drawn from rules.ts ARCH, never a model: the group A GLB does not fit the posts (assets.ts) */}
         <group position={[0, 0, -LINES.finish]}>
            <FinishArchPrimitive />
         </group>
         <Runner run={run} fx={fx} />
         <Effects fx={fx} />
      </>
   );
}
