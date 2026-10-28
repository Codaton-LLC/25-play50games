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
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { BOUNDS, DRONE, ROUTE, createRun, roofAt, stepRun } from "./rules";
import City from "./City";
import Drone from "./Drone";
import { FittedFog, viewFor } from "./camera";
import { COLORS } from "./looks";
import { useDeliveryLevel } from "./useDeliveryLevel";

function stat(store: ArcadeStore, key: string, value: number): void {
   if (store.stats[key] !== value) store.setStat(key, value);
}

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const fit = useMemo(
      () => viewFor(width, height, typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches),
      [width, height]
   );
   const view = useFittedView(fit);
   const input = useInput();
   const fx = useFx();
   const { config } = useDeliveryLevel();
   const [run] = useState(() =>
      createRun(randomSeed(), typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches, config)
   );
// camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "delivery-drone",
      subject: "vehicle",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const d = run.drone;
         o.x = d.x; o.y = d.y; o.z = d.z; o.heading = d.heading; o.vx = d.vx; o.vz = d.vz;
      },
      solids: (out: AABB[]) => {
         let n = 0;
         for (const b of run.city.buildings) {
            if (n >= out.length) break;
            const o = out[n++];
            o.min.x = b.box.min.x; o.min.y = b.box.min.y; o.min.z = b.box.min.z;
            o.max.x = b.box.max.x; o.max.y = b.box.max.y; o.max.z = b.box.max.z;
         }
         return n;
      },
   });

   const [reduced] = useState(
      () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
   );
   const [scratch] = useState(() => ({
      dir: { x: 0, z: 0 },
      step: { dirX: 0, dirZ: 0, drop: false },
      focus: { x: 0, y: 3, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      markers: [{ x: 0, y: 0.3, z: 0, hidden: true }],
      feedbackUntil: 0,
      audio: { pitch: 0.8, volume: 0.25 },
      lastWash: 0,
      washAngle: 0,
   }));
   const phase = useArcadeStore((s) => s.phase);
   const muted = useMuted();
   const loop = useRef<LoopHandle | null>(null);

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "score"), [fx]);

   useEffect(() => {
      if (phase === "playing" && !muted) loop.current = startLoop("rotor", { volume: 0.25 });
      return () => {
         loop.current?.stop();
         loop.current = null;
      };
   }, [phase, muted]);

   useRunFrame((_state, dt) => {
      const i = input.current;
      const d = run.drone;
      inputToWorld(i.moveX, i.moveY, cam.yaw(), scratch.dir);
      scratch.step.dirX = scratch.dir.x;
      scratch.step.dirZ = scratch.dir.z;
      scratch.step.drop = i.actionPressed || i.jumpPressed;
      stepRun(run, scratch.step, dt);

      const store = useArcadeStore.getState();
      const e = run.events;
      if (e.score > 0) store.addScore(e.score);

      const target =
         run.attached || run.falling
            ? run.city.buildings[run.city.targets[Math.min(run.completed, run.city.targets.length - 1)]]
            : null;
      scratch.markers[0].x = target?.x ?? 0;
      scratch.markers[0].y = target ? target.height + 0.5 : 0.5;
      scratch.markers[0].z = target?.z ?? 0;
      scratch.markers[0].hidden = Math.hypot(d.x - scratch.markers[0].x, d.z - scratch.markers[0].z) <= 3;

      stat(store, "battery", Math.ceil(run.battery));
      stat(store, "deliveries", run.completed);
      stat(store, "distance", Math.round(Math.hypot(d.x - scratch.markers[0].x, d.z - scratch.markers[0].z)));
      stat(store, "loading", Math.floor((run.loading / ROUTE.loading) * 100));
      stat(store, "carrying", run.attached || run.falling ? 1 : 0);
      stat(store, "fragile", run.fragile ? 1 : 0);

      const speed = Math.hypot(d.vx, d.vz);
      const ahead = Math.min(DRONE.lookaheadMax, speed * DRONE.lookahead);
      scratch.focus.x = d.x + (speed ? (d.vx / speed) * ahead : 0);
      scratch.focus.y = d.y;
      scratch.focus.z = d.z + (speed ? (d.vz / speed) * ahead : 0);

      scratch.at.x = e.delivery ? run.impact.x : d.x;
      scratch.at.y = e.delivery ? run.impact.y + 0.5 : d.y;
      scratch.at.z = e.delivery ? run.impact.z : d.z;

      // Event audio and visual particle feedback
      if (e.pickup) {
         playSfx("click");
         fx.burst("sparkle", scratch.at, 10);
      }
      if (e.release) playSfx("whoosh");
      if (e.delivery) {
         playSfx("thud");
         playSfx("pickup");
         playSfx("chime");
         fx.burst("sparkle", scratch.at, 24);
         fx.burst("confetti", scratch.at, 16);
         fx.score(scratch.at, `+${e.score}`, { color: "#38bdf8" });
         fx.shake(0.08);
         stat(store, "feedback", 1);
         scratch.feedbackUntil = run.time + 2;
      }
      if (e.miss || e.hit) {
         playSfx("hit");
         fx.burst("puff", scratch.at, 12);
         fx.shake(0.12);
         stat(store, "feedback", e.hit ? 3 : 2);
         scratch.feedbackUntil = run.time + 2;
      }
      if (run.time > scratch.feedbackUntil) stat(store, "feedback", 0);
      if (e.warning) playSfx("alarm");

      // Juicy rotor wash puffs when hovering low / reloading at depot (max 5 bursts/sec)
      const surfaceY = roofAt(run.city, d.x, d.z);
      const heightAboveSurface = d.y - surfaceY;
      if (
         !reduced &&
         (run.loading > 0 || (heightAboveSurface <= 3.2 && speed < 3)) &&
         run.time - scratch.lastWash >= 0.2
      ) {
         scratch.lastWash = run.time;
         scratch.washAngle += 1.6;
         scratch.at.x = d.x + Math.cos(scratch.washAngle) * 0.45;
         scratch.at.y = surfaceY + 0.06;
         scratch.at.z = d.z + Math.sin(scratch.washAngle) * 0.45;
         fx.burst("puff", scratch.at, 2);
      }

      // Audio frequency & volume ramping
      const pitch = 0.8 + (0.6 * speed) / DRONE.speed;
      const volume = 0.25 + (0.1 * speed) / DRONE.speed;
      if (
         !isMuted() &&
         loop.current &&
         (Math.abs(scratch.audio.pitch - pitch) >= 0.02 || Math.abs(scratch.audio.volume - volume) >= 0.02)
      ) {
         scratch.audio.pitch = pitch;
         scratch.audio.volume = volume;
         loop.current.set(scratch.audio);
      }

      if (run.reason) {
         store.setScore(run.score);
         if (run.reason === "win") fx.burst("confetti", scratch.at, 40);
         store.end(run.reason);
      }
   });

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0] }}
            follow={scratch.focus}
            followFraction={1}
            bounds={BOUNDS}
            damping={5}
            offset={view.offset}
            shift={view.shift}
         />
         <FittedFog distance={view.distance} />
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} />
         <City run={run} reduced={reduced} />
         <Drone run={run} reduced={reduced} />
         <TargetMarkers targets={scratch.markers} color={COLORS.padActive} />
      </>
   );
}
