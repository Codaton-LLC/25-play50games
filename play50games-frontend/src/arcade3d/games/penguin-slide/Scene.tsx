"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { SkyDome, SnowFall } from "@/arcade3d/core/env";
import { SCORE_LIFE, useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { capScore } from "@/arcade3d/core/limits";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { bank, hop, spring, squashStretch } from "@/arcade3d/core/motion";
import { BlobShadow } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { ASSETS, BELLY_LIFT, bellyClearance } from "./assets";
import { ChaseCamera, VIEW, useReducedMotion } from "./camera";
import { PenguinPrimitive } from "./Primitives";
import Track from "./Track";
import { PROPOSED_LIMITS, airHeight, chunkAt, createRun, landingSpins, runScore, safeCentre, sampleTrack, stepRun, worldAt, type Run } from "./rules";

function Penguin({ run, reduced }: { run: Run; reduced: boolean }) {
   const root = useRef<Group>(null), body = useRef<Group>(null), fallback = useRef<Group>(null), shadow = useRef<Group>(null);
   const time = useGameTime();
   const look = useMemo(() => ({ roll: { x: 0, v: 0 }, motion: { y: 0, roll: 0, yaw: 0, squash: 1 }, scale: { x: 1, y: 1, z: 1 }, point: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 0 }, endAt: -1 }), []);
   useFrame(() => {
      if (!root.current || !body.current) return;
      if (run.end && look.endAt < 0) look.endAt = time.now;
      const ending = look.endAt < 0 ? 0 : Math.min(1.2, time.now - look.endAt);
      const tumble = run.tumble > 0 || run.end === "lose";
      hop(tumble ? (1 - run.tumble + ending) * Math.PI : 0, reduced ? 0 : 0.12, look.motion);
      const roll = spring(look.roll, reduced ? 0 : bank(run.steer * 3, Math.PI / 15), 50, -1, time.delta);
      const c = chunkAt(run, run.s);
      sampleTrack(c, run.s - c.index * 60, run.d, look.point, look.tangent, run.branch);
      const grade = -look.tangent.y / (Math.hypot(look.tangent.x, look.tangent.z) || 1);
      root.current.position.set(run.d, airHeight(run) + look.motion.y + bellyClearance(grade, roll, Boolean(fallback.current)), 0);
      if (shadow.current) {
         shadow.current.position.set(run.d, 0, 0);
         shadow.current.scale.setScalar(1 / (1 + airHeight(run) * 0.3));
      }
      root.current.rotation.set(0, -run.yaw * Math.PI / 180, roll);
      body.current.position.y = fallback.current ? 0.28 : BELLY_LIFT;
      body.current.rotation.set(-Math.PI / 2 - Math.atan(grade) + (tumble && !reduced ? (1 - run.tumble + ending) * Math.PI * 2 : 0), 0, 0);
      squashStretch(look.motion.squash, look.scale);
      body.current.scale.set(look.scale.x, look.scale.y, look.scale.z);
   });
   return <><group ref={shadow}><BlobShadow radius={0.42} y={0.012} /></group><group ref={root} name="penguin">
      <group ref={body} rotation={[-Math.PI / 2, 0, 0]} position={[0, BELLY_LIFT, 0]}>
         <group position={[0, -0.4, 0]}><Model asset={ASSETS.penguin} fallback={<group ref={fallback}><PenguinPrimitive /></group>} /></group>
      </group>
   </group></>;
}

export default function Scene() {
   const input = useInput(), fx = useFx(), time = useGameTime();
   const view = useFittedView(VIEW);
   const reduced = useReducedMotion();
   const [run] = useState(() => createRun(randomSeed(), typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
   const [scratch] = useState(() => ({ input: { steer: 0, left: false, right: false, jump: false }, direction: { x: 0, z: 0 }, at: { x: 0, y: 0.2, z: 0 }, snowAt: 0, scoreAt: 0, fishPending: 0, popupA: -1, popupB: -1, options: { color: "#fb923c" } }));
   const [marker] = useState(() => [{ x: 0, y: 1.5, z: -20, hidden: false }]);
   useEffect(() => {
      fx.warm("sparkle", "snow", "splash", "score");
      const store = useArcadeStore.getState();
      store.setStat("assist", Number(run.assist));
      store.setStat("time", 30); store.setStat("distance", 0); store.setStat("crashes", 0);
   }, [fx, run]);

   const popup = (text: string): boolean => {
      if (time.now >= scratch.popupA) scratch.popupA = time.now + SCORE_LIFE;
      else if (time.now >= scratch.popupB) scratch.popupB = time.now + SCORE_LIFE;
      else return false;
      fx.score(scratch.at, text, scratch.options);
      return true;
   };

   useRunFrame((_state, dt) => {
      inputToWorld(input.current.moveX, 0, view.yaw, scratch.direction);
      scratch.input.steer = scratch.direction.x;
      scratch.input.left = input.current.pressed.left;
      scratch.input.right = input.current.pressed.right;
      scratch.input.jump = input.current.jumpPressed;
      stepRun(run, scratch.input, dt);
      const store = useArcadeStore.getState();
      store.addScore(run.events.score);
      store.setStat("time", Math.ceil(run.remaining));
      store.setStat("distance", Math.floor(run.s));
      store.setStat("crashes", run.crashes);
      store.setStat("assist", Number(run.assist));
      store.setStat("air", Number(run.airDuration > 0));
      store.setStat("alignment", Number(landingSpins(run.yaw) >= 0));
      store.setStat("yaw", run.yaw);
      store.setLevel(1 + Math.floor(Math.min(run.elapsed / 120, 1) * 3));
      scratch.at.x = run.d; scratch.at.y = airHeight(run) + 0.3; scratch.at.z = 0;
      if (run.events.fish) {
         scratch.fishPending += run.events.fish;
         fx.burst("sparkle", scratch.at, 8); playSfx("pickup");
      }
      if (run.events.spins) popup(run.events.spins === 2 ? "+100 double" : "+50 spin");
      if (scratch.fishPending && (time.play - scratch.scoreAt >= 0.2 || run.end) && (time.now >= scratch.popupA || time.now >= scratch.popupB) && popup(`+${scratch.fishPending * 10}`)) {
         scratch.fishPending = 0; scratch.scoreAt = time.play;
      }
      if (run.events.gate) { fx.burst("sparkle", scratch.at, 18); popup("+8 s"); playSfx("pickup"); }
      if (run.events.hop) playSfx("jump");
      if (run.events.crash) { fx.burst("splash", scratch.at, 18); fx.shake(0.25); playSfx("hit"); }
      if (!reduced && Math.abs(run.steer) > 0.5 && time.play - scratch.snowAt >= 0.1 && !run.tumble) {
         fx.burst("snow", scratch.at, 3); scratch.snowAt = time.play;
      }
      // TODO(P-06): startLoop("slide") and the new carve/ramp/gate cues after that API merges.
      if (run.end) { store.setScore(capScore(runScore(run), store.elapsedMs, PROPOSED_LIMITS)); store.end(run.end); }
   });

   useFrame(() => {
      const s = Math.min(run.gateS, (run.chunks[2].index + 1) * 60 - 0.01);
      const c = chunkAt(run, s);
      worldAt(run, s, safeCentre(c, s - c.index * 60, run.branch), marker[0]);
      marker[0].y += 1.5;
      marker[0].hidden = run.end !== null || run.gateS >= (run.chunks[2].index + 1) * 60;
   });
   return <>
      <ChaseCamera run={run} reduced={reduced} view={view} />
      <SkyDome top="#8ed7f2" bottom="#e9fbff" />
      <SnowFall count={reduced ? 60 : 300} area={[24, 16, 70]} />
      <Track run={run} />
      <Penguin run={run} reduced={reduced} />
      <TargetMarkers targets={marker} color="#34d399" />
   </>;
}
