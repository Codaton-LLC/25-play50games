"use client";

// Clean the City scene: one rules.step() per playing frame, then everything drawn from the run.
// The outcome lives in rules.ts. This file only steps it and draws it.
// - One run per Scene mount (GameShell remounts the Scene per run, so randomSeed() runs once).
//   The frame loop mutates that object: no setState, no allocation.
// - <Simulation> is mounted first and runs in useRunFrame, before the camera and every useFrame.
// - Visuals read the run and animate with useGameTime(), never state.clock.elapsedTime.
// - The store is the only way out: addScore / setStat / setScore / end. GameShell submits.
// - Camera: useFittedView + followFocus + CameraRig, yaw locked at 0, shift so the floor sits
//   clear of the HUD, the map pill, the joystick and the cookie banner. A map change teleports
//   the runner; the rig eases toward it (it only snaps on mount), so the view does not jump.
// - Litter: one DynamicInstancedModel pool per kind (5). Collected copies hide. Map props: one
//   InstancedModel per kind, all three maps mounted, visible from stats.map.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { followFocus } from "@/arcade3d/core/view";
import { ASSETS } from "./assets";
import { Beach, City, LitterKind, LitterStandIn, Park, PrimitiveRunner, RUNNER_RING, type RunnerLimbs } from "./Primitives";
import {
   FLOOR_HALF,
   ITEMS_PER_MAP,
   LITTER_KINDS,
   LITTER_POINTS,
   NONE,
   PER_KIND,
   RUNNER,
   SPAWN_HALF,
   START_PAD,
   capScore,
   createRun,
   createStepInput,
   runScore,
   step,
   type CleanRun,
} from "./rules";

// ---------- camera (README: pitch 56°, yaw 0, follow 12%, damping 4) ----------

const PITCH = (56 * Math.PI) / 180;
const LOOK_AT: [number, number, number] = [0, 0, 0];
const FOLLOW = 0.12;
/** Where the runner's centre can be. followFocus and CameraRig share it. */
const REACH: AABB = {
   min: { x: -SPAWN_HALF, y: 0, z: -SPAWN_HALF },
   max: { x: SPAWN_HALF, y: 0, z: SPAWN_HALF },
};
/** The whole 28 x 28 floor, plus room for the tallest prop, from every follow point. */
const FLOOR: AABB = {
   min: { x: -FLOOR_HALF, y: 0, z: -FLOOR_HALF },
   max: { x: FLOOR_HALF, y: 2.6, z: FLOOR_HALF },
};
const FOCUS = followFocus({ lookAt: LOOK_AT, reach: REACH, fraction: FOLLOW });
const VIEW: FittedViewOptions = {
   area: FLOOR,
   pitch: PITCH,
   yaws: [0],
   focus: FOCUS,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
   fov: 45,
};

// ---------- litter presentation (visual only) ----------

const POP_S = 0.35;
const SHRINK_S = 0.22;
const BURST_S = 0.45;

interface LitterFx {
   /** slot index per kind pool entry (kind * 5 + i); -1 if that copy does not exist */
   slot: Int32Array;
   appeared: Float64Array;
   goneAt: Float64Array;
   was: Uint8Array;
   map: number;
   burstAt: number;
   burstX: number;
   burstZ: number;
}

function createFx(): LitterFx {
   return {
      slot: new Int32Array(LITTER_KINDS.length * PER_KIND).fill(-1),
      appeared: new Float64Array(ITEMS_PER_MAP),
      goneAt: new Float64Array(ITEMS_PER_MAP).fill(-10),
      was: new Uint8Array(ITEMS_PER_MAP).fill(1),
      map: 0,
      burstAt: -10,
      burstX: 0,
      burstZ: 0,
   };
}

const KIND_COUNT = [0, 0, 0, 0];
const LITTER_ASSET = [ASSETS.bottle, ASSETS.bag, ASSETS.tinCan, ASSETS.banana] as const;
const P = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

/** 0 when the copy is gone. Writes nothing. */
function litterScale(run: CleanRun, fx: LitterFx, slot: number, now: number): number {
   const appear = Math.max(0.001, easeOutBack(clamp01((now - fx.appeared[slot]) / POP_S)));
   if (run.litter[slot].active) return appear;
   const k = clamp01((now - fx.goneAt[slot]) / SHRINK_S);
   if (k >= 1) return 0;
   return appear * (1 - k);
}

// ---------- simulation ----------

const Simulation = memo(function Simulation({ run, fx, yaw }: { run: CleanRun; fx: LitterFx; yaw: number }) {
   const input = useInput();
   const time = useGameTime();
   const [scratch] = useState(() => ({ dir: { x: 0, z: 0 }, input: createStepInput() }));

   useLayoutEffect(() => {
      const store = useArcadeStore.getState();
      store.setScore(0);
      store.setStat("map", 1);
      store.setStat("items", 0);
   }, []);

   useRunFrame((_state, dt) => {
      const now = input.current;
      inputToWorld(now.moveX, now.moveY, yaw, scratch.dir);
      scratch.input.moveX = scratch.dir.x;
      scratch.input.moveY = scratch.dir.z;
      const atX = run.runner.x;
      const atZ = run.runner.z;
      const ev = step(run, dt * 1000, scratch.input);
      const store = useArcadeStore.getState();
      if (ev.collected !== NONE) {
         store.addScore(LITTER_POINTS);
         if (ev.nextMap === NONE) store.setStat("items", run.items);
         fx.burstAt = time.now;
         fx.burstX = atX;
         fx.burstZ = atZ;
         playSfx("pickup");
      }
      if (ev.nextMap !== NONE) {
         store.setStat("map", ev.nextMap + 1);
         store.setStat("items", 0);
      }
      if (ev.ended === "win") {
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(run.collected, true, timeLeftMs ?? 0), elapsedMs));
         playSfx("win");
         store.end("win");
      } else if (ev.ended === "timeup") {
         store.end("timeup");
      }
   });

   return null;
});

// ---------- litter pools ----------

function Litter({ run, fx }: { run: CleanRun; fx: LitterFx }) {
   const time = useGameTime();
   const glow = useRef<MeshBasicMaterial>(null);
   const burst = useRef<Mesh>(null);

   // before the instance writers (priority 0): which slot each copy is, and the pop clock
   useFrame(() => {
      const now = time.now;
      if (fx.map !== run.map) {
         fx.map = run.map;
         for (let s = 0; s < ITEMS_PER_MAP; s++) {
            fx.appeared[s] = now;
            fx.goneAt[s] = -10;
            fx.was[s] = 1;
         }
      }
      KIND_COUNT[0] = 0;
      KIND_COUNT[1] = 0;
      KIND_COUNT[2] = 0;
      KIND_COUNT[3] = 0;
      for (let s = 0; s < ITEMS_PER_MAP; s++) {
         const slot = run.litter[s];
         if (fx.was[s] && !slot.active) {
            fx.was[s] = 0;
            fx.goneAt[s] = now;
         } else if (slot.active) fx.was[s] = 1;
         const n = KIND_COUNT[slot.kind];
         if (n < PER_KIND) fx.slot[slot.kind * PER_KIND + n] = s;
         KIND_COUNT[slot.kind] = n + 1;
      }
      if (glow.current) glow.current.opacity = 0.28 + Math.sin(now * 4) * 0.1;
      const ring = burst.current;
      if (ring) {
         const k = (now - fx.burstAt) / BURST_S;
         ring.visible = k >= 0 && k < 1;
         if (ring.visible) {
            ring.position.set(fx.burstX, 0.04, fx.burstZ);
            const sc = 0.4 + 1.6 * k;
            ring.scale.set(sc, sc, sc);
            (ring.material as MeshBasicMaterial).opacity = 0.85 * (1 - k);
         }
      }
   }, -0.2);

   const placeKind = (kind: number) => (i: number, m: Matrix4) => {
      const slot = fx.slot[kind * PER_KIND + i];
      if (slot < 0) return false;
      const sc = litterScale(run, fx, slot, time.now);
      if (sc <= 0) return false;
      const piece = run.litter[slot];
      P.set(piece.x, piece.active ? Math.sin(time.now * 2.6 + slot) * 0.045 : (1 - sc) * 0.35, piece.z);
      Q.setFromAxisAngle(UP, slot * 0.9 + run.map);
      S.set(sc, sc, sc);
      m.compose(P, Q, S);
   };
   const placeFlat = (y: number) => (i: number, m: Matrix4) => {
      const sc = litterScale(run, fx, i, time.now);
      if (sc <= 0) return false;
      const piece = run.litter[i];
      P.set(piece.x, y, piece.z);
      Q.copy(FLAT);
      S.set(sc, sc, sc);
      m.compose(P, Q, S);
   };

   return (
      <group name="litter">
         {LITTER_KINDS.map((kind, k) => (
            <LitterKind
               key={kind}
               asset={LITTER_ASSET[k]}
               count={PER_KIND}
               update={placeKind(k)}
               standIn={<LitterStandIn kind={k} count={PER_KIND} update={placeKind(k)} />}
            />
         ))}
         <DynamicInstanced count={ITEMS_PER_MAP} name="litter-rings" update={placeFlat(0.04)}>
            <ringGeometry args={[0.42, 0.62, 20]} />
            <meshBasicMaterial color={RUNNER_RING} transparent opacity={0.9} depthWrite={false} />
         </DynamicInstanced>
         <DynamicInstanced count={ITEMS_PER_MAP} name="litter-glow" update={placeFlat(0.025)}>
            <circleGeometry args={[0.72, 18]} />
            <meshBasicMaterial ref={glow} color="#bbf7d0" transparent opacity={0.3} depthWrite={false} />
         </DynamicInstanced>
         <mesh ref={burst} rotation-x={-Math.PI / 2} visible={false} name="pickup-burst">
            <ringGeometry args={[0.35, 0.5, 20]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
         </mesh>
      </group>
   );
}

// ---------- runner ----------

/**
 * Speed and walk phase are computed once here. PrimitiveRunner only displays them.
 * Swap the body for the core humanoid rig (arms down, same phase and stride) in this one line:
 *   <Humanoid asset={ASSETS.runner} motion={motion} />
 */
function Runner({ run }: { run: CleanRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const limbs = useRef<RunnerLimbs>({ legL: null, legR: null, armL: null, armR: null, bob: null });
   const motion = useRef({ phase: 0, stride: 0 });

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const r = run.runner;
      const t = time.now;
      const speed = Math.min(1, Math.hypot(r.vx, r.vz) / RUNNER.speed);
      const m = motion.current;
      m.stride = speed;
      m.phase += time.delta * (3 + 9 * speed);
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      g.position.set(r.x, 0, r.z);
      g.rotation.y = won ? g.rotation.y + time.delta * 4 : r.heading;
      const swing = Math.sin(m.phase) * 0.7 * m.stride;
      const { legL, legR, armL, armR, bob } = limbs.current;
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armL) armL.rotation.x = -swing * 0.85;
      if (armR) armR.rotation.x = swing * 0.85;
      if (bob) bob.position.y = won ? Math.abs(Math.sin(t * 7)) * 0.2 : Math.abs(Math.sin(m.phase)) * 0.04 * m.stride;
   });

   return (
      <group ref={root} name="runner">
         <BlobShadow radius={0.42} />
         <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
            <ringGeometry args={[0.46, 0.58, 24]} />
            <meshBasicMaterial color={RUNNER_RING} transparent opacity={0.85} depthWrite={false} />
         </mesh>
         <PrimitiveRunner limbs={limbs} />
      </group>
   );
}

// ---------- maps ----------

/** All three maps stay mounted. visible follows run.map in the same frame as the litter move, not a render later. */
function Worlds({ run }: { run: CleanRun }) {
   const park = useRef<Group>(null);
   const city = useRef<Group>(null);
   const beach = useRef<Group>(null);

   useFrame(() => {
      const map = run.map;
      if (park.current) park.current.visible = map === 0;
      if (city.current) city.current.visible = map === 1;
      if (beach.current) beach.current.visible = map === 2;
   }, -0.2);

   return (
      <>
         <group ref={park} name="map-park">
            <Park />
         </group>
         <group ref={city} visible={false} name="map-city">
            <City />
         </group>
         <group ref={beach} visible={false} name="map-beach">
            <Beach />
         </group>
      </>
   );
}

// ---------- the scene ----------

export default function Scene() {
   const view = useFittedView(VIEW);
   const [run] = useState(() => createRun(randomSeed()));
   const [fx] = useState(createFx);

   return (
      <>
         <Simulation run={run} fx={fx} yaw={view.yaw} />
         <CameraRig
            camera={{ position: view.offset, fov: 45, lookAt: LOOK_AT }}
            follow={run.runner}
            followFraction={FOLLOW}
            bounds={REACH}
            offset={view.offset}
            shift={view.shift}
            damping={4}
         />
         <mesh rotation-x={-Math.PI / 2} position={[START_PAD.x, 0.03, START_PAD.z]} name="start-pad">
            <ringGeometry args={[0.9, 1.12, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
         </mesh>
         <Worlds run={run} />
         <Litter run={run} fx={fx} />
         <Runner run={run} />
      </>
   );
}
