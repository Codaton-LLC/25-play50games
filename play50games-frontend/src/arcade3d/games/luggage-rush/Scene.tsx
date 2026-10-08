"use client";

// One useRunFrame: input, then rules, then the store. Visuals only read the run.
import { useEffect, useMemo, useState } from "react";
import type { RootState } from "@react-three/fiber";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
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
   HALL,
   createRun,
   diverterLocked,
   stepRun,
   type StepInput,
} from "./rules";

const LOOK: [number, number, number] = [(HALL.minX + HALL.maxX) / 2, 0, (HALL.minZ + HALL.maxZ) / 2];
const FOCUS = { x: LOOK[0], y: LOOK[1], z: LOOK[2] };

const VIEW: FittedViewOptions = {
   area: {
      min: { x: HALL.minX - 1.5, y: HALL.minY, z: HALL.minZ - 1.2 },
      max: { x: HALL.maxX + 1.5, y: HALL.maxY, z: HALL.maxZ + 1.2 },
   },
   pitch: (50 * Math.PI) / 180,
   yaws: [0.55, 0.55 + Math.PI / 2],
   margin: { top: 0.1, bottom: 0.08, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true as const,
   fov: 50,
   // wide screens otherwise sit on the closest fit and the far chute kisses the edge
   minDistance: 45,
   // a failed fit would sit at 500, past the canvas far plane (400), and draw nothing
   maxDistance: 90,
};

function FittedCamera() {
   const view = useFittedView(VIEW);
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
   const scratch = useMemo(() => ({ v: new Vector3(), flip: { flip: [false, false, false, false] } as StepInput }), []);

   useEffect(() => {
      fx.warm("sparkle", "puff", "score");
   }, [fx]);

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
            playSfx("pickup");
            // TODO(P-06): playSfx("chime", { pitch: 0.9 + 0.15 * (event.points / 20 - 1) }) or "combo"
         } else if (event.kind === "strike") {
            fx.burst("puff", scratch.v, 14);
            playSfx("hit");
            if (event.overflow) fx.shake(0.35);
            // TODO(P-06): playSfx(event.overflow ? "thud" : "buzz")
         }
         // TODO(P-06): a diverter flip is playSfx("click"); startLoop("belt", { volume: 0.35 }) while playing
      }
      store.setStat("strikes", run.strikes);
      store.setStat("combo", run.streak);
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
