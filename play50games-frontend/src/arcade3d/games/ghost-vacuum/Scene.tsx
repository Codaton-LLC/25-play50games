"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { isMuted, playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { markerBounds, placeMarker, type MarkerPlacement } from "@/arcade3d/core/hud/markerPlacement";
import { useInput } from "@/arcade3d/core/input";
import { Flashlight } from "@/arcade3d/core/kit";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced } from "@/arcade3d/core/render";
import { HumanoidModel, gaitPhaseStep, useHumanoidPose, wrapPhase } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useQuality } from "@/arcade3d/core/quality";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import type { ScreenRect } from "@/arcade3d/core/view";
import { ASSETS, HUNTER_SCALE } from "./assets";
import { viewFor } from "./camera";
import Ghosts from "./Ghosts";
import Mansion from "./Mansion";
import { hunterPose } from "./poses";
import { HunterPrimitive } from "./Primitives";
import Vacuum, { type VacuumHandle } from "./Vacuum";
import { pickGhost, type AimRay } from "./aim";
import { active, createRun, LIGHT, PULL, ROOMS, stepRun, type Run, type StepInput } from "./rules";

function underRects(x: number, y: number, rects: readonly ScreenRect[] | undefined): boolean {
   if (!rects) return false;
   for (const r of rects) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
   return false;
}

function Hunter({ run }: { run: Run }) {
   const quality = useQuality();
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const time = useGameTime(), root = useRef<Group>(null), nozzle = useRef<Group>(null), torch = useRef<Group>(null), suction = useRef<Group>(null);
   const hose = useRef<VacuumHandle>(null);
   const [gait] = useState(() => ({ phase: 0 }));
   const [beam] = useState(() => ({ origin: new Vector3(), tip: new Vector3(), yaw: 0 }));
   const pose = useHumanoidPose((p) => {
      const playing = useArcadeStore.getState().phase === "playing";
      const h = run.hunter, v = playing ? Math.hypot(h.vx, h.vz) : 0, amount = Math.min(1, v / 4);
      const sign = h.vx * Math.sin(h.yaw) + h.vz * Math.cos(h.yaw) < -0.01 ? -1 : 1;
      gait.phase = wrapPhase(gait.phase + sign * gaitPhaseStep(amount, RUNNER_LANDMARKS, HUNTER_SCALE, v, time.delta, 4));
      hunterPose(gait.phase, amount, run.won, time.now, p);
   });
   useFrame(() => {
      if (root.current) { root.current.position.set(run.hunter.x, 0, run.hunter.z); root.current.rotation.y = run.hunter.yaw; }
      if (nozzle.current) {
         nozzle.current.updateWorldMatrix(true, false);
         nozzle.current.localToWorld(beam.origin.set(-0.23, 0, 0));
         nozzle.current.localToWorld(beam.tip.set(-0.33, 0, 0));
         beam.yaw = Math.atan2(beam.tip.x - beam.origin.x, beam.tip.z - beam.origin.z);
      } else {
         beam.origin.set(run.hunter.x, 0.9, run.hunter.z); beam.yaw = run.hunter.yaw;
      }
      if (torch.current) { torch.current.position.copy(beam.origin); torch.current.rotation.y = beam.yaw; }
      if (suction.current) { suction.current.position.copy(beam.origin); suction.current.rotation.y = beam.yaw; suction.current.visible = run.scratch.input.held; }
      hose.current?.update();
   });
   return <>
      <group ref={root} name="hunter"><BlobShadow radius={0.4} y={0.03} />
         <HumanoidModel asset={ASSETS.hunter} pose={pose} fallback={<HunterPrimitive />}
            attach={{ chest: <Vacuum ref={hose} nozzle={nozzle} />, handR: <group ref={nozzle}>
               <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.055, 0.25, 10]} /><meshStandardMaterial color="#c4b5fd" /></mesh>
            </group> }} />
      </group>
      <Flashlight ref={torch} halfAngle={LIGHT.angle} range={LIGHT.range} height={0} color="#fde68a" opacity={0.16} light />
      <Flashlight ref={suction} halfAngle={PULL.angle} range={PULL.range} height={0} color="#c4b5fd" opacity={0.32} light={false} />
      <DynamicInstanced count={36} update={(i, m) => {
         if (!run.scratch.input.held || reduced || (quality.tier === "low" && i >= 12)) return false;
         const q = 1 - ((time.now * 1.4 + i / 36) % 1), distance = 0.15 + q * 3.6;
         const angle = beam.yaw + Math.sin(i * 2.4) * PULL.angle * q;
         const size = 0.025 + 0.015 * q;
         m.makeScale(size, size, size).setPosition(beam.origin.x + Math.sin(angle) * distance, beam.origin.y * (1 - q) + 0.6 * q, beam.origin.z + Math.cos(angle) * distance);
      }}><sphereGeometry args={[1, 4, 3]} /><meshBasicMaterial color="#ddd6fe" transparent opacity={0.8} depthWrite={false} /></DynamicInstanced>
   </>;
}

export default function Scene() {
   const width = useThree((s) => s.size.width), height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height)), input = useInput(), fx = useFx();
   const safe = useSafeArea();
   const [run] = useState(() => createRun(randomSeed()));
   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, held: false, aim: false, aimYaw: Math.PI, coarse: typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches } as StepInput,
      dir: { x: 0, z: 0 }, at: { x: 0, y: 0, z: 0 }, ray: new Raycaster(), floor: new Plane(new Vector3(0, 1, 0), -0.6), hit: new Vector3(), aimRay: { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 } as AimRay,
      pointer: new Vector2(), pointerX: 0, pointerY: 0, moved: false, loop: null as LoopHandle | null, ambient: null as LoopHandle | null,
      loopOptions: { volume: 0, pitch: 0.8 }, ambientOptions: { volume: 0.08 }, sfxOptions: { pan: 0, volume: 0.35, pitch: 1 }, lastSecond: -1, projected: new Vector3(), hunterScreen: new Vector3(), metre: new Vector3(), placement: { visible: false, x: 0, y: 0, angle: 0 } as MarkerPlacement,
      targets: Array.from({ length: 12 }, () => ({ x: 0, y: 1, z: 0, hidden: true })),
   }));
   const bounds = useMemo(() => markerBounds({ ...safe, width, height }), [safe, width, height]);
   useFrame(({ camera }) => {
      camera.updateMatrixWorld();
      scratch.hunterScreen.set(run.hunter.x, 0.8, run.hunter.z).project(camera);
      scratch.metre.set(run.hunter.x + 1.5, 0.8, run.hunter.z).project(camera);
      const clearance = Math.max(36, Math.abs(scratch.metre.x - scratch.hunterScreen.x) * width / 2);
      const hx = (scratch.hunterScreen.x + 1) * width / 2, hy = (1 - scratch.hunterScreen.y) * height / 2;
      for (const g of run.ghosts) {
         const target = scratch.targets[g.id];
         target.hidden = !active(g);
         if (target.hidden) continue;
         scratch.projected.set(target.x, target.y, target.z).applyMatrix4(camera.matrixWorldInverse);
         const behind = scratch.projected.z > 0;
         scratch.projected.applyMatrix4(camera.projectionMatrix);
         placeMarker(scratch.projected.x, scratch.projected.y, behind, width, height, bounds, scratch.placement);
         if (scratch.placement.visible && Math.hypot(scratch.placement.x - hx, scratch.placement.y - hy) < clearance) target.hidden = true;
      }
   }, -0.01);
   useEffect(() => {
      fx.warm("sparkle", "confetti", "score");
      return useArcadeStore.subscribe((state, previous) => {
         if (state.phase !== previous.phase || state.phase !== "playing" || isMuted()) { scratch.loop = null; scratch.ambient = null; }
      });
   }, [fx, scratch]);
   useRunFrame((state, dt, elapsed) => {
      const i = input.current, s = scratch.step;
      inputToWorld(i.moveX, i.moveY, view.yaw, scratch.dir);
      s.dirX = scratch.dir.x; s.dirZ = scratch.dir.z; s.held = i.action || i.jump;
      const px = (i.pointer.x + 1) * width / 2, py = (1 - i.pointer.y) * height / 2;
      const blocked = underRects(px, py, safe.hud) || underRects(px, py, safe.controls) || underRects(px, py, safe.obstructions);
      if (!blocked && (i.pointer.x !== scratch.pointerX || i.pointer.y !== scratch.pointerY)) scratch.moved = true;
      scratch.pointerX = i.pointer.x; scratch.pointerY = i.pointer.y;
      s.aim = !s.coarse && scratch.moved;
      if (s.aim && !blocked) {
         scratch.pointer.set(i.pointer.x, i.pointer.y);
         scratch.ray.setFromCamera(scratch.pointer, state.camera);
         // A pointer over a drawn ghost aims at that ghost (its face sits ~0.4 m above
         // the y0.6 plane, which skews close-range aim past the 12-degree pull cone).
         const r = scratch.ray.ray, aimRay = scratch.aimRay;
         aimRay.ox = r.origin.x; aimRay.oy = r.origin.y; aimRay.oz = r.origin.z; aimRay.dx = r.direction.x; aimRay.dy = r.direction.y; aimRay.dz = r.direction.z;
         const picked = pickGhost(aimRay, run.ghosts);
         if (picked >= 0) { const g = run.ghosts[picked], gx = g.mode === "pulling" ? g.baseX : g.x, gz = g.mode === "pulling" ? g.baseZ : g.z; s.aimYaw = Math.atan2(gx - run.hunter.x, gz - run.hunter.z); }
         else if (r.intersectPlane(scratch.floor, scratch.hit)) s.aimYaw = Math.atan2(scratch.hit.x - run.hunter.x, scratch.hit.z - run.hunter.z);
      }
      stepRun(run, s, dt, elapsed);
      const store = useArcadeStore.getState(), e = run.events;
      if (e.points) store.addScore(e.points);
      store.setStat("ghosts", run.caught);
      const second = Math.ceil(Math.max(0, 90 - elapsed));
      if (second !== scratch.lastSecond) { store.setStat("last", second); scratch.lastSecond = second; }
      store.setStat("waiting", elapsed >= 90 && run.ghosts[11].mode === "pending" ? 1 : 0);
      let progress = 0;
      for (const g of run.ghosts) {
         const target = scratch.targets[g.id], room = ROOMS[g.room];
         target.x = g.mode === "hidden" ? room.x : g.x; target.z = g.mode === "hidden" ? room.z : g.z; target.hidden = !active(g);
         progress = Math.max(progress, g.progress);
      }
      if (!isMuted()) {
         if (!scratch.loop) scratch.loop = startLoop("vacuum", scratch.loopOptions);
         if (!scratch.ambient) scratch.ambient = startLoop("ambient", scratch.ambientOptions);
         scratch.loopOptions.volume = s.held ? 0.35 : 0; scratch.loopOptions.pitch = 0.8 + 0.8 * progress;
         scratch.loop.set(scratch.loopOptions);
      } else { scratch.loop = null; scratch.ambient = null; }
      if (e.pop) {
         let nearest = Infinity;
         for (const g of run.ghosts) if (active(g) && g.mode !== "hidden") {
            const d = Math.hypot(g.x - run.hunter.x, g.z - run.hunter.z);
            if (d < nearest) { nearest = d; scratch.sfxOptions.pan = Math.sin(Math.atan2(g.x - run.hunter.x, g.z - run.hunter.z) - view.yaw); }
         }
         scratch.sfxOptions.pitch = 1; playSfx("pop", scratch.sfxOptions);
      } if (e.stun) playSfx("zap"); if (e.breaks) playSfx("hit");
      for (let n = 0; n < e.count; n++) {
         const g = run.ghosts[e.captures[n]];
         scratch.at.x = g.x; scratch.at.y = 1.3; scratch.at.z = g.z;
         fx.burst("sparkle", scratch.at, 18);
         scratch.sfxOptions.pan = Math.sin(run.hunter.yaw - view.yaw);
         scratch.sfxOptions.pitch = 1 + Math.min(0.4, Math.max(0, run.session - 1, e.count - 1) * 0.1);
         playSfx("pickup", scratch.sfxOptions);
      }
      if (e.count) { scratch.at.x = run.hunter.x; scratch.at.z = run.hunter.z; scratch.at.y = 1.9; fx.score(scratch.at, `+${e.points}`); }
      if (e.win) { store.setScore(run.score); fx.burst("confetti", scratch.at, 40); store.end("win"); }
   });
   return <>
      <CameraRig camera={{ position: view.offset, lookAt: [0, 0, 0] }} follow={run.hunter} followFraction={1} offset={view.offset} shift={view.shift} damping={4} />
      <Mansion run={run} /><Ghosts run={run} /><Hunter run={run} />
      <TargetMarkers targets={scratch.targets} size={24} color="#c4b5fd" />
   </>;
}
