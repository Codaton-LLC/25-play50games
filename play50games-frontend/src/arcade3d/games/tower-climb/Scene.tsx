"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, type Group, type Matrix4, type Mesh } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import { sameScreenRects, useSafeArea, type SafeArea } from "@/arcade3d/core/safeArea";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import {
   HumanoidModel, POSE_MASK, blendPoses, bodyLift, cheerPose, createPose, idlePose, jumpPose, useHumanoidPose, walkPose,
} from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, RUNNER_SCALE } from "./assets";
import { AREA, FOLLOW_DAMPING, FOV, LOOK_AT, VIEW } from "./camera";
import { RUNNER_ORDER, RunnerPrimitive, useTowerParts, type TowerParts } from "./Primitives";
import { CHECKPOINT, MOVING, NONE, POOLS, RUNNER, STATIC, createRun, createStepInput, readStepInput, step, type TowerRun } from "./rules";
import { createRunnerGait, stepRunnerGait } from "./runnerGait";
import { createVisualState, runnerFootY, writeCoin, writeFlag, writeSection, writeSlab, writeSpur, type VisualState } from "./visuals";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (changed: () => void) => {
   const query = window.matchMedia(MOTION_QUERY); query.addEventListener("change", changed);
   return () => query.removeEventListener("change", changed);
};
const readMotion = () => window.matchMedia(MOTION_QUERY).matches;
const noMotion = () => false;

const Simulation = memo(function Simulation({ run, visual }: { run: TowerRun; visual: VisualState }) {
   const input = useInput();
   const [controls] = useState(createStepInput);
   useRunFrame((_state, dt) => {
      const events = step(run, dt * 1000, readStepInput(input.current, controls));
      const store = useArcadeStore.getState();
      if (events.delta) store.addScore(events.delta);
      if (events.height !== NONE) store.setStat("height", events.height);
      if (events.jumped) playSfx("jump");
      if (events.coin !== NONE) playSfx("pickup");
      if (events.checkpoint !== NONE) {
         visual.checkpointMs = run.timeMs;
         store.setStat("checkpoint", events.checkpoint);
      }
      if (events.hit) { store.setStat("fallen", 1); playSfx("hit"); }
      if (events.ended) store.end(events.ended);
   });
   return null;
});

const TowerCamera = memo(function TowerCamera({ run }: { run: TowerRun }) {
   const view = useFittedView(VIEW);
   const active = useThree(s => s.camera);
   useLayoutEffect(() => {
      if (active instanceof PerspectiveCamera) { active.near = 0.1; active.far = 400; active.updateProjectionMatrix(); }
   }, [active]);
   const camera = useMemo(() => ({ position: view.offset, lookAt: LOOK_AT, fov: FOV }), [view.offset]);
   return <CameraRig camera={camera} follow={run.cameraTarget} followFraction={1} offset={view.offset} shift={view.shift} damping={FOLLOW_DAMPING} />;
});

const SlabPool = memo(function SlabPool({ run, kind, parts }: { run: TowerRun; kind: number; parts: TowerParts }) {
   const update = useCallback((i: number, matrix: Matrix4) => {
      const slot = run.slabs[i];
      if (slot.kind !== kind) return false;
      return writeSlab(run, slot, matrix);
   }, [run, kind]);
   return <DynamicInstancedModel asset={kind === STATIC ? ASSETS.slab : kind === MOVING ? ASSETS.movingSlab : ASSETS.ledge}
      count={POOLS.slabs} update={update} fallbackParts={kind === STATIC ? parts.slab : kind === MOVING ? parts.moving : parts.ledge}
      name={kind === STATIC ? "static-slabs" : kind === MOVING ? "moving-slabs" : "checkpoint-ledges"} />;
});

const SpurPool = memo(function SpurPool({ run, visual, parts, cracked, reduced }: {
   run: TowerRun; visual: VisualState; parts: TowerParts; cracked: boolean; reduced: boolean;
}) {
   const time = useGameTime();
   const update = useCallback((i: number, matrix: Matrix4) => writeSpur(run, run.spurs[i], cracked, visual, time.now, reduced, matrix, useArcadeStore.getState().phase), [run, cracked, visual, time, reduced]);
   return <DynamicInstancedModel asset={ASSETS.spur} count={POOLS.spurs} update={update}
      fallbackParts={cracked ? parts.cracked : parts.intact} name={cracked ? "cracking-spurs" : "intact-spurs"} />;
});

const Coins = memo(function Coins({ run, parts, reduced }: { run: TowerRun; parts: TowerParts; reduced: boolean }) {
   const time = useGameTime();
   const update = useCallback((i: number, matrix: Matrix4) => writeCoin(run, run.coins[i], time.now, reduced, matrix), [run, time, reduced]);
   return <DynamicInstancedModel asset={ASSETS.coin} count={POOLS.coins} update={update} fallbackParts={parts.coin} name="coins" />;
});

const Flags = memo(function Flags({ run, parts }: { run: TowerRun; parts: TowerParts }) {
   const update = useCallback((i: number, matrix: Matrix4) => writeFlag(run, run.flags[i], matrix), [run]);
   return <DynamicInstancedModel asset={ASSETS.flag} count={POOLS.flags} update={update} fallbackParts={parts.flag} name="checkpoint-flags" />;
});

const Tower = memo(function Tower({ run, parts }: { run: TowerRun; parts: TowerParts }) {
   const gl = useThree(s => s.gl);
   const update = useCallback((i: number, matrix: Matrix4) => writeSection(run, run.sections[i], matrix), [run]);
   useLayoutEffect(() => {
      const previous = gl.localClippingEnabled; gl.localClippingEnabled = true;
      return () => { gl.localClippingEnabled = previous; };
   }, [gl]);
   useFrame(() => {
      parts.planes[0].constant = -run.viewBottomY;
      parts.planes[1].constant = run.maxHeight + 4;
   }, FRAME_PRIORITY.camera + 0.01);
   return <DynamicInstanced count={POOLS.sections} update={update} parts={parts.tower} name="tower-panels" />;
});

/**
 * The shared runner on the core auto-rig (<HumanoidModel> + useHumanoidPose), 0.55 m tall through
 * ASSETS.runner.scale: the walk by its own ground motion (runnerGait.ts: amount and phase eased, no
 * running in place at the x bound or on a moving slab), jumpPose in the air, the cheer on a new
 * checkpoint, the body's lift on its own group. While runner.glb is missing it is the rigid stand-in,
 * animated from the same gait. It draws after a depth reset (RUNNER_ORDER), whole in front of the
 * slab it stands under: the next slab's clearance (0.29-0.39 m) is less than its height.
 */
const Runner = memo(function Runner({ run, visual, parts }: { run: TowerRun; visual: VisualState; parts: TowerParts }) {
   const time = useGameTime();
   const root = useRef<Group>(null), body = useRef<Group>(null), standIn = useRef<Group>(null), shadow = useRef<Group>(null);
   const [gait] = useState(createRunnerGait);
   const [scratch] = useState(createPose);
   // FRAME_PRIORITY.pose: after the step moved the runner, before the useFrame below reads the lift
   const pose = useHumanoidPose(p => {
      const phase = useArcadeStore.getState().phase;
      if (phase === "paused" || (phase === "over" && !run.pendingLose)) return;
      stepRunnerGait(gait, run, phase === "playing", time.delta, visual.checkpointMs);
      walkPose(gait.phase, gait.amount, p);
      // nearly still: the idle's breath in the upper body (the legs keep the walk's)
      blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper);
      if (gait.air > 0.001) blendPoses(p, jumpPose(gait.tuck, scratch), gait.air, p);
      if (gait.cheer > 0.001) blendPoses(p, cheerPose((run.timeMs - visual.checkpointMs) / 1000, scratch), gait.cheer, p, POSE_MASK.arms);
      gait.lift = bodyLift(p, RUNNER_LANDMARKS) * RUNNER_SCALE;
   });
   useFrame(() => {
      if (!root.current || !body.current || !shadow.current) return;
      const phase = useArcadeStore.getState().phase, foot = runnerFootY(run, visual, phase, time.now);
      root.current.position.set(run.pendingLose ? run.loss.x : run.player.x, foot, 0);
      root.current.rotation.y = gait.heading;
      root.current.visible = !run.pendingLose || foot >= run.viewBottomY - 1.55;
      // the GLB rises and falls with its planted foot; the rigid stand-in bobs with its stride
      body.current.position.y = standIn.current !== null
         ? Math.abs(Math.sin(gait.phase)) * 0.012 * gait.amount * (1 - gait.air) : gait.lift;
      shadow.current.visible = run.player.grounded && !run.pendingLose;
      shadow.current.position.set(run.player.x, run.player.y + 0.012, 0);
   });
   return (
      <>
         <group ref={shadow}><BlobShadow radius={0.25} opacity={0.3} /></group>
         <group ref={root} name="runner"><group ref={body}>
            {/* the group above carries the body's lift, so the model does not add it again */}
            <HumanoidModel asset={ASSETS.runner} pose={pose} applyLift={false} renderOrder={RUNNER_ORDER}
               fallback={<group ref={standIn} renderOrder={RUNNER_ORDER}><RunnerPrimitive parts={parts} gait={gait} /></group>}>
               <primitive object={parts.depthReset} dispose={null} />
            </HumanoidModel>
         </group></group>
      </>
   );
});

const DangerStrip = memo(function DangerStrip({ run }: { run: TowerRun }) {
   const mesh = useRef<Mesh>(null);
   useFrame(() => { if (mesh.current) mesh.current.position.y = run.viewBottomY; });
   return <mesh ref={mesh} position-z={0.32}><boxGeometry args={[4.6, 0.035, 0.03]} />
      <meshBasicMaterial color="#ec725d" transparent opacity={0.55} depthWrite={false} /></mesh>;
});

const selectControls = (area: SafeArea) => area.controls;
const selectObstructions = (area: SafeArea) => area.obstructions;
const selectHudBottom = (area: SafeArea) => {
   let bottom = 0; for (const rect of area.hud) bottom = Math.max(bottom, rect.bottom); return bottom;
};

/** Development measurements only, never a fit/size gate. Core owns the actual fit. */
function FitProbe({ run }: { run: TowerRun }) {
   const controls = useSafeArea(selectControls, sameScreenRects);
   const obstructions = useSafeArea(selectObstructions, sameScreenRects);
   const hudBottom = useSafeArea(selectHudBottom);
   const camera = useThree(s => s.camera), size = useThree(s => s.size), gl = useThree(s => s.gl);
   const [probe] = useState(() => ({ run, point: new Vector3(), calls: 0, maxCalls: 0, geometries: 0,
      runnerPx: 0, columnLeft: 0, columnRight: 0, columnTop: 0, columnBottom: 0, frames: 0, warned: false, logged: false }));
   useEffect(() => {
      const debug = window as typeof window & { __towerProbe?: typeof probe }; debug.__towerProbe = probe;
      return () => { if (debug.__towerProbe === probe) delete debug.__towerProbe; };
   }, [probe]);
   useEffect(() => { probe.warned = false; probe.logged = false; probe.frames = 0; }, [probe, controls, obstructions, hudBottom, size]);
   useFrame(() => {
      if (!(camera instanceof PerspectiveCamera)) return;
      probe.calls = gl.info.render.calls; probe.maxCalls = Math.max(probe.maxCalls, probe.calls); probe.geometries = gl.info.memory.geometries; probe.frames++;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (let xi = 0; xi < 2; xi++) for (let yi = 0; yi < 2; yi++) for (let zi = 0; zi < 2; zi++) {
         probe.point.set(xi ? AREA.max.x : AREA.min.x, run.maxHeight + (yi ? AREA.max.y : AREA.min.y), zi ? AREA.max.z : AREA.min.z).project(camera);
         const x = (probe.point.x + 1) * size.width / 2, y = (1 - probe.point.y) * size.height / 2;
         left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      probe.columnLeft = left; probe.columnRight = right; probe.columnTop = top; probe.columnBottom = bottom;
      probe.point.set(run.player.x, run.player.y, 0).project(camera); const feet = probe.point.y;
      probe.point.set(run.player.x, run.player.y + RUNNER.height, 0).project(camera); probe.runnerPx = (probe.point.y - feet) * size.height / 2;
      if (!probe.logged && probe.frames > 180) {
         probe.logged = true;
         console.info("[tower-climb] calls/peak/geometries, viewport W/H, runner px, column L/R/T/B:",
            probe.calls, probe.maxCalls, probe.geometries, size.width, size.height, probe.runnerPx, left, right, top, bottom);
      }
      // Diagnostics report only after refits settle, never pause a run or change simulation dt.
      if (!probe.warned && probe.frames > 180) {
         let covered = top < hudBottom + 7;
         for (const rect of controls) covered ||= right > rect.left - 7 && left < rect.right + 7 && bottom > rect.top - 7 && top < rect.bottom + 7;
         for (const rect of obstructions) covered ||= right > rect.left - 7 && left < rect.right + 7 && bottom > rect.top - 7 && top < rect.bottom + 7;
         if (covered) { probe.warned = true; console.warn("[tower-climb] fitted column touches UI; check the core refit and live safe rectangles"); }
      }
   });
   return null;
}

export default function Scene() {
   const [run] = useState(() => createRun(randomSeed()));
   const [visual] = useState(createVisualState);
   const parts = useTowerParts();
   const reduced = useSyncExternalStore(subscribeMotion, readMotion, noMotion);
   const gl = useThree(s => s.gl), scene = useThree(s => s.scene), camera = useThree(s => s.camera);
   useLayoutEffect(() => {
      const store = useArcadeStore.getState(); store.setStat("height", 0); store.setStat("checkpoint", 0); store.setStat("fallen", 0);
      gl.compile(scene, camera);
   }, [gl, scene, camera]);
   return (
      <>
         <Simulation run={run} visual={visual} />
         <TowerCamera run={run} />
         <Tower run={run} parts={parts} />
         <SlabPool run={run} kind={STATIC} parts={parts} />
         <SlabPool run={run} kind={MOVING} parts={parts} />
         <SlabPool run={run} kind={CHECKPOINT} parts={parts} />
         <SpurPool run={run} visual={visual} parts={parts} cracked={false} reduced={reduced} />
         <SpurPool run={run} visual={visual} parts={parts} cracked reduced={reduced} />
         <Coins run={run} parts={parts} reduced={reduced} />
         <Flags run={run} parts={parts} />
         <Runner run={run} visual={visual} parts={parts} />
         <DangerStrip run={run} />
         {process.env.NODE_ENV !== "production" && <FitProbe run={run} />}
      </>
   );
}
