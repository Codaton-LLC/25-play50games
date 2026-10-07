"use client";

// Tiny Escape Room. One rules.step() per playing frame, then the room is drawn from that run.
// Time game: end("win") only when the rules say the door finished. GameShell scores it.
// Tap inspects the badge that is on screen (input.tap, on release). A miss does not fall
// through to the E / Enter nearest-target key. E and the action button use actionPressed.
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3, type Group, type MeshBasicMaterial, type PerspectiveCamera } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
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
   reachPose,
   useHumanoidPose,
   walkPose,
   walkStride,
   wrapPhase,
   type HumanoidLandmarks,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { PrimitiveRunner, Room, createMoving, type RunnerLimbs } from "./Primitives";
import { groundRingScale } from "./marker";
import { BADGE_LOOK, BADGE_PX, MARKER_PX, badgeShowsLoot, hitsBillboard, screenSpriteSize } from "./picker";
import { armDirection, legDirection, reachSide, type Dir3 } from "./standIn";
import {
   DOOR_ID,
   DOOR_POSITION,
   NONE,
   RUNNER,
   createRun,
   createStepInput,
   step,
   targetInReach,
   type EscapeRun,
} from "./rules";

const PITCH = (55 * Math.PI) / 180;
const YAW = (30 * Math.PI) / 180;
const ROOM_FOCUS: [number, number, number] = [0, 0.5, 0];
const FOCUS = [{ x: 0, y: 0.5, z: 0 }];
/** Physical guard: floor, walls, furniture and the door through every opening pose. */
const ROOM_BOX: AABB = {
   min: { x: -6.2, y: -0.15, z: -5.2 },
   max: { x: 6.2, y: 2.3, z: 5.2 },
};
const VIEW: FittedViewOptions = {
   area: ROOM_BOX,
   pitch: PITCH,
   yaws: [YAW],
   focus: FOCUS,
   margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
   padding: 24,
   shift: true,
   fov: 45,
};

const BADGE_Y = 1.2;
/** A tap that missed the badge. Not null, so it does not fall through to the nearest-target key. */
const MISSED_TAP = 99;

const RAY = new Raycaster();
const TAP = new Vector2();
const RIGHT = new Vector3();
const UP = new Vector3();
const FORWARD = new Vector3();
const NORMAL = new Vector3();
const BADGE = new Vector3();
const TMP = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

function anchorOf(run: EscapeRun, id: number): { x: number; z: number } {
   return id === DOOR_ID ? DOOR_POSITION : run.layout.stations[id];
}

/** Camera-facing square at the anchor. Writes BADGE and the billboard axes. Returns the world side. */
function placeBadge(camera: PerspectiveCamera, canvasHeight: number, x: number, z: number, cssPx: number): number {
   camera.getWorldDirection(FORWARD);
   BADGE.set(x, BADGE_Y, z);
   const depth = FORWARD.dot(TMP.copy(BADGE).sub(camera.position));
   NORMAL.copy(camera.position).sub(BADGE);
   if (NORMAL.lengthSq() < 1e-8) NORMAL.copy(FORWARD).multiplyScalar(-1);
   else NORMAL.normalize();
   RIGHT.crossVectors(WORLD_UP, NORMAL);
   if (RIGHT.lengthSq() < 1e-8) RIGHT.set(1, 0, 0);
   else RIGHT.normalize();
   UP.crossVectors(NORMAL, RIGHT).normalize();
   return screenSpriteSize(Math.abs(depth), camera.fov, canvasHeight, cssPx);
}

const Simulation = memo(function Simulation({ run, yaw }: { run: EscapeRun; yaw: number }) {
   const input = useInput();
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const height = useThree((s) => s.size.height);
   const [scratch] = useState(() => ({ dir: { x: 0, z: 0 }, input: createStepInput(), hint: -1, mask: -1, found: -1 }));

   useLayoutEffect(() => {
      const store = useArcadeStore.getState();
      store.setStat("found", 0);
      store.setStat("mask", 0);
      store.setStat("hint", 0);
   }, []);

   useRunFrame((_state, dt) => {
      const now = input.current;
      inputToWorld(now.moveX, now.moveY, yaw, scratch.dir);
      const frame = scratch.input;
      frame.moveX = scratch.dir.x;
      frame.moveY = scratch.dir.z;
      frame.actionPressed = now.actionPressed;
      const tap = now.tap;
      if (tap) {
         const id = targetInReach(run);
         let hit = false;
         if (id !== NONE) {
            const anchor = anchorOf(run, id);
            const side = placeBadge(camera, height, anchor.x, anchor.z, BADGE_PX);
            TAP.set(tap.x, tap.y);
            RAY.setFromCamera(TAP, camera);
            const o = RAY.ray.origin;
            const d = RAY.ray.direction;
            hit = hitsBillboard(
               o.x, o.y, o.z, d.x, d.y, d.z,
               BADGE.x, BADGE.y, BADGE.z,
               NORMAL.x, NORMAL.y, NORMAL.z,
               RIGHT.x, RIGHT.y, RIGHT.z,
               UP.x, UP.y, UP.z,
               side / 2,
            );
         }
         frame.tappedTarget = hit ? id : MISSED_TAP;
      } else frame.tappedTarget = null;

      const ev = step(run, dt * 1000, frame);
      const store = useArcadeStore.getState();
      if (ev.found !== NONE) {
         store.setStat("found", run.found);
         store.setStat("mask", run.foundMask);
         playSfx("pickup");
      }
      let hint = 0;
      if (run.message === "locked") hint = 1;
      else if (run.message === "empty") hint = 2;
      else if (run.action.kind === "open") hint = 3;
      else if (run.action.kind === "retrieve") hint = 4;
      else if (run.action.kind === "door") hint = 5;
      if (hint !== scratch.hint) {
         scratch.hint = hint;
         store.setStat("hint", hint);
      }
      if (ev.ended === "win") store.end("win");
      else if (ev.ended === "timeup") store.end("timeup");
   });

   return null;
});

/** The 44 px tap target. Over an opened container's loot it turns see-through, so the loot shows. */
function Badge({ run }: { run: EscapeRun }) {
   const mesh = useRef<Group>(null);
   const fill = useRef<MeshBasicMaterial>(null);
   const ring = useRef<MeshBasicMaterial>(null);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const height = useThree((s) => s.size.height);
   useFrame(() => {
      const g = mesh.current;
      if (!g) return;
      const id = targetInReach(run);
      g.visible = id !== NONE;
      if (id === NONE) return;
      const anchor = anchorOf(run, id);
      const side = placeBadge(camera, height, anchor.x, anchor.z, BADGE_PX);
      g.position.copy(BADGE);
      g.lookAt(camera.position);
      g.scale.set(Math.max(side, 0.001), Math.max(side, 0.001), 1);
      const take = badgeShowsLoot(run, id);
      if (fill.current) fill.current.opacity = take ? BADGE_LOOK.takeFill : BADGE_LOOK.fill;
      if (ring.current) ring.current.opacity = take ? BADGE_LOOK.takeRing : BADGE_LOOK.ring;
   });
   return (
      <group ref={mesh} name="inspect-badge">
         <mesh>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={fill} color="#eab308" transparent opacity={BADGE_LOOK.fill} depthWrite={false} />
         </mesh>
         <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.28, 0.42, 20]} />
            <meshBasicMaterial ref={ring} color="#fffbeb" transparent opacity={BADGE_LOOK.ring} depthWrite={false} />
         </mesh>
      </group>
   );
}

/** Robot joints until runner.glb is measured; a later full landmark set on the shared asset replaces them. */
const RUNNER_LEGS: HumanoidLandmarks = { ...ROBOT_LANDMARKS, ...SHARED_ASSETS.runner.humanoid?.landmarks };
const RUNNER_SCALE = SHARED_ASSETS.runner.scale ?? 1;
const MIN_STRIDE = 0.1;
const DOWN = new Vector3(0, -1, 0);
const LIMB_DIR: Dir3 = { x: 0, y: -1, z: 0 };
const LIMB_V = new Vector3();

function aimLimb(limb: Group, dir: Dir3): void {
   limb.quaternion.setFromUnitVectors(DOWN, LIMB_V.set(dir.x, dir.y, dir.z).normalize());
}

/** The stand-in is built limbs-down; each limb points along its rig bone (arms in a V on the win, out to the side in a reach). */
function applyRunnerLimbs(pose: HumanoidPose, limbs: RunnerLimbs): void {
   const { legL, legR, armL, armR } = limbs;
   if (legL) aimLimb(legL, legDirection(pose, 1, LIMB_DIR));
   if (legR) aimLimb(legR, legDirection(pose, -1, LIMB_DIR));
   if (armL) aimLimb(armL, armDirection(pose, 1, RUNNER_LEGS.armSpread, LIMB_DIR));
   if (armR) aimLimb(armR, armDirection(pose, -1, RUNNER_LEGS.armSpread, LIMB_DIR));
}

/**
 * The shared runner: idle when still, a walk whose stride keeps the planted foot still, a reach
 * toward the station or door while an action runs, and a cheer on the win. runner.glb is not in
 * the manifest, so the primitive shows and moves with the same pose. The ground marker stays 24 px.
 */
function Runner({ run }: { run: EscapeRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const marker = useRef<Group>(null);
   const limbs = useRef<RunnerLimbs>({ legL: null, legR: null, armL: null, armR: null, bob: null });
   const gait = useRef({ phase: 0, amount: 0, lift: 0, heading: Math.PI, reach: 0, cheer: 0, side: -1 as 1 | -1 });
   const [scratch] = useState(createPose);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const t = time.now;
      const player = run.player;
      const v = Math.hypot(player.vx, player.vz);
      const g = gait.current;
      g.amount += (Math.min(1, v / RUNNER.speed) - g.amount) * (1 - Math.exp(-12 * dt));
      const stride = Math.max(MIN_STRIDE, walkStride(g.amount, RUNNER_LEGS) * RUNNER_SCALE);
      g.phase = wrapPhase(g.phase + (v * dt / stride) * Math.PI * 2);
      if (v > RUNNER.speed * 0.2) g.heading = Math.atan2(player.vx, player.vz);
      const acting = run.action.kind !== "none";
      if (acting) {
         const id = run.action.target;
         const target = id === DOOR_ID ? DOOR_POSITION : run.layout.stations[id];
         // the arm on the target's side (rig L = +x local), for the stand-in and for runner.glb alike
         g.side = reachSide(g.heading, target.x - player.x, target.z - player.z);
      }
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      g.reach += ((acting && !won ? 1 : 0) - g.reach) * (1 - Math.exp(-10 * dt));
      g.cheer += ((won ? 1 : 0) - g.cheer) * (1 - Math.exp(-8 * dt));
      walkPose(g.phase, g.amount, p);
      blendPoses(p, idlePose(t, scratch), 1 - Math.min(1, g.amount * 5), p, POSE_MASK.upper);
      if (g.reach > 0.001) blendPoses(p, reachPose(g.side, 0.55, scratch), g.reach, p, POSE_MASK.upper);
      if (g.cheer > 0.001) blendPoses(p, cheerPose(t, scratch), g.cheer, p);
      g.lift = bodyLift(p, RUNNER_LEGS) * RUNNER_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      const b = body.current;
      if (!g || !b) return;
      const player = run.player;
      const t = time.now;
      const walk = gait.current;
      const { phase, endReason } = useArcadeStore.getState();
      const won = phase === "over" && endReason === "win";
      g.position.set(player.x, 0, player.z);
      g.rotation.y = won ? g.rotation.y + time.delta * 4 : walk.heading;
      b.position.y = standIn.current
         ? won ? Math.abs(Math.sin(t * 7)) * 0.2 : Math.abs(Math.sin(walk.phase)) * 0.04 * walk.amount
         : walk.lift;
      applyRunnerLimbs(pose, limbs.current);
      const mark = marker.current;
      if (mark) {
         const scale = groundRingScale(camera, player.x, 0.03, player.z, MARKER_PX, width, height);
         mark.position.set(player.x, 0.03, player.z);
         mark.scale.set(scale, scale, 1);
      }
   });

   return (
      <>
         <group ref={marker} rotation-x={-Math.PI / 2} name="runner-marker">
            <mesh>
               <ringGeometry args={[0.35, 0.5, 20]} />
               <meshBasicMaterial color="#eab308" transparent opacity={0.9} depthWrite={false} />
            </mesh>
         </group>
         <group ref={root} name="runner">
            <BlobShadow radius={0.4} />
            <group ref={body}>
               <HumanoidModel
                  asset={SHARED_ASSETS.runner}
                  pose={pose}
                  applyLift={false}
                  fallback={<group ref={standIn}><PrimitiveRunner limbs={limbs} /></group>}
               />
            </group>
         </group>
      </>
   );
}

export default function Scene() {
   const view = useFittedView(VIEW);
   const [run] = useState(() => createRun(randomSeed()));
   const [moving] = useState(() => ({ current: createMoving() }));
   const position = useMemo<[number, number, number]>(() => [
      ROOM_FOCUS[0] + view.offset[0],
      ROOM_FOCUS[1] + view.offset[1],
      ROOM_FOCUS[2] + view.offset[2],
   ], [view.offset]);

   return (
      <>
         <Simulation run={run} yaw={view.yaw} />
         <CameraRig
            camera={{ position, fov: 45, lookAt: ROOM_FOCUS }}
            offset={view.offset}
            shift={view.shift}
         />
         <Room run={run} moving={moving} />
         <Badge run={run} />
         <Runner run={run} />
      </>
   );
}
