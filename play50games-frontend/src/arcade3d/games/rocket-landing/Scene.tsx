"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Line, LineDashedMaterial, Color, type Group, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { isMuted, playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { Starfield } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, BELL, SUPPORT } from "./assets";
import RocketCamera from "./camera";
import Planet from "./Planet";
import { RocketPrimitive } from "./Primitives";
import { BODY, PLANETS, createRun, landingSafe, padVx, padX, stepRun } from "./rules";

const GOOD = new Color("#6ee7b7"), BAD = new Color("#fda4af");
export default function Scene() {
   const input = useInput(), time = useGameTime(), fx = useFx(), quality = useQuality();
   const phase = useArcadeStore((s) => s.phase), muted = useMuted();
   const loop = useRef<LoopHandle | null>(null), root = useRef<Group>(null), flame = useRef<Mesh>(null);
   const [run] = useState(() => createRun(randomSeed(), typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches));
   const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [scratch] = useState(() => ({ controls: { rotate: 0, thrust: false }, at: { x: 0, y: 0, z: 0 }, loopOptions: { volume: 0 }, lastSmoke: -1, lastWhoosh: -1, turning: false, impactNow: 0 }));
   const [markers] = useState(() => [{ x: 0, y: 2.08, z: 0 }]);
   const [guide] = useState(() => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 1.1, 0, 2.08, 1.1], 3));
      geometry.setAttribute("lineDistance", new Float32BufferAttribute([0, 1], 1));
      const material = new LineDashedMaterial({ color: "#fda4af", dashSize: 0.2, gapSize: 0.15, depthWrite: false });
      const line = new Line(geometry, material); line.frustumCulled = false;
      return line;
   });
   useEffect(() => {
      fx.warm("puff", "sparkle", "confetti", "score");
      return () => { guide.geometry.dispose(); guide.material.dispose(); };
   }, [fx, guide]);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const handle = startLoop("thrust", { volume: 0 }); loop.current = handle;
      return () => { handle.stop(); if (loop.current === handle) loop.current = null; };
   }, [phase, muted]);
   useRunFrame((_, dt) => {
      const i = input.current;
      scratch.controls.rotate = i.moveX;
      scratch.controls.thrust = i.jump || (!run.assist && i.moveY < -0.5);
      stepRun(run, scratch.controls, dt);
      const store = useArcadeStore.getState(), b = run.body, ev = run.events;
      scratch.at.x = b.x; scratch.at.y = b.y; scratch.at.z = 0.5;
      if (ev.crash || ev.award) scratch.impactNow = time.now;
      if (ev.crash) {
         fx.burst("sparkle", scratch.at, 24); fx.shake(0.3); playSfx("boom"); store.loseLife();
      }
      if (ev.award) {
         store.addScore(ev.award); playSfx("thud"); playSfx("chime"); fx.burst("puff", scratch.at, 16);
         scratch.at.y = b.y + BODY.radius + 0.35;
         fx.score(scratch.at, `+${ev.award} landing`, { color: "#6ee7b7" });
         if (run.award.soft >= 190 && run.award.centre >= 140) fx.burst("confetti", scratch.at, 24);
      }
      if (ev.lowFuel) playSfx("alarm");
      const turning = Math.abs(i.moveX) > 0.05;
      if (turning && !scratch.turning && time.play - scratch.lastWhoosh > 0.3) { playSfx("whoosh", { volume: 0.1 }); scratch.lastWhoosh = time.play; }
      scratch.turning = turning;
      scratch.loopOptions.volume = run.powered && !isMuted() ? 0.35 : 0;
      loop.current?.set(scratch.loopOptions);
      if (run.powered && time.play - scratch.lastSmoke >= 0.125) {
         const c = Math.cos(b.angle), s = Math.sin(b.angle), y = BELL.y - BODY.centre;
         scratch.at.x = b.x + c * BELL.x - s * y; scratch.at.y = b.y + s * BELL.x + c * y; scratch.at.z = BELL.z;
         fx.burst("puff", scratch.at, 3); scratch.lastSmoke = time.play;
      }
      const stats = store.stats;
      const fuel = Math.floor(100 * run.fuel / PLANETS[run.planet].fuel), vx = Math.round(10 * (b.vx - padVx(run.layouts[run.planet], run.planet, run.attemptTime))), vy = Math.round(10 * b.vy), tilt = Math.round(b.angle * 180 / Math.PI);
      if (stats.fuel !== fuel) store.setStat("fuel", fuel);
      if (stats.vx !== vx) store.setStat("vx", vx);
      if (stats.vy !== vy) store.setStat("vy", vy);
      if (stats.tilt !== tilt) store.setStat("tilt", tilt);
      const hold = run.mode === "landed" ? 1 : run.mode === "crashed" ? 2 : 0;
      if (stats.hold !== hold) store.setStat("hold", hold);
      if (ev.award) {
         store.setStat("award", ev.award); store.setStat("soft", run.award.soft); store.setStat("centre", run.award.centre); store.setStat("reserve", run.award.reserve);
      }
      if (store.level !== run.planet + 1) store.setLevel(run.planet + 1);
      if (run.terminal) { store.setScore(run.score); store.end(run.terminal); }
   });
   useFrame(() => {
      const b = run.body, g = root.current;
      if (g) {
         let angle = b.angle, x = b.x, y = b.y;
         if (run.mode === "landed") {
            const fraction = Math.min(1, (time.now - scratch.impactNow) / 0.7);
            angle *= 1 - fraction * fraction * (3 - 2 * fraction);
            const leftY = Math.sin(b.angle) * SUPPORT[0][0] + Math.cos(b.angle) * (SUPPORT[0][1] - BODY.centre);
            const rightY = Math.sin(b.angle) * SUPPORT[1][0] + Math.cos(b.angle) * (SUPPORT[1][1] - BODY.centre);
            const foot = SUPPORT[leftY < rightY ? 0 : 1];
            x = run.pivot.x - Math.cos(angle) * foot[0] + Math.sin(angle) * (foot[1] - BODY.centre);
            y = run.pivot.y - Math.sin(angle) * foot[0] - Math.cos(angle) * (foot[1] - BODY.centre);
         }
         g.position.set(x, y, 0); g.rotation.z = angle;
      }
      if (flame.current) { flame.current.visible = run.powered && phase === "playing"; flame.current.scale.y = reducedMotion ? 1 : 1 + 0.08 * Math.sin(time.now * 35); }
      const position = guide.geometry.getAttribute("position"), distances = guide.geometry.getAttribute("lineDistance");
      position.setXYZ(0, b.x, b.y - BODY.centre, 1.1); position.setXYZ(1, b.x, 2.08, 1.1); position.needsUpdate = true;
      distances.setX(1, Math.abs(b.y - BODY.centre - 2.08)); distances.needsUpdate = true;
      guide.material.color.copy(landingSafe(run, run.attemptTime) ? GOOD : BAD); guide.visible = run.mode === "flight";
      markers[0].x = padX(run.layouts[run.planet], run.planet, run.attemptTime);
   });
   return <>
      <RocketCamera run={run} />
      <Starfield count={scaledCount(600, quality.decor)} seed={71} />
      <Planet run={run} />
      <group ref={root} position={[run.body.x, run.body.y, 0]}>
         <group position={[0, -BODY.centre, 0]}>
            <Model asset={ASSETS.rocket} fallback={<RocketPrimitive />} />
            <group position={[BELL.x, BELL.y, BELL.z]}>
               <mesh ref={flame} position={[0, -0.4, 0]} rotation={[0, 0, Math.PI]} visible={false}>
                  <coneGeometry args={[0.16, 0.8, 12]} /><meshBasicMaterial color="#fde047" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
               </mesh>
            </group>
         </group>
      </group>
      <primitive object={guide} />
      <TargetMarkers targets={markers} color="#6ee7b7" />
   </>;
}
