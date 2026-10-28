"use client";

import { useCraneLevel } from "./useCraneLevel";
import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFx } from "@/arcade3d/core/fx/FxLayer";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { SkyDome } from "@/arcade3d/core/env";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { COLORS, LOOK, viewFor } from "./looks";
import { Crane } from "./Crane";
import { Site } from "./Site";
import { Pieces } from "./Pieces";
import { Cues } from "./Cues";
import { landingMarker } from "./dropGuide";
import {
   createRun,
   CUE_COLLAPSE,
   CUE_PICKUP,
   CUE_WIN,
   CUE_WRONG,
   dropRadius,
   PILE_A,
   PILE_R,
   PLAN,
   pileAt,
   pileUnder,
   roofHeight,
   stepRun,
   swingMagnitude,
   type CraneInput,
} from "./rules";

const raycaster = new Raycaster();
const ndc = new Vector2();
const ground = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();
const at = { x: 0, y: 0, z: 0 };
const marker = { x: 0, y: 0, z: 0 };
const pileXZ = { x: 0, z: 0 };
const wrongAt = { x: 0, y: 0, z: 0 };

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

function LevelScene() {
   const { id, config } = useCraneLevel();
   const [run] = useState(() => createRun(randomSeed(), config));
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

   // camera views (core/camera): default (the fitted rig), top and free. The jib turns with the
   // stick in screen-free polar terms, so no view changes the controls; one-finger drags stay off
   // because a tap picks a pile
   useCameraViews({
      slug: "construction-worker",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         o.x = 0; o.y = 2.5; o.z = 7.5; o.heading = Math.PI; o.vx = 0; o.vz = 0;
      },
      views: ["default", "top", "free"],
      framing: { top: { distance: 22 }, free: { distance: 18, pitch: (30 * Math.PI) / 180, lookUp: 0.5 } },
      oneFinger: false,
   });

   // Core preset lighting and warm daylight construction mood
   useStageLighting("day", 1, COLORS.skyBottom, COLORS.fog);

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
      // HUD cues (not shell chips): what is on the hook, the pile under it, the dwell, the drop gate,
      // the predicted landing rating, the wrong-pile lock and the cheer
      store.setStat("carry", run.carried + 1);
      store.setStat("hover", run.carried < 0 ? pileUnder(run) + 1 : 0);
      store.setStat("armed", run.armed >= 0 ? 1 : 0);
      store.setStat("gate", step && run.radius >= dropRadius(step.building) ? 1 : 0);
      store.setStat("rate", run.carried >= 0 ? landingMarker(run, marker) : 3);
      store.setStat("lock", run.lock > 0 ? 1 : 0);
      store.setStat("cheer", run.cheer > 0 ? 1 : 0);
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
      // the landing (thud, puff, rating text, the miss sound) plays when the drawn piece lands (Pieces)
      if (run.cue & CUE_WRONG) {
         playSfx("buzz");
         const pile = pileUnder(run);
         if (pile >= 0) {
            pileAt(pile, pileXZ);
            wrongAt.x = pileXZ.x * 0.55;
            wrongAt.y = 1.6;
            wrongAt.z = pileXZ.z;
            fx.score(wrongAt, "Wrong pile! -1 s", { color: COLORS.rateMiss, size: height > width * 1.2 ? 0.05 : 0.07 });
         }
      }
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
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} />
         <Site run={run} levelId={id} />
         <Crane run={run} />
         <Pieces run={run} />
         <Cues run={run} />
      </>
   );
}

/** Remounts when another level is picked, so the wind and the marks are that level's. */
export default function Scene() {
   const { id } = useCraneLevel();
   return <LevelScene key={id} />;
}
