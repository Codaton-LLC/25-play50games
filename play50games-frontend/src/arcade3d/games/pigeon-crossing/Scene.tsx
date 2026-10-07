"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, type Group, type Matrix4, type Mesh } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, Model, useModel } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import {
   COVER_HEIGHT, FOLLOW_DAMPING, FOV, LOOK_AT, STREET_VIEW, configureStreetView,
   createHorizon, createStreetCache, fallbackVertices, fillStreet, modelVertices, pigeonHull,
   maximumRows, viewGate, type StreetCache, type Horizon,
   createPigeonPose, writePigeonPose, placePigeon,
} from "./camera";
import { useStreetGate } from "./Hud";
import { COLORS, PigeonPrimitive, useStreetParts, type StreetParts } from "./Primitives";
import { COVER_INNER_X, HOP_MS, LANE_SLOTS, NONE, ROW_PITCH, VEHICLE_SLOTS, createRun, step, type PigeonRun } from "./rules";
import { VEHICLE_ASSETS, vehicleFacing } from "./traffic";

const POSITION = new Vector3(), ONE = new Vector3(1, 1, 1);
const CAMERA = { position: [0, 29.711, 17.204] as [number, number, number], lookAt: LOOK_AT, fov: FOV };

interface Layout {
   cache: StreetCache;
   horizon: Horizon;
   follow: { x: number; y: number; z: number };
   fx: { landMs: number; crashAt: number };
}

function createLayout(): Layout {
   return { cache: createStreetCache(), horizon: createHorizon(), follow: { x: 0, y: 0, z: LOOK_AT[2] }, fx: { landMs: -1000, crashAt: -1 } };
}

/** Geometry/pool preparation only: frozen refits never advance the clock or restart traffic. */
function fillVisible(run: PigeonRun, layout: Layout, camera: PerspectiveCamera): boolean {
   return fillStreet(run, layout.cache, layout.horizon, camera);
}

const Simulation = memo(function Simulation({ run, layout }: { run: PigeonRun; layout: Layout }) {
   const input = useInput();
   const camera = useThree((state) => state.camera);
   useRunFrame((_state, dt) => {
      if (!(camera instanceof PerspectiveCamera)) return;
      if (!fillVisible(run, layout, camera)) {
         // A transient resized projection must never alias visible slots. Pause before step.
         useStreetGate.getState().setReason("pool");
         useArcadeStore.getState().pause();
         return;
      }
      const events = step(run, dt * 1000, input.current);
      layout.follow.z = run.player.z + LOOK_AT[2];
      const store = useArcadeStore.getState();
      if (events.hopStarted) playSfx("jump");
      if (events.landedRow !== NONE) layout.fx.landMs = run.timeMs;
      if (events.delta) store.addScore(events.delta);
      if (events.levelChanged !== NONE) { store.setStat("level", events.levelChanged); store.setLevel(events.levelChanged); playSfx("pickup"); }
      if (events.ended) { store.end(events.ended); if (events.ended === "lose") playSfx("hit"); }
   });
   return null;
});

/** The only safe-area subscriber: HUD chip changes cannot re-render the Scene or its pools. */
const StreetCamera = memo(function StreetCamera({ run, layout }: { run: PigeonRun; layout: Layout }) {
   const width = useThree((state) => state.size.width), height = useThree((state) => state.size.height);
   const camera = useThree((state) => state.camera);
   const phase = useArcadeStore((state) => state.phase);
   const coarse = useCoarsePointer();
   const view = useFittedView(STREET_VIEW);
   const { scene } = useModel(ASSETS.pigeon);
   const hull = useMemo(() => pigeonHull(scene ? modelVertices(scene) : fallbackVertices()), [scene]);
   const gate = useMemo(() => {
      configureStreetView(layout.cache, view, width, height);
      const result = viewGate(layout.cache.targetCamera, layout.cache.target, hull, height, coarse, layout.cache.scratch.point);
      const old = layout.cache.previous, target = layout.cache.target;
      // Keep the previous fitted horizon during a refit, even when the new view is smaller.
      const union = { valid: old.valid && target.valid, minX: Math.min(old.minX, target.minX), maxX: Math.max(old.maxX, target.maxX), minZ: Math.min(old.minZ, target.minZ), maxZ: Math.max(old.maxZ, target.maxZ) };
      if (!result.reason && maximumRows(union) > LANE_SLOTS) result.reason = "pool";
      return result;
      // The core can return a fresh view with identical numbers after a HUD chip changes width.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [layout, width, height, view.distance, view.shift[0], view.shift[1], hull, coarse]);

   useLayoutEffect(() => {
      useStreetGate.getState().setReason(gate.reason);
      if (camera instanceof PerspectiveCamera && !gate.reason) fillVisible(run, layout, camera);
   }, [camera, gate, layout, run]);
   useEffect(() => {
      if (gate.reason && (phase === "countdown" || phase === "playing")) useArcadeStore.getState().pause();
   }, [gate.reason, phase]);
   useEffect(() => () => useStreetGate.getState().setReason(null), []);
   // The shared camera is this run's only once CameraRig has placed it at the pigeon, in its mount
   // effect: a passive effect, so after a Retry remount a frame can run first with the camera still
   // where the last run ended (from level 3 on, rows 0..60+ exceed the 40 slots: every such Retry
   // opened Paused). Passive mount effects run children first, so this one follows the rig's
   // placement. Until then the frame checks below leave the pools alone (the fitted-view gate still
   // pauses); step() cannot run (countdown, and Simulation's own fill check pauses before a step).
   const placed = useRef(false);
   useEffect(() => { placed.current = true; }, []);

   // Pool preparation precedes RunClock, so an invalid resized view pauses before any dt is
   // counted. This never steps gameplay; the default-priority Simulation remains its only step.
   useFrame(() => {
      if (!(camera instanceof PerspectiveCamera)) return;
      if (gate.reason) {
         const state = useArcadeStore.getState();
         if (state.phase === "playing" || state.phase === "countdown") state.pause();
         return;
      }
      if (!placed.current) return;
      if (!fillVisible(run, layout, camera)) {
         useStreetGate.getState().setReason("pool");
         const state = useArcadeStore.getState();
         if (state.phase === "playing" || state.phase === "countdown") state.pause();
      }
   }, FRAME_PRIORITY.clock - 0.01);

   // After the shared rig, before pool visuals. A paused resize also pre-fills before first paint.
   useFrame(() => {
      if (!(camera instanceof PerspectiveCamera) || gate.reason || !placed.current) return;
      if (!fillVisible(run, layout, camera)) {
         useStreetGate.getState().setReason("pool");
         const state = useArcadeStore.getState();
         if (state.phase === "playing" || state.phase === "countdown") state.pause();
      }
   }, FRAME_PRIORITY.camera + 0.01);
   return <CameraRig camera={CAMERA} follow={layout.follow} followFraction={1} offset={view.offset} shift={view.shift} damping={phase === "over" ? 0 : FOLLOW_DAMPING} />;
});

const Rows = memo(function Rows({ run, parts }: { run: PigeonRun; parts: StreetParts }) {
   const road = useCallback((i: number, matrix: Matrix4) => { const lane = run.lanes[i]; if (lane.row === NONE || !lane.road) return false; matrix.makeTranslation(0, 0, -lane.row * ROW_PITCH); }, [run]);
   const grass = useCallback((i: number, matrix: Matrix4) => { const lane = run.lanes[i]; if (lane.row === NONE || lane.road) return false; matrix.makeTranslation(0, 0, -lane.row * ROW_PITCH); }, [run]);
   const row = useCallback((i: number, matrix: Matrix4) => { const lane = run.lanes[i]; if (lane.row === NONE) return false; matrix.makeTranslation(0, 0, -lane.row * ROW_PITCH); }, [run]);
   const dashed = useCallback((i: number, matrix: Matrix4) => { const lane = run.lanes[i]; if (lane.row === NONE || !lane.road || lane.localRow % 3 !== 1 || lane.localRow === 19) return false; matrix.makeTranslation(0, 0, -lane.row * ROW_PITCH); }, [run]);
   return (
      <group name="street-rows">
         <DynamicInstanced count={LANE_SLOTS} update={road} parts={parts.road} name="roads" />
         <DynamicInstanced count={LANE_SLOTS} update={grass} parts={parts.grass} name="grass" />
         <DynamicInstanced count={LANE_SLOTS} update={row} parts={parts.curbs} name="curbs" />
         <DynamicInstanced count={LANE_SLOTS} update={dashed} parts={parts.markings} name="lane-markings" />
         <DynamicInstanced count={LANE_SLOTS} update={grass} parts={parts.grassMarks} name="grass-marks" />
      </group>
   );
});

const VehiclePool = memo(function VehiclePool({ run, kind, parts }: { run: PigeonRun; kind: number; parts: StreetParts }) {
   const update = useCallback((i: number, matrix: Matrix4) => {
      const vehicle = run.vehicles[i];
      if (!vehicle.active || vehicle.kind !== kind) return false;
      matrix.compose(POSITION.set(vehicle.x, 0, vehicle.z), vehicleFacing(vehicle.direction), ONE);
   }, [run, kind]);
   return <DynamicInstancedModel asset={VEHICLE_ASSETS[kind]} count={VEHICLE_SLOTS} update={update} fallbackParts={parts.vehicles[kind]} name={`traffic-${VEHICLE_ASSETS[kind].id}`} />;
});

const SideCover = memo(function SideCover({ layout }: { layout: Layout }) {
   const left = useRef<Mesh>(null), right = useRef<Mesh>(null);
   useFrame(() => {
      const h = layout.horizon, width = Math.max(0.1, h.coverX - COVER_INNER_X), length = Math.max(1, h.coverMaxZ - h.coverMinZ), z = (h.coverMaxZ + h.coverMinZ) / 2;
      if (left.current) { left.current.position.set(-COVER_INNER_X - width / 2, COVER_HEIGHT / 2, z); left.current.scale.set(width, COVER_HEIGHT, length); }
      if (right.current) { right.current.position.set(COVER_INNER_X + width / 2, COVER_HEIGHT / 2, z); right.current.scale.set(width, COVER_HEIGHT, length); }
   });
   return (
      <group name="opaque-side-cover">
         <mesh ref={left}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={COLORS.cover} roughness={0.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} /></mesh>
         <mesh ref={right}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={COLORS.cover} roughness={0.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} /></mesh>
      </group>
   );
});

const Pigeon = memo(function Pigeon({ run, layout }: { run: PigeonRun; layout: Layout }) {
   const time = useGameTime();
   const root = useRef<Group>(null), body = useRef<Group>(null), shadow = useRef<Group>(null);
   const [pose] = useState(createPigeonPose);
   useFrame(() => {
      if (!root.current || !body.current || !shadow.current) return;
      const state = useArcadeStore.getState();
      const crashed = state.phase === "over" && state.endReason === "lose";
      if (crashed && layout.fx.crashAt < 0) layout.fx.crashAt = time.now;
      // Tiny whole-body head bob and tuck: rigid transforms, no wing/skeleton animation.
      writePigeonPose(run.hop.active ? Math.min(1, run.hop.elapsedMs / HOP_MS) : -1,
         run.timeMs - layout.fx.landMs, crashed ? (time.now - layout.fx.crashAt) * 1000 : -1, pose);
      placePigeon(run.player, pose, root.current, body.current, shadow.current);
   });
   return (
      <>
         <group ref={shadow}><BlobShadow radius={0.35} opacity={0.28} /></group>
         <group ref={root} name="pigeon"><group ref={body}><Model asset={ASSETS.pigeon} fallback={<PigeonPrimitive />} /></group></group>
      </>
   );
});

export default function Scene() {
   const [run] = useState(() => createRun(randomSeed()));
   const [layout] = useState(createLayout);
   const parts = useStreetParts();
   const reported = useRef(false);
   useEffect(() => {
      if (!reported.current) { reported.current = true; useArcadeStore.getState().setStat("level", 1); }
   }, []);
   return (
      <>
         <Simulation run={run} layout={layout} />
         <StreetCamera run={run} layout={layout} />
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.11, -8000]} name="background-grass"><planeGeometry args={[160, 20000]} /><meshStandardMaterial color={COLORS.grass} roughness={1} /></mesh>
         <Rows run={run} parts={parts} />
         <VehiclePool run={run} kind={0} parts={parts} />
         <VehiclePool run={run} kind={1} parts={parts} />
         <VehiclePool run={run} kind={2} parts={parts} />
         <SideCover layout={layout} />
         <Pigeon run={run} layout={layout} />
      </>
   );
}
