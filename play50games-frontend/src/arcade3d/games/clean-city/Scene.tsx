"use client";

// Clean the City scene: one rules.step() per playing frame, then everything drawn from the run.
// The outcome lives in rules.ts. This file only steps it and draws it.
// - One run per Scene mount (GameShell remounts the Scene per run, so randomSeed() runs once).
//   The frame loop mutates that object: no setState, no allocation.
// - <Simulation> is mounted first and runs in useRunFrame, before the camera and every useFrame.
// - Visuals read the run and animate with useGameTime(), never state.clock.elapsedTime.
// - The store is the only way out: addScore / setStat / setScore / end. GameShell submits.
// - Camera (constants in camera.ts): useFittedView + followFocus + CameraRig, yaw locked at 0, shift so the floor sits
//   clear of the HUD, the map pill, the joystick and the cookie banner. A map change teleports
//   the runner; the rig eases toward it (it only snaps on mount), so the view does not jump.
// - The runner of the rules is drawn as the cleaner (cleaner.glb, auto-rigged): its gait (gait.ts)
//   keeps the planted foot still at every speed in straight-line travel (while it turns the foot
//   swings with the body: README "The cleaner"); a stoop to each piece it picks up (pickup.ts: the
//   nearer hand reaches for where the piece lay), a cheer on a map clear.
// - Litter: one <DynamicInstancedModel> pool per kind (PER_KIND = 5 copies), the stand-in parts
//   (useLitterStandIns) as its fallbackParts. Collected copies hide. Map props: one InstancedModel
//   per kind, all three maps mounted, Worlds sets visible from run.map in a useFrame. The park and
//   the city also carry their decor (Decor.tsx: ground beyond the floor, parked cars, pigeons),
//   outside everything the run draws on the floor (decorSpots.ts).
import { memo, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import {
   BONE,
   BONE_COUNT,
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   bodyLift,
   cheerPose,
   createPose,
   idlePose,
   resolvePose,
   useHumanoidPose,
   walkPose,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, CLEANER_LANDMARKS } from "./assets";
import { DAMPING, FOLLOW, FOV, LOOK_AT, REACH, VIEW } from "./camera";
import { CityDecor, ParkDecor } from "./Decor";
import { CLEANER_SCALE, createCleanerGait, gaitFrameDt, stepCleanerGait } from "./gait";
import { createPickupMark, localOffset, notePickup, pickupPose, type LocalOffset, type PickupMark } from "./pickup";
import { cheerWeight, reachWeight } from "./poseWeights";
import { Beach, City, Park, PrimitiveRunner, RUNNER_RING, useLitterStandIns, type RunnerLimbs } from "./Primitives";
import {
   ITEMS_PER_MAP,
   LITTER_KINDS,
   LITTER_POINTS,
   NONE,
   PER_KIND,
   START_PAD,
   capScore,
   createRun,
   createStepInput,
   runScore,
   step,
   type CleanRun,
} from "./rules";

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
   const standIns = useLitterStandIns();

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
            <DynamicInstancedModel
               key={kind}
               asset={LITTER_ASSET[k]}
               count={PER_KIND}
               update={placeKind(k)}
               fallbackParts={standIns[k]}
               name={`litter-${kind}`}
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

// ---------- the cleaner ----------

const LIMB_Q = new Quaternion();
const LIMB_E = new Euler();
const RESOLVED = new Float32Array(BONE_COUNT * 4);
const ARM_Q = new Quaternion();
const ARM_DIR = new Vector3();
const DOWN = new Vector3(0, -1, 0);

function boneEuler(pose: HumanoidPose, bone: number): Euler {
   const o = bone * 4;
   LIMB_Q.set(pose.q[o], pose.q[o + 1], pose.q[o + 2], pose.q[o + 3]);
   return LIMB_E.setFromQuaternion(LIMB_Q, "XYZ");
}

/**
 * The stand-in is built arms-down. Hanging leg bones swing on x; each arm hangs along its arm's
 * direction in the chest's frame (the rig's own, resolvePose: hanging, swinging, reaching down to a
 * piece, up in the cheer), and the body leans forward with the stoop of a pickup.
 */
function applyRunnerLimbs(pose: HumanoidPose, limbs: RunnerLimbs): void {
   const { legL, legR, armL, armR, bob } = limbs;
   if (legL) {
      const e = boneEuler(pose, BONE.upperLegL);
      legL.rotation.set(-e.x, 0, e.z);
   }
   if (legR) {
      const e = boneEuler(pose, BONE.upperLegR);
      legR.rotation.set(-e.x, 0, e.z);
   }
   resolvePose(pose, CLEANER_LANDMARKS.armSpread, RESOLVED);
   // the stand-in faces +z with its armL at -x: that is the character's right arm (its left is +x)
   if (armL) poseArm(BONE.clavicleR, BONE.upperArmR, -1, armL);
   if (armR) poseArm(BONE.clavicleL, BONE.upperArmL, 1, armR);
   if (bob) bob.rotation.x = boneEuler(pose, BONE.spine).x + boneEuler(pose, BONE.chest).x * 0.5;
}

/** Points a stand-in arm (built hanging along -y) where the rig's upper arm points: clavicle x upper arm x (side, 0, 0). */
function poseArm(clavicle: number, bone: number, side: number, arm: Group): void {
   const c = clavicle * 4;
   const u = bone * 4;
   ARM_Q.set(RESOLVED[c], RESOLVED[c + 1], RESOLVED[c + 2], RESOLVED[c + 3]);
   LIMB_Q.set(RESOLVED[u], RESOLVED[u + 1], RESOLVED[u + 2], RESOLVED[u + 3]);
   ARM_DIR.set(side, 0, 0).applyQuaternion(LIMB_Q).applyQuaternion(ARM_Q);
   arm.quaternion.setFromUnitVectors(DOWN, ARM_DIR);
}

/**
 * The cleaner (cleaner.glb, this game's character): idle when still, a walk or a run whose stride
 * keeps the planted foot still (gait.ts), a stoop down to each piece it picks up (pickup.ts: knees
 * and back bent, the nearer hand reaching for where the piece lay, the soles on the floor), and a
 * cheer when a map is cleared and on the win (poseWeights.ts: eased in, held, eased out quickly
 * through level). cleaner.glb (auto-rigged) takes the pose; the primitive, shown while it loads or if
 * it fails, moves with the same pose.
 */
function Cleaner({ run }: { run: CleanRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const limbs = useRef<RunnerLimbs>({ legL: null, legR: null, armL: null, armR: null, bob: null });
   const [gait] = useState(createCleanerGait);
   const fx = useRef<PickupMark>(createPickupMark());
   const [scratch] = useState(createPose);
   const [local] = useState<LocalOffset>(() => ({ x: 0, z: 0 }));
   const pose = useHumanoidPose((p) => {
      const t = time.now;
      const r = run.runner;
      const store = useArcadeStore.getState();
      const { phase, endReason } = store;
      // the rules keep the last velocity once the run is over: the cleaner stops there. While playing
      // the phase steps by the play time the rules moved the runner (FRAME_PRIORITY.pose runs after
      // the simulation, so frameMs is this frame's), never the longer animation delta
      stepCleanerGait(gait, phase === "playing" ? Math.hypot(r.vx, r.vz) : 0, gaitFrameDt(store, time.delta));
      walkPose(gait.phase, gait.amount, p);
      blendPoses(p, idlePose(t, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      // a map's 20th piece or the win: a cheer; any other pickup: a stoop to where that piece lay (pickup.ts)
      const mark = notePickup(fx.current, run, t, phase === "over" && endReason === "win", local);
      const won = mark.won;
      const reach = reachWeight(t - mark.reachAt);
      const cheer = cheerWeight(t - mark.cheerAt, won);
      if (reach > 0.001) {
         localOffset(mark.pieceX - r.x, mark.pieceZ - r.z, r.heading, local);
         pickupPose(p, reach, mark.side, local.x, local.z, scratch);
      }
      if (cheer > 0.001) blendPoses(p, cheerPose(t, scratch), cheer, p);
      gait.lift = bodyLift(p, CLEANER_LANDMARKS) * CLEANER_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      if (!g || !b) return;
      const r = run.runner;
      const t = time.now;
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      g.position.set(r.x, 0, r.z);
      g.rotation.y = won ? g.rotation.y + time.delta * 4 : r.heading;
      b.position.y = standIn.current
         ? won ? Math.abs(Math.sin(t * 7)) * 0.2 : Math.abs(Math.sin(gait.phase)) * 0.04 * gait.amount
         : gait.lift;
      // the stand-in's limbs only while it is drawn (HumanoidModel resolves the pose for cleaner.glb)
      if (standIn.current) applyRunnerLimbs(pose, limbs.current);
   });

   return (
      <group ref={root} name="cleaner">
         <BlobShadow radius={0.42} />
         <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
            <ringGeometry args={[0.46, 0.58, 24]} />
            <meshBasicMaterial color={RUNNER_RING} transparent opacity={0.85} depthWrite={false} />
         </mesh>
         <group ref={body}>
            <HumanoidModel
               asset={ASSETS.cleaner}
               pose={pose}
               applyLift={false}
               fallback={<group ref={standIn}><PrimitiveRunner limbs={limbs} /></group>}
            />
         </group>
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
            <ParkDecor run={run} />
         </group>
         <group ref={city} visible={false} name="map-city">
            <City />
            <CityDecor />
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
            camera={{ position: view.offset, fov: FOV, lookAt: LOOK_AT }}
            follow={run.runner}
            followFraction={FOLLOW}
            bounds={REACH}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         <mesh rotation-x={-Math.PI / 2} position={[START_PAD.x, 0.03, START_PAD.z]} name="start-pad">
            <ringGeometry args={[0.9, 1.12, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
         </mesh>
         <Worlds run={run} />
         <Litter run={run} fx={fx} />
         <Cleaner run={run} />
      </>
   );
}
