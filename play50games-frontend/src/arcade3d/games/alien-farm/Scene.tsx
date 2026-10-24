"use client";

// Alien Farm scene: one useRunFrame feeds the input, dt and the run into rules.stepRun, then the
// store (rules.feedStore: live points and HUD stats) and the feedback (core/fx bursts, floating
// scores, shake; playSfx) from the step's events. Everything else only reads the run state:
// Farm (static set), Crops (pools), Saucer, Farmer, the arrows and the hum loop. The shell's 100 s
// timer ends the run ("timeup"); afterwards the farmer cheers (or shrugs on 0) for resultDelayMs.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { Crops } from "./Crops";
import { FarmScene } from "./Farm";
import { Farmer } from "./Farmer";
import { COLORS, VIEW } from "./looks";
import { Saucer } from "./Saucer";
import {
   HARVEST,
   PLOT_COUNT,
   SCORE,
   createRun,
   cycleIndex,
   cyclePeak,
   feedStore,
   guidePlot,
   halfWindow,
   stageAt,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";

const HUM_RANGE = 6;

function prefersReducedMotion(): boolean {
   try {
      return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   } catch {
      return false;
   }
}

/** The ambient bed and one hum on the crop that matters most (README "Audio"), restarted on [phase, muted]. */
function useFarmSound(run: RunState) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const hum = useRef<LoopHandle | null>(null);
   const [state] = useState(() => ({ set: { pitch: 1, volume: 0, pan: 0 }, pitch: -1, volume: -1, pan: -9, chimed: -1 }));
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const ambient = startLoop("ambient", { volume: 0.08 });
      const h = startLoop("hum", { volume: 0, pitch: 0.6 });
      hum.current = h;
      state.pitch = state.volume = -1;
      return () => {
         ambient.stop();
         h.stop();
         hum.current = null;
      };
   }, [phase, muted, state]);

   useFrame(() => {
      const h = hum.current;
      if (!h) return;
      const t = run.time, f = run.farmer;
      // the crop in reach wins (no competing hums while picking); otherwise the nearest growing or
      // ripe crop within 6 m
      let best = -1, bestD = Infinity;
      for (const plot of run.plots) {
         const st = stageAt(plot, t);
         if ((st !== "growing" && st !== "ripe" && st !== "sprout") || plot.missed === cycleIndex(plot, t)) continue;
         const d = Math.hypot(plot.x - f.x, plot.z - f.z);
         if (d <= HUM_RANGE && d < bestD) {
            best = plot.id;
            bestD = d;
         }
      }
      let pitch = 0.6, volume = 0, pan = 0;
      if (best >= 0) {
         const plot = run.plots[best];
         const k = cycleIndex(plot, t), p = cyclePeak(plot, k), w = halfWindow(p);
         const q = Math.min(1, Math.max(0, (t - (p - 1.5)) / 1.5));
         if (t >= p - 1.5 && t <= p + w) {
            pitch = 0.6 + 1.2 * q;
            volume = 0.18 * (1 - bestD / HUM_RANGE);
            pan = Math.max(-1, Math.min(1, (plot.x - f.x) / Math.max(bestD, 0.001)));
         }
         const key = best * 1000 + k;
         if (t >= p && t < p + 0.1 && state.chimed !== key) {
            state.chimed = key;
            playSfx("chime", { volume: 0.18 * (1 - bestD / HUM_RANGE), pan, pitch: 1.3 });
         }
      }
      if (Math.abs(pitch - state.pitch) < 0.02 && Math.abs(volume - state.volume) < 0.02 && Math.abs(pan - state.pan) < 0.02) return;
      state.pitch = state.set.pitch = pitch;
      state.volume = state.set.volume = volume;
      state.pan = state.set.pan = pan;
      h.set(state.set);
   });
}

export default function Scene() {
   const view = useFittedView(VIEW);
   const input = useInput();
   const fx = useFx();
   // a fresh seed per run: GameShell remounts the Scene on start and retry
   const [run] = useState(() => createRun(randomSeed()));
   const [reducedMotion] = useState(prefersReducedMotion);
   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, press: false } as StepInput,
      dir: { x: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      ended: false,
      stats: false,
   }));
   const [markers] = useState<MarkerTarget[]>(() => [
      { x: 0, y: 1, z: 0, hidden: true, color: COLORS.beam },
      { x: 0, y: 0.6, z: 0, hidden: true, color: COLORS.mint },
   ]);
   useFarmSound(run);

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "score"), [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed, jumpPressed } = input.current;
      const { step, dir, at } = scratch;
      inputToWorld(moveX, moveY, view.yaw, dir);
      step.dirX = dir.x;
      step.dirZ = dir.z;
      // one attempt per frame from either button (E / Enter / Harvest or Space)
      step.press = actionPressed || jumpPressed;
      const ev = run.events;
      stepRun(run, step, dt);
      const store = useArcadeStore.getState();
      if (!scratch.stats) {
         // the HUD shows 0 / 0 / 0 from the first played frame
         scratch.stats = true;
         store.setStat("delivered", 0);
         store.setStat("carry", 0);
         store.setStat("perfect", 0);
      }
      feedStore(run, ev, store);

      const f = run.farmer;
      if (ev.picked >= 0) {
         const plot = run.plots[ev.picked];
         at.x = plot.x;
         at.y = 0.6;
         at.z = plot.z;
         fx.burst("sparkle", at, ev.pickedPerfect ? 22 : 14);
         at.y = 1.5;
         fx.score(at, ev.pickedPerfect ? `+${SCORE.perfect} perfect` : `+${SCORE.harvest}`, { color: ev.pickedPerfect ? COLORS.gold : "#dcfce7" });
         playSfx("pop", { pitch: ev.pickedPerfect ? 1.5 : 1 });
         playSfx("pickup", { volume: 0.7 });
         if (ev.pickedPerfect) {
            playSfx("chime", { volume: 0.5, pitch: 1 + 0.08 * Math.min(6, run.streak) });
            if (run.streak >= 3) fx.shake(0.06);
         }
      }
      if (ev.missed >= 0) {
         const plot = run.plots[ev.missed];
         at.x = plot.x;
         at.y = 0.5;
         at.z = plot.z;
         // the mistimed press bursts the crop (rules.press): a coral pop, the spores land, a short daze
         fx.burst("puff", at, 18);
         at.y = 1.4;
         fx.score(at, run.time < cyclePeak(plot, cycleIndex(plot, run.time)) ? "burst! too early" : "burst! too late", { color: COLORS.coral });
         playSfx("hit", { volume: 0.25 });
         playSfx("thud", { volume: 0.2, pitch: 0.8 });
         fx.shake(0.05);
      } else if (ev.refused) playSfx("click", { volume: 0.12, pitch: 0.7 });
      if (ev.delivered > 0) {
         at.x = f.x;
         at.y = 1;
         at.z = f.z;
         fx.burst("sparkle", at, 24);
         at.y = 1.75;
         fx.score(at, `+${ev.deliveredPoints} x${ev.delivered}`, { color: COLORS.beam, size: 0.075 });
         playSfx("whoosh");
         playSfx("combo", { pitch: 1 + 0.1 * (ev.delivered - 1) });
         fx.shake(0.05 * ev.delivered);
      }
      if (ev.shipment) {
         at.y = 2.2;
         fx.burst("confetti", at, 24);
         fx.score(at, `Shipment of ${SCORE.shipment}!`, { color: COLORS.gold, size: 0.09 });
      }
      if (ev.bursts) {
         for (let i = 0; i < PLOT_COUNT; i++) {
            if (!(ev.bursts & (1 << i)) || i === ev.missed) continue;
            at.x = run.plots[i].x;
            at.y = 0.4;
            at.z = run.plots[i].z;
            fx.burst("puff", at, 12);
            playSfx("thud", { volume: 0.15 });
         }
      }
   });

   // arrows (core TargetMarkers skip on-screen targets) and the end confetti
   useFrame(() => {
      const beam = markers[0], plotMarker = markers[1];
      beam.x = run.ship.x;
      beam.z = run.ship.z;
      beam.hidden = run.cargoCount === 0;
      const g = run.cargoCount < HARVEST.capacity ? guidePlot(run) : -1;
      plotMarker.hidden = g < 0;
      if (g >= 0) {
         plotMarker.x = run.plots[g].x;
         plotMarker.z = run.plots[g].z;
         plotMarker.color = stageAt(run.plots[g], run.time) === "ripe" ? COLORS.gold : COLORS.mint;
      }
      const { phase, score } = useArcadeStore.getState();
      if (phase === "over" && !scratch.ended) {
         scratch.ended = true;
         if (score > 0) {
            scratch.at.x = run.farmer.x;
            scratch.at.y = 1.6;
            scratch.at.z = run.farmer.z;
            fx.burst("confetti", scratch.at, 24);
         }
      }
   });

   return (
      <>
         {/* the camera reads run.farmer, which useRunFrame already moved this frame */}
         <CameraRig camera={{ position: view.offset, lookAt: [0, 0, 0], fov: VIEW.fov }} follow={run.farmer} followFraction={1} damping={5} offset={view.offset} shift={view.shift} />
         <FarmScene />
         <Crops run={run} reducedMotion={reducedMotion} />
         <Saucer run={run} reducedMotion={reducedMotion} />
         <Farmer run={run} />
         <TargetMarkers targets={markers} size={30} />
      </>
   );
}
