"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFx } from "@/arcade3d/core/fx/FxLayer";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { LOOK, viewFor } from "./looks";
import { Crane } from "./Crane";
import { Site } from "./Site";
import { Pieces } from "./Pieces";
import {
   CUE_COLLAPSE, CUE_DROP, CUE_MISS, CUE_PICKUP, CUE_WIN, CUE_WRONG, PILE_A, PILE_R, PLAN,
   createRun, roofHeight, stepRun, swingMagnitude, type CraneInput,
} from "./rules";

const THUD = [1.3, 1.1, 0.9];
const POINTS = [100, 60, 30];
const raycaster = new Raycaster();
const ndc = new Vector2();
const ground = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();
const at = { x: 0, y: 0, z: 0 };

function pileFromPointer(camera: Camera, pointer: { x: number; y: number }): number {
   ndc.set(pointer.x, pointer.y);
   raycaster.setFromCamera(ndc, camera);
   if (!raycaster.ray.intersectPlane(ground, hit)) return -1;
   let best = -1;
   let bestD = 1.15;
   for (let i = 0; i < PILE_A.length; i++) {
      const x = PILE_R * Math.sin(PILE_A[i]);
      const z = PILE_R * Math.cos(PILE_A[i]);
      const d = Math.hypot(hit.x - x, hit.z - z);
      if (d < bestD) {
         best = i;
         bestD = d;
      }
   }
   return best;
}

export default function Scene() {
   const [run] = useState(() => createRun(randomSeed()));
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const camera = useThree((s) => s.camera);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   const loop = useRef<LoopHandle | null>(null);
   const click = useRef(0);
   const command = useRef<CraneInput>({ rot: 0, radial: 0, pick: -1, actionPick: false, drop: false });
   const phase = useArcadeStore((s) => s.phase);
   const muted = useMuted();

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
   }, [fx]);

   useEffect(() => {
      if (phase === "playing" && !muted) loop.current = startLoop("engine", { volume: 0.3 });
      return () => {
         loop.current?.stop();
         loop.current = null;
      };
   }, [phase, muted]);

   useRunFrame((_state, dt) => {
      const live = input.current;
      const digit = live.digit;
      let pick = -1;
      if (digit !== null && digit >= 1 && digit <= 5) pick = digit - 1;
      else if (live.tap) pick = pileFromPointer(camera, live.pointer);
      const carried = run.carried >= 0;
      const order = command.current;
      order.rot = live.moveX;
      order.radial = -live.moveY;
      order.pick = pick;
      order.actionPick = live.actionPressed && !carried;
      order.drop = (live.jumpPressed || live.actionPressed) && carried;
      stepRun(run, order, dt);
      const store = useArcadeStore.getState();
      if (run.gained) store.addScore(run.gained);
      const step = PLAN[run.planIndex];
      store.setStat("stability", Math.max(0, run.stability));
      store.setStat("building", (step?.building ?? 2) + 1);
      store.setStat("swing", Math.round(swingMagnitude(run.swing) * 5.5 * 10) / 10);
      store.setStat("piece", (step?.kind ?? 4) + 1);
      LOOK.y = 0.35 * roofHeight(run);

      const pace = Math.min(1, Math.abs(run.omega) / 0.9 + Math.abs(run.vr) / 2.5);
      loop.current?.set({ pitch: 0.85 + pace * 0.45, volume: 0.25 + pace * 0.1 });
      click.current += dt;
      if (click.current > 0.4 && swingMagnitude(run.swing) > 0.08) {
         click.current = 0;
         playSfx("click", { pitch: 0.6, volume: 0.2 });
      }
      at.x = run.hookX;
      at.y = run.hookY;
      at.z = run.hookZ;
      if (run.cue & CUE_PICKUP) {
         playSfx("pickup");
         fx.burst("sparkle", at, 10);
      }
      if (run.cue & CUE_DROP) {
         playSfx("thud", { pitch: THUD[run.dropRating] ?? 1 });
         if (run.dropRating === 0) playSfx("chime", { pitch: 1 + Math.min(3, run.streak) * 0.06 });
         fx.score(at, `+${POINTS[run.dropRating] ?? 0}`);
      }
      if (run.cue & CUE_MISS) playSfx("hit");
      if (run.cue & CUE_WRONG) playSfx("buzz");
      if (run.cue & CUE_COLLAPSE) {
         playSfx("boom");
         fx.shake(0.6);
         fx.burst("puff", at, 16);
      }
      if (run.cue & CUE_WIN) fx.burst("confetti", at, 24);
      if (run.phase === "win") store.end("win");
      else if (run.phase === "lose") store.end("lose");
      else if (run.phase === "timeup") store.end("timeup");
   });

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, lookAt: [LOOK.x, LOOK.y, LOOK.z], fov: 42 }}
            follow={LOOK}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
            damping={6}
         />
         <Site run={run} />
         <Crane run={run} />
         <Pieces run={run} />
      </>
   );
}
