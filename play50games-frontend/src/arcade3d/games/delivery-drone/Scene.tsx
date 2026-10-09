"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { isMuted, playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { BOUNDS, DRONE, ROUTE, createRun, stepRun } from "./rules";
import City from "./City";
import Drone from "./Drone";
import { FittedFog, viewFor } from "./camera";

function stat(store: ArcadeStore, key: string, value: number): void {
   if (store.stats[key] !== value) store.setStat(key, value);
}

export default function Scene() {
   const width = useThree((s) => s.size.width), height = useThree((s) => s.size.height);
   const fit = useMemo(() => viewFor(width, height), [width, height]);
   const view = useFittedView(fit);
   const input = useInput(), fx = useFx();
   const [run] = useState(() => createRun(randomSeed(), typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches));
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [scratch] = useState(() => ({ dir: { x: 0, z: 0 }, step: { dirX: 0, dirZ: 0, drop: false }, focus: { x: 0, y: 3, z: 0 }, at: { x: 0, y: 0, z: 0 }, markers: [{ x: 0, y: 0.3, z: 0 }], feedbackUntil: 0, audio: { pitch: 0.8, volume: 0.25 } }));
   const phase = useArcadeStore((s) => s.phase), muted = useMuted();
   const loop = useRef<LoopHandle | null>(null);
   useEffect(() => fx.warm("sparkle", "puff", "confetti", "score"), [fx]);
   useEffect(() => {
      if (phase === "playing" && !muted) loop.current = startLoop("rotor", { volume: 0.25 });
      return () => { loop.current?.stop(); loop.current = null; };
   }, [phase, muted]);
   useRunFrame((_state, dt) => {
      const i = input.current, d = run.drone;
      inputToWorld(i.moveX, i.moveY, view.yaw, scratch.dir);
      scratch.step.dirX = scratch.dir.x; scratch.step.dirZ = scratch.dir.z; scratch.step.drop = i.actionPressed || i.jumpPressed;
      stepRun(run, scratch.step, dt);
      const store = useArcadeStore.getState(), e = run.events;
      if (e.score > 0) store.addScore(e.score);
      const target = run.attached || run.falling ? run.city.buildings[run.city.targets[Math.min(run.completed, 11)]] : null;
      scratch.markers[0].x = target?.x ?? 0; scratch.markers[0].y = target ? target.height + 0.5 : 0.5; scratch.markers[0].z = target?.z ?? 0;
      stat(store, "battery", Math.ceil(run.battery)); stat(store, "deliveries", run.completed);
      stat(store, "distance", Math.round(Math.hypot(d.x - scratch.markers[0].x, d.z - scratch.markers[0].z)));
      stat(store, "loading", Math.floor(run.loading / ROUTE.loading * 100)); stat(store, "carrying", run.attached || run.falling ? 1 : 0); stat(store, "fragile", run.fragile ? 1 : 0);
      const ahead = Math.min(DRONE.lookaheadMax, Math.hypot(d.vx, d.vz) * DRONE.lookahead), speed = Math.hypot(d.vx, d.vz);
      scratch.focus.x = d.x + (speed ? d.vx / speed * ahead : 0); scratch.focus.y = d.y; scratch.focus.z = d.z + (speed ? d.vz / speed * ahead : 0);
      scratch.at.x = e.delivery ? run.impact.x : d.x; scratch.at.y = e.delivery ? run.impact.y + 0.5 : d.y; scratch.at.z = e.delivery ? run.impact.z : d.z;
      if (e.pickup) { playSfx("click"); fx.burst("sparkle", scratch.at, 10); }
      if (e.release) playSfx("whoosh");
      if (e.delivery) { playSfx("thud"); playSfx("pickup"); playSfx("chime"); fx.burst("sparkle", scratch.at, 24); fx.score(scratch.at, `+${e.score}`); stat(store, "feedback", 1); scratch.feedbackUntil = run.time + 2; }
      if (e.miss || e.hit) { playSfx("hit"); fx.burst("puff", scratch.at, 12); fx.shake(0.12); stat(store, "feedback", e.hit ? 3 : 2); scratch.feedbackUntil = run.time + 2; }
      if (run.time > scratch.feedbackUntil) stat(store, "feedback", 0);
      if (e.warning) playSfx("alarm");
      const pitch = 0.8 + 0.6 * speed / DRONE.speed, volume = 0.25 + 0.1 * speed / DRONE.speed;
      if (!isMuted() && loop.current && (Math.abs(scratch.audio.pitch - pitch) >= 0.02 || Math.abs(scratch.audio.volume - volume) >= 0.02)) { scratch.audio.pitch = pitch; scratch.audio.volume = volume; loop.current.set(scratch.audio); }
      if (run.reason) {
         store.setScore(run.score);
         if (run.reason === "win") fx.burst("confetti", scratch.at, 40);
         store.end(run.reason);
      }
   });
   return <>
      <CameraRig camera={{ position: view.offset, lookAt: [0, 0, 0] }} follow={scratch.focus} followFraction={1} bounds={BOUNDS} damping={5} offset={view.offset} shift={view.shift} />
      <FittedFog distance={view.distance} /><SkyDome top="#93c5fd" bottom="#dbeafe" />
      <City run={run} reduced={reduced} /><Drone run={run} reduced={reduced} />
      <TargetMarkers targets={scratch.markers} color="#38bdf8" />
   </>;
}
