"use client";

// One useRunFrame: input, then rules, then the store. Visuals only read the run.
import { useEffect, useMemo, useState } from "react";
import { useThree, type RootState } from "@react-three/fiber";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { Bags } from "./Bags";
import { Belts } from "./Belts";
import { Hall } from "./Hall";
import {
   DIVERTER_AT,
   comboMult,
   createRun,
   diverterLocked,
   stepRun,
   type StepInput,
} from "./rules";

/** Belts only. The floor and handler past x 8.2 are outside the fit, so the camera can come in. */
const AREA = {
   min: { x: 0.4, y: 0, z: -0.6 },
   max: { x: 8.2, y: 1.6, z: 14.8 },
} as const;

const LOOK: [number, number, number] = [(AREA.min.x + AREA.max.x) / 2, 0, (AREA.min.z + AREA.max.z) / 2];
const FOCUS = { x: LOOK[0], y: LOOK[1], z: LOOK[2] };

const VIEW_BASE = {
   area: AREA,
   pitch: (50 * Math.PI) / 180,
   margin: { top: 0.1, bottom: 0.08, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true as const,
   fov: 50,
   // a failed fit would sit at 500, past the canvas far plane (400), and draw nothing
   maxDistance: 90,
};

/** Portrait: yaw 0 lays the spine (world +z) on the screen's vertical. */
const PORTRAIT: FittedViewOptions = { ...VIEW_BASE, yaws: [0] };
/** Desktop landscape keeps the isometric. A short wide phone uses π/2 so the spine runs across the width. */
const LANDSCAPE: FittedViewOptions = { ...VIEW_BASE, yaws: [0.55] };
const WIDE: FittedViewOptions = { ...VIEW_BASE, yaws: [Math.PI / 2] };

function FittedCamera() {
   const size = useThree((state) => state.size);
   const portrait = size.height > size.width;
   const wide = size.width / Math.max(1, size.height) > 1.9;
   const view = useFittedView(portrait ? PORTRAIT : wide ? WIDE : LANDSCAPE);
   return (
      <CameraRig
         camera={{
            position: [LOOK[0] + view.offset[0], LOOK[1] + view.offset[1], LOOK[2] + view.offset[2]],
            fov: 50,
            lookAt: LOOK,
         }}
         follow={FOCUS}
         followFraction={1}
         offset={view.offset}
         shift={view.shift}
         damping={18}
      />
   );
}

/** Nearest unlocked diverter whose 64 px box contains the pointer. -1 if none. */
function pickDiverter(state: RootState, tap: { x: number; y: number }, time: number, v: Vector3): number {
   const w = state.size.width;
   const h = state.size.height;
   const tx = (tap.x * 0.5 + 0.5) * w;
   const ty = (-tap.y * 0.5 + 0.5) * h;
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < 4; i++) {
      if (diverterLocked(i, time)) continue;
      const at = DIVERTER_AT[i];
      v.set(at.x, at.y + 0.55, at.z).project(state.camera);
      if (!(v.z >= -1 && v.z <= 1)) continue;
      const dx = Math.abs((v.x * 0.5 + 0.5) * w - tx);
      const dy = Math.abs((-v.y * 0.5 + 0.5) * h - ty);
      const d = dx * dx + dy * dy;
      if (dx <= 32 && dy <= 32 && d < bestD) {
         best = i;
         bestD = d;
      }
   }
   return best;
}

export default function Scene() {
   const [run] = useState(() => createRun(randomSeed()));
   const input = useInput();
   const fx = useFx();
   const phase = useArcadeStore((state) => state.phase);
   const scratch = useMemo(() => ({ v: new Vector3(), flip: { flip: [false, false, false, false] } as StepInput }), []);

   useEffect(() => {
      fx.warm("sparkle", "puff", "score");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing") return;
      const belt = startLoop("belt", { volume: 0.35 });
      return () => belt.stop();
   }, [phase]);

   useRunFrame((state, dt, time) => {
      const { pressed, swipe, tapDown } = input.current;
      const flip = scratch.flip.flip;
      flip[0] = flip[1] = flip[2] = flip[3] = false;
      // a swipe already wrote its direction into pressed, and tapDown flipped the diverter it started on
      if (!swipe) {
         if (pressed.left) flip[0] = true;
         if (pressed.down) flip[1] = true;
         if (pressed.right) flip[2] = true;
         if (pressed.up) flip[3] = true;
      }
      if (tapDown) {
         const hit = pickDiverter(state, tapDown, time, scratch.v);
         if (hit >= 0) flip[hit] = true;
      }
      stepRun(run, scratch.flip, dt, time);
      const store = useArcadeStore.getState();
      for (let i = 0; i < run.eventCount; i++) {
         const event = run.events[i];
         scratch.v.set(event.x, event.y + 0.4, event.z);
         if (event.kind === "deliver") {
            store.addScore(event.points);
            fx.burst("sparkle", scratch.v, 12);
            fx.score(scratch.v, `+${event.points}`);
            const mult = comboMult(run.streak < 1 ? 1 : run.streak);
            playSfx(run.streak > 1 ? "combo" : "chime", { pitch: 0.9 + 0.15 * (mult - 1) });
         } else if (event.kind === "strike") {
            fx.burst("puff", scratch.v, 14);
            playSfx(event.overflow ? "thud" : "buzz");
            if (event.overflow) fx.shake(0.35);
         } else if (event.kind === "flip") {
            playSfx("click");
         }
      }
      store.setStat("strikes", run.strikes);
      store.setStat("combo", comboMult(run.streak < 1 ? 1 : run.streak));
      if (run.lost) store.end("lose");
   });

   return (
      <>
         <FittedCamera />
         <Hall />
         <Belts run={run} />
         <Bags run={run} />
      </>
   );
}
