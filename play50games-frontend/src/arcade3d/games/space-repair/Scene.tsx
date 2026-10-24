"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { markerBounds, placeMarker } from "@/arcade3d/core/hud/markerPlacement";
import { markerHitsSuit, MARKER_SIZE } from "./markerVisibility";
import { useMuted, playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { Starfield } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import Astronaut from "./Astronaut";
import RepairCamera from "./camera";
import { liveHud } from "./liveHud";
import { COLORS } from "./palette";
import { CLOCK, createRun, MODULES, REPAIR, stageAt, stepRun } from "./rules";
import Station from "./Station";

export default function Scene() {
   const area = useSafeArea();
   const input = useInput(), time = useGameTime(), fx = useFx(), quality = useQuality();
   const phase = useArcadeStore((s) => s.phase), muted = useMuted();
   const loop = useRef<LoopHandle | null>(null), stars = useRef<Group>(null);
   const [run] = useState(() => createRun(randomSeed(), typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches));
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [markers] = useState(() => Array.from({ length: 11 }, () => ({ x: 0, y: 1.3, z: 0, hidden: true, color: COLORS.accent as string })));
   const [scratch] = useState(() => ({
      project: new Vector3(), suit: { left: 0, right: 0, top: 0, bottom: 0 },
      placement: { visible: false, x: 0, y: 0, angle: 0 },
      controls: { x: 0, z: 0, repair: false }, direction: { x: 0, z: 0 }, at: { x: 0, y: 1.3, z: 0 },
      loop: { volume: 0, pitch: 1 }, sound: { volume: 0.12, pan: 0 }, scoreOptions: { color: COLORS.mint },
      contactSound: { volume: 0.25 }, lapSound: { volume: 0.15 },
      lastPuff: -1, lastSpark: -1, lastBuzz: -1, sparkSlot: 0, feedback: 0, feedbackUntil: 0,
   }));
   useEffect(() => {
      liveHud.run = run; fx.warm("puff", "sparks", "sparkle", "confetti", "score");
      return () => { if (liveHud.run === run) liveHud.run = null; };
   }, [run, fx]);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const handle = startLoop("thrust", { volume: 0 }); loop.current = handle;
      return () => { handle.stop(); if (loop.current === handle) loop.current = null; };
   }, [phase, muted]);
   useRunFrame((_, dt) => {
      const i = input.current;
      inputToWorld(i.moveX, i.moveY, 0, scratch.direction);
      scratch.controls.x = scratch.direction.x; scratch.controls.z = scratch.direction.z;
      scratch.controls.repair = i.actionPressed || i.jumpPressed;
      stepRun(run, scratch.controls, dt);
      const store = useArcadeStore.getState(), ev = run.events;
      scratch.at.x = run.body.x; scratch.at.y = 1.3; scratch.at.z = run.body.z;
      if (ev.hit) { playSfx("thud"); scratch.feedback = 5; scratch.feedbackUntil = run.time + 0.8; }
      if (ev.miss) { playSfx("hit"); scratch.feedback = 3; scratch.feedbackUntil = run.time + 1.2; }
      if (ev.contact) { playSfx("hit", scratch.contactSound); if (!reduced) fx.shake(0.15); }
      if (ev.lap) playSfx("click", scratch.lapSound);
      if (ev.award) {
         store.addScore(ev.award);
         scratch.at.x = MODULES[ev.module].x; scratch.at.z = MODULES[ev.module].z;
         playSfx(ev.award === 150 ? "combo" : "chime");
         if (!reduced) { fx.burst("sparks", scratch.at, 16); fx.burst("sparkle", scratch.at, 10); fx.shake(0.1); }
         fx.score(scratch.at, ev.award === 150 ? "+150 PERFECT" : "+100 REPAIRED", scratch.scoreOptions);
         scratch.feedback = ev.award === 150 ? 2 : 1; scratch.feedbackUntil = run.time + 1.2;
      }
      if (ev.cell) { playSfx("pickup"); scratch.feedback = 4; scratch.feedbackUntil = run.time + 1.2; if (!reduced) fx.burst("sparkle", run.body, 12); }
      if (ev.alarm) playSfx("alarm");
      if (run.thrusting && run.time - scratch.lastPuff >= 1 / 6) {
         if (!reduced) fx.burst("puff", run.body, 2); scratch.lastPuff = run.time;
      }
      if (run.time - scratch.lastSpark >= 0.25) {
         scratch.lastSpark = run.time;
         for (let n = 0; n < 8; n++) {
            const id = scratch.sparkSlot; scratch.sparkSlot = (scratch.sparkSlot + 1) % 8;
            if (!run.modules[id].broken) continue;
            const m = MODULES[id]; scratch.at.x = m.x; scratch.at.z = m.z;
            if (!reduced) fx.burst("sparks", scratch.at, 3);
            if (run.time - scratch.lastBuzz >= 0.75) {
               scratch.sound.pan = Math.max(-1, Math.min(1, Math.sin(Math.atan2(m.x - run.body.x, m.z - run.body.z))));
               playSfx("buzz", scratch.sound); scratch.lastBuzz = run.time;
            }
            break;
         }
      }
      scratch.loop.volume = run.thrusting ? 0.25 : 0;
      scratch.loop.pitch = 0.9 + 0.3 * Math.hypot(run.body.vx, run.body.vz) / 7;
      loop.current?.set(scratch.loop);
      const stats = store.stats, docked = run.docked, module = docked < 0 ? null : run.modules[docked];
      const power = Math.floor(run.power), remaining = Math.ceil(CLOCK.duration - run.time), waiting = module && run.time < module.lockUntil ? 1 : 0;
      if (stats.power !== power) store.setStat("power", power);
      if (stats.remaining !== remaining) store.setStat("remaining", remaining);
      if (stats.repairs !== run.repairs) store.setStat("repairs", run.repairs);
      if (stats.docked !== docked) store.setStat("docked", docked);
      if (stats.waiting !== waiting) store.setStat("waiting", waiting);
      if (stats.hits !== (module?.hits ?? 0)) store.setStat("hits", module?.hits ?? 0);
      if (stats.required !== (docked < 0 ? 0 : REPAIR.hits[docked])) store.setStat("required", docked < 0 ? 0 : REPAIR.hits[docked]);
      const feedback = run.time < scratch.feedbackUntil ? scratch.feedback : 0;
      if (stats.feedback !== feedback) store.setStat("feedback", feedback);
      if (store.level !== stageAt(run.time) + 1) store.setLevel(stageAt(run.time) + 1);
      if (run.terminal) {
         if (run.terminal === "win" && !reduced) fx.burst("confetti", run.body, 36);
         store.setStat("powerBonus", run.bonus); store.setScore(run.score); store.end(run.terminal);
      }
   });
   useFrame(({ camera, size }) => {
      if (stars.current && !reduced) stars.current.position.set(run.body.x * 0.05, 0, run.body.z * 0.05);
      camera.updateMatrixWorld();
      const { project, suit, placement } = scratch;
      suit.left = suit.top = Infinity; suit.right = suit.bottom = -Infinity;
      // Enclose all suit headings, reaching arms, bobbing and the fallback model.
      for (let corner = 0; corner < 8; corner++) {
         project.set(run.body.x + (corner & 1 ? 1.1 : -1.1), corner & 2 ? 2.4 : 0.1, run.body.z + (corner & 4 ? 1.1 : -1.1)).project(camera);
         const x = (project.x + 1) * size.width / 2, y = (1 - project.y) * size.height / 2;
         suit.left = Math.min(suit.left, x); suit.right = Math.max(suit.right, x);
         suit.top = Math.min(suit.top, y); suit.bottom = Math.max(suit.bottom, y);
      }
      const bounds = markerBounds({ ...area, width: size.width, height: size.height });
      for (let j = 0; j < 11; j++) {
         const marker = markers[j];
         if (j < 8) { marker.x = MODULES[j].dx; marker.z = MODULES[j].dz; marker.hidden = !run.modules[j].broken; }
         else { const c = run.cells[j - 8]; marker.x = c.x; marker.z = c.z; marker.hidden = !c.active; marker.color = COLORS.gold; }
         if (!marker.hidden) {
            project.set(marker.x, marker.y, marker.z).applyMatrix4(camera.matrixWorldInverse);
            const behind = project.z > 0; project.applyMatrix4(camera.projectionMatrix);
            placeMarker(project.x, project.y, behind, size.width, size.height, bounds, placement);
            marker.hidden = placement.visible && markerHitsSuit(placement, suit);
         }
      }
   });
   return <>
      <RepairCamera run={run} />
      <group ref={stars}><Starfield count={quality.tier === "low" ? 200 : 600} seed={1818} /></group>
      <Station run={run} reduced={reduced} />
      <Astronaut run={run} reduced={reduced} />
      <TargetMarkers targets={markers} size={MARKER_SIZE} color={COLORS.accent} />
   </>;
}
