"use client";

// Monster Kitchen scene: one useRunFrame feeds input, dt and the play time into rules.ts and then the
// store (addScore / setStat / loseLife) plus the feedback (fx bursts and popups, playSfx, the bubbling
// loop); every visual reads the run state in useFrame and animates with useGameTime(). The camera is a
// single fixed yaw: useFittedView keeps the whole set (the README's area) clear of the HUD, the touch
// controls, the cookie banner and this game's own DOM Hud (its data-arcade-safe-area panels), with the
// lens shift moving the picture instead of turning. Tap picking measures the drawn (eased) wheel, so a
// tap takes the ingredient under the finger even mid-turn: nearest slot centre within 48 CSS px.
import { useEffect, useMemo, useState } from "react";
import { useThree, type RootState } from "@react-three/fiber";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useKitchenLevel } from "./useKitchenLevel";
import { Cauldron } from "./Cauldron";
import { Chef } from "./Chef";
import { hudButtons, hudOrders, publishHand } from "./Hud";
import { HATCH_X, HATCH_Z, Kitchen } from "./Kitchen";
import { Monsters, type WindowLook } from "./Monsters";
import { Wheel } from "./Wheel";
import {
   ORDERS,
   WHEEL,
   centreSlot,
   createRun,
   drawnSlotPosition,
   isNeeded,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";

/** One fixed front view of the whole set: bubble -> wheel -> cauldron -> hatch (README "Scene and camera"). */
const PITCH = (22 * Math.PI) / 180;
const AREA = {
   min: { x: -3.0, y: 0, z: -2.0 },
   max: { x: 1.6, y: 2.9, z: 0.9 },
};
/** A canvas tap picks the nearest wheel slot centre within this many CSS px. */
const PICK_PX = 48;
/** The fit's focus: the area's floor centre (what the camera looks at). */
const FOCUS = { x: -0.7, y: 0, z: -0.55 };

/** Everything the visual look needs that the rules do not own: eased wheel, wobble, toss, cheer, burp. */
interface Look {
   rot: number;
   wobbleAt: number;
   burpAt: number;
   tossAt: number;
   cheerUntil: number;
}

export default function Scene() {
   const { config } = useKitchenLevel();
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView({
      area: AREA,
      pitch: PITCH,
      yaws: [0],
      focus: [FOCUS],
      margin: { top: 0.17, bottom: 0.1, left: 0.02, right: 0.02 },
      padding: 8,
      shift: true,
   });
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();

   // one run per mount (GameShell remounts the Scene on start, retry and a new level)
   const [run] = useState<RunState>(() => createRun(randomSeed(), config));
   const [step] = useState<StepInput>(() => ({ rotate: 0, tapSlot: null, tossCentre: false }));
   const [at] = useState(() => ({ x: 0, y: 0, z: 0 }));
   const [ndc] = useState(() => new Vector3());
   const [look] = useState<Look>(() => ({ rot: 0, wobbleAt: -10, burpAt: -10, tossAt: -10, cheerUntil: -10 }));
   const [windows] = useState<[WindowLook, WindowLook]>(() => [
      { cur: null, last: null, leftAt: -10 },
      { cur: null, last: null, leftAt: -10 },
   ]);

   useEffect(() => fx.warm("splash", "smoke", "confetti", "sparkle", "score"), [fx]);

   // the Hud's shared mirrors outlive a run: no stale bubbles or queued ◀ ▶ presses on Retry
   useEffect(() => {
      const reset = () => {
         hudOrders[0] = null;
         hudOrders[1] = null;
         hudButtons.left = 0;
         hudButtons.right = 0;
         publishHand(null, false, null, false);
      };
      reset();
      return reset;
   }, []);

   // the bubbling loop runs while the run does (the shell stops loops on pause/over/mute)
   useEffect(() => {
      let loop: LoopHandle | null = null;
      const unsubscribe = useArcadeStore.subscribe((s, prev) => {
         if (s.phase === "playing" && prev.phase !== "playing") loop = startLoop("bubbling", { volume: 0.3 });
         else if (s.phase !== "playing" && prev.phase === "playing") {
            loop?.stop();
            loop = null;
         }
      });
      return () => {
         loop?.stop();
         unsubscribe();
      };
   }, []);

   const camera = useMemo(
      () => ({
         position: [FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]] as [number, number, number],
         lookAt: [FOCUS.x, FOCUS.y, FOCUS.z] as [number, number, number],
      }),
      [view],
   );

   /**
    * Nearest wheel slot to a canvas tap, by screen distance within PICK_PX CSS px, measured on the DRAWN
    * (eased) wheel: mid-turn the finger picks the ingredient it is on, never the one the rules already
    * moved under it. The rules then toss it (front arc) or turn it to the front.
    */
   const pickSlot = (state: RootState, tap: { x: number; y: number } | null): number | null => {
      if (!tap) return null;
      let best = -1;
      let bestD = PICK_PX;
      for (let slot = 0; slot < WHEEL.slots; slot++) {
         drawnSlotPosition(slot, look.rot, at);
         ndc.set(at.x, at.y + 0.12, at.z).project(state.camera);
         const d = Math.hypot(((ndc.x - tap.x) * width) / 2, ((ndc.y - tap.y) * height) / 2);
         if (d < bestD) {
            bestD = d;
            best = slot;
         }
      }
      return best < 0 ? null : best;
   };

   useRunFrame((state, dt, t) => {
      const inp = input.current;
      step.rotate = (inp.pressed.right ? 1 : 0) - (inp.pressed.left ? 1 : 0);
      if (hudButtons.left > 0) {
         step.rotate -= hudButtons.left;
         hudButtons.left = 0;
      }
      if (hudButtons.right > 0) {
         step.rotate += hudButtons.right;
         hudButtons.right = 0;
      }
      step.tossCentre = inp.jumpPressed || inp.actionPressed;
      step.tapSlot = pickSlot(state, inp.tap);
      stepRun(run, step, dt, t);

      const ev = run.events;
      const now = time.now;
      for (let w = 0; w < 2; w++) {
         const order = run.windows[w].order;
         if (order) {
            windows[w].cur = order;
            windows[w].last = order;
            hudOrders[w] = order;
         } else {
            if (windows[w].cur) {
               windows[w].leftAt = now;
               windows[w].cur = null;
            }
            hudOrders[w] = null;
         }
      }

      // the hand card: what Space / Enter tosses now (the centre slot under the selector ring)
      const front = run.slots[centreSlot(run.rotation)].kind;
      publishHand(front, isNeeded(run, front), run.flight ? run.flight.kind : null, run.time < run.burpUntil);

      at.x = 0;
      at.y = 1.55;
      at.z = -0.1; // the cauldron mouth
      if (ev.rotated !== 0 && !ev.drifted) playSfx("click", { pitch: 1.1 });
      if (ev.wobble) {
         look.wobbleAt = now;
         playSfx("thud", { pitch: 0.9, volume: 0.3 });
      }
      if (ev.tossed) {
         look.tossAt = now;
         playSfx("whoosh", { pitch: 1.3, volume: 0.3 });
      }
      if (ev.landed === "right") {
         fx.burst("splash", at, 10);
         playSfx("pop", { pitch: 0.9 });
         playSfx("splash", { volume: 0.3 });
      }
      if (ev.burped) {
         look.burpAt = now;
         fx.burst("smoke", at, 14);
         fx.shake(0.1);
         playSfx("buzz", { pitch: 0.5 });
         playSfx("thud", { pitch: 0.6 });
      }
      if (ev.appeared) playSfx("pop", { pitch: 1.4, volume: 0.4 });
      if (ev.completed) {
         const done = ev.completed;
         const store = useArcadeStore.getState();
         store.addScore(done.points);
         store.setStat("served", run.completions);
         look.cheerUntil = now + ORDERS.eatS;
         at.x = HATCH_X[done.window];
         at.y = 1.9;
         at.z = HATCH_Z;
         fx.score(at, `+${done.base} +${done.tip} tip`);
         fx.burst("confetti", at, 24);
         at.x = 0;
         at.y = 1.55;
         at.z = -0.1;
         fx.burst("sparkle", at, 12);
         playSfx("chime");
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.angryLeft) {
         playSfx("buzz", { pitch: 0.7 });
         const store = useArcadeStore.getState();
         if (ev.angryLeft & 1) store.loseLife();
         if (ev.angryLeft & 2) store.loseLife();
      }
   });

   return (
      <>
         <CameraRig camera={camera} shift={view.shift} />
         <Kitchen />
         <Wheel run={run} look={look} />
         <Cauldron look={look} />
         <Monsters run={run} windows={windows} />
         <Chef shared={look} />
      </>
   );
}
