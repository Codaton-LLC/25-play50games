"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, Object3D } from "three";
import { createAxisAim, followRelativeDrag, type AxisAimOptions } from "@/arcade3d/core/aim";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import { useActionPop, useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { EyeRig } from "@/arcade3d/core/EyeRig";
import { DynamicInstanced } from "@/arcade3d/core/render/DynamicInstanced";
import { applyLook, MATERIAL_CACHE, type LookUse } from "@/arcade3d/core/materials";
import { randomSeed } from "@/arcade3d/core/math";
import { hop, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import type { ModelAsset } from "@/arcade3d/core/types";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useEyeShift } from "@/arcade3d/core/useEyeShift";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, EXHIBIT_LOOK, SARCOPHAGUS_SPOTS, statueAsset } from "./assets";
import { GUIDE, hintCode, hintFor } from "./guide";
import { useMuseumLevel } from "./useMuseumLevel";
import { SoftBeam } from "./Beam";
import Gallery from "./Gallery";
import { BAND, COLORS, EYE, EYE_Y, FOV, MARGIN, PADDING, radarRect } from "./looks";
import { StatueFallback } from "./Primitives";
import {
   BEAM,
   DRAG_PX_PER_TURN,
   FLASH,
   liveRun,
   RING,
   TURN_RATE,
   TYPES,
   beamHalfFor,
   createRun,
   stepGame,
   wrapAngle,
   type ExhibitKind,
   type Run,
} from "./rules";

const INDEXES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const DRAG: AxisAimOptions = {
   holdDelay: 0.25,
   x: { min: -Infinity, max: Infinity, step: 0.01, rate: TURN_RATE, dragGain: TURN_RATE / DRAG_PX_PER_TURN },
   y: { min: 0, max: 0, step: 0, rate: 0, dragGain: 0 },
};
const SCUFFLE: Record<ExhibitKind, number> = { knight: 0.72, robot: 0.95, penguin: 1.28, dino: 0.55 };
const MARKER = [{ x: 0, y: 1.3, z: 6, hidden: true }];

let meshCount = 0;
function tally(object: Object3D) {
   if ((object as Mesh).isMesh) meshCount += 1;
}

function rest(out: BodyOffset) {
   out.y = 0;
   out.roll = 0;
   out.yaw = 0;
   out.squash = 1;
}

function releaseLooks(held: { current: LookUse | null }) {
   held.current?.forEach((_material, key) => MATERIAL_CACHE.release(key));
   held.current = null;
}

function secondsLeft(run: Run, index: number): number {
   const ex = run.exhibits[index];
   const ped = run.pedestals[ex.pedestal];
   const dist = Math.hypot(ex.x - ped.exitX, ex.z - ped.exitZ);
   const speed = ex.coast > 0 ? ex.coastSpeed : TYPES[ex.kind].speed * run.level.speed[run.phase];
   return (dist - BEAM.alarm) / Math.max(0.05, speed);
}

function StatueView({ index, run, asset }: { index: number; run: Run; asset: ModelAsset }) {
   const ref = useRef<Group>(null);
   const body = useRef<BodyOffset>({ y: 0, roll: 0, yaw: 0, squash: 1 });
   const applied = useRef({ mode: "", n: -1 });
   const held = useRef<LookUse | null>(null);
   const time = useGameTime();
   const ex = run.exhibits[index];

   useEffect(() => () => releaseLooks(held), []);

   useFrame(() => {
      const group = ref.current;
      if (!group) return;
      meshCount = 0;
      group.traverse(tally);
      if (meshCount > 0 && (ex.mode !== applied.current.mode || meshCount !== applied.current.n)) {
         const next = applyLook(group, EXHIBIT_LOOK[ex.kind][ex.mode], undefined);
         releaseLooks(held);
         next.forEach((material, key) => MATERIAL_CACHE.retain(key, material));
         held.current = next;
         applied.current.mode = ex.mode;
         applied.current.n = meshCount;
      }
      const moving = ex.mode === "sneaking" || ex.mode === "returning";
      const pose = body.current;
      if (!moving) rest(pose);
      else if (ex.kind === "penguin") waddle(time.now * 8 + index, 0.22, pose);
      else if (ex.kind === "dino") {
         rest(pose);
         pose.yaw = Math.sin(time.now * 3 + index) * 0.14;
      } else hop(time.now * 9 + index, 0.06, pose);
      group.position.set(ex.x, ex.foot + pose.y, ex.z);
      group.rotation.order = "YXZ";
      group.rotation.x = pose.roll;
      group.rotation.y = ex.face + pose.yaw;
      group.rotation.z = 0;
      group.scale.set(1, pose.squash, 1);
   });

   return (
      <group ref={ref}>
         <Model asset={asset} fallback={<StatueFallback kind={ex.kind} />} />
      </group>
   );
}

function FloorMarks({ run }: { run: Run }) {
   return (
      <>
         <DynamicInstanced
            count={RING.count}
            update={(i, matrix) => {
               const ex = run.exhibits[i];
               if (ex.mode !== "frozen") return false;
               matrix.makeRotationX(-Math.PI / 2);
               matrix.setPosition(ex.x, 0.05, ex.z);
            }}
         >
            <ringGeometry args={[0.28, 0.42, 20]} />
            <meshBasicMaterial color={COLORS.frozen} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced
            count={RING.count}
            update={(i, matrix) => {
               const ex = run.exhibits[i];
               matrix.makeRotationX(-Math.PI / 2);
               matrix.setPosition(ex.x, 0.02, ex.z);
            }}
         >
            <circleGeometry args={[0.36, 16]} />
            <meshBasicMaterial color={COLORS.shadow} transparent opacity={0.4} depthWrite={false} />
         </DynamicInstanced>
      </>
   );
}

export default function Scene() {
   const { id: levelId, config } = useMuseumLevel();
   const runId = useArcadeStore((s) => s.runId);
   const phase = useArcadeStore((s) => s.phase);
   const run = useMemo(() => createRun(randomSeed(), config), [runId, config]);
   const statues = useMemo(() => INDEXES.map((i) => statueAsset(run.exhibits[i].kind, i)), [run]);
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const hintCodeRef = useRef(-1);
   const time = useGameTime();
   const muted = useMuted();
   const coarse = useCoarsePointer();
   useEffect(() => {
      hintCodeRef.current = hintCode(run);
      GUIDE.set(hintFor(hintCodeRef.current, coarse));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const safe = useSafeArea();
   const banner = safe.obstructions.reduce((h, r) => Math.max(h, r.bottom - r.top), 0);
   const avoid = useMemo(() => [radarRect(width, height, banner)], [width, height, banner]);
   const eye = useEyeShift({ band: BAND, fov: FOV, eyeY: EYE_Y, margin: MARGIN, padding: PADDING, avoid });
   const [beamPhase, setBeamPhase] = useState<0 | 1 | 2>(0);
   const yawRef = useRef(0);
   const aim = useRef(createAxisAim(0, 0));
   const sizeRef = useRef({ width: 1, height: 1 });
   const coarseRef = useRef(false);
   const phaseRef = useRef(0);
   const ended = useRef(false);
   const lostAt = useRef(-1);
   const scuttle = useRef(new Float64Array(RING.count));
   const beamRef = useRef<Group>(null);
   const flashRef = useRef<Group>(null);
   const pulse = useRef<Mesh>(null);
   const pulseMat = useRef<MeshBasicMaterial>(null);
   sizeRef.current.width = width;
   sizeRef.current.height = height;
   coarseRef.current = coarse;

   useLayoutEffect(() => {
      if (flashRef.current) flashRef.current.visible = false;
      if (pulse.current) pulse.current.visible = false;
   }, []);

   useEffect(() => {
      liveRun.current = run;
      ended.current = false;
      lostAt.current = -1;
      scuttle.current.fill(0);
      aim.current.x = 0;
      yawRef.current = 0;
      phaseRef.current = 0;
      setBeamPhase(0);
      const store = useArcadeStore.getState();
      store.setStat("alarms", run.alarms);
      store.setStat("returns", 0);
      store.setStat("flash", 0);
      store.setStat("dawn", run.level.dawn);
      store.setStat("dawnCap", run.level.dawn);
      return () => {
         if (liveRun.current === run) liveRun.current = null;
      };
   }, [run]);

   useEffect(() => {
      fx.warm("sparkle", "confetti", "score");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing" || muted) return undefined;
      const loop = startLoop("ambient", { volume: 0.2 });
      return () => loop.stop();
   }, [phase, muted]);

   useRunFrame((_state, dt, elapsedS) => {
      const live = input.current;
      const dragging = coarseRef.current && followRelativeDrag(aim.current, live.drag, sizeRef.current.width, sizeRef.current.height, DRAG);
      stepGame(
         run,
         {
            moveX: dragging ? 0 : live.moveX,
            pointerX: coarseRef.current ? null : live.pointer.x,
            dragYaw: dragging ? wrapAngle(aim.current.x) : null,
            coarse: coarseRef.current,
            flash: live.actionPressed || live.jumpPressed,
         },
         dt,
         elapsedS,
         useArcadeStore.getState()
      );
      if (!dragging) aim.current.x = run.yaw;
      const code = hintCode(run);
      if (code !== hintCodeRef.current) {
         hintCodeRef.current = code;
         GUIDE.set(hintFor(code, coarseRef.current));
      }
      yawRef.current = run.yaw;
      if (run.phase !== phaseRef.current) {
         phaseRef.current = run.phase;
         setBeamPhase(run.phase);
      }
      const now = time.play;
      for (let i = 0; i < RING.count; i += 1) {
         const ex = run.exhibits[i];
         if (ex.mode === "sneaking" && now - scuttle.current[i] >= 0.5) {
            scuttle.current[i] = now;
            playSfx("click", { pan: Math.sin(wrapAngle(Math.atan2(ex.x, ex.z) - run.yaw)), pitch: SCUFFLE[ex.kind], volume: 0.35 });
         }
         if (ex.justFrozen) {
            playSfx("chime", { volume: 0.55 });
            fx.burst("sparkle", { x: ex.x, y: ex.foot + 0.9, z: ex.z });
         }
         if (ex.justHome) {
            playSfx("whoosh", { volume: 0.5 });
            if (ex.paid) fx.score({ x: ex.x, y: 1.5, z: ex.z }, "+50", { color: COLORS.frozen });
         }
         if (ex.justAlarm) {
            playSfx("alarm", { volume: 0.7 });
            pop.fail({ x: ex.x, y: 1.6, z: ex.z }, run.alarms > 0 ? `ALARM! ${run.alarms} left` : "ALARM! Night over", { shake: 0.4 });
         }
      }
      if (run.outcome && !ended.current) {
         ended.current = true;
         if (run.outcome === "win") {
            playSfx("chime", { pitch: 1.4, volume: 0.8 });
            fx.burst("confetti", { x: 0, y: 1.2, z: 2 });
         }
      }
   });

   useFrame(() => {
      if (beamRef.current) beamRef.current.rotation.y = run.yaw;
      if (flashRef.current) {
         flashRef.current.visible = run.flashLeft > 0;
         flashRef.current.rotation.y = run.flashYaw;
      }
      const mesh = pulse.current;
      const mat = pulseMat.current;
      if (mesh && mat) {
         if (run.outcome !== "lose") {
            mesh.visible = false;
            lostAt.current = -1;
         } else {
            if (lostAt.current < 0) lostAt.current = time.now;
            const k = Math.min(1, (time.now - lostAt.current) / 0.9);
            mesh.visible = true;
            mesh.scale.setScalar(1 + k * 8);
            mat.opacity = 0.42 * (1 - k);
         }
      }
      let best = -1;
      let left = Infinity;
      for (let i = 0; i < RING.count; i += 1) {
         if (run.exhibits[i].mode !== "sneaking") continue;
         const eta = secondsLeft(run, i);
         if (eta < left) {
            left = eta;
            best = i;
         }
      }
      const mark = MARKER[0];
      if (best < 0) mark.hidden = true;
      else {
         const ex = run.exhibits[best];
         mark.x = ex.x;
         mark.y = ex.foot + 1.1;
         mark.z = ex.z;
         mark.hidden = false;
      }
   });

   return (
      <>
         <EyeRig position={EYE} yaw={yawRef} fov={FOV} shift={eye.shift} />
         <Gallery yaw={yawRef} />
         {(levelId === 4 || levelId === 5) && (
            <InstancedModel asset={ASSETS.sarcophagus} spots={SARCOPHAGUS_SPOTS} fallback={null} />
         )}
         {INDEXES.map((i) => (
            <StatueView key={`${run.seed}-${i}`} index={i} run={run} asset={statues[i]} />
         ))}
         <FloorMarks run={run} />
         <SoftBeam ref={beamRef} halfAngle={beamHalfFor(config.beam, beamPhase, coarse)} range={BEAM.range} height={1.55} color={COLORS.beam} opacity={0.3} light intensity={24} />
         <group ref={flashRef}>
            <SoftBeam halfAngle={FLASH.half} range={BEAM.range} height={1.55} color={COLORS.flash} opacity={0.22} />
         </group>
         <mesh ref={pulse} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
            <ringGeometry args={[0.2, 0.5, 40]} />
            <meshBasicMaterial ref={pulseMat} color={COLORS.alarm} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
         </mesh>
         <TargetMarkers targets={MARKER} color={COLORS.sneak} />
      </>
   );
}

