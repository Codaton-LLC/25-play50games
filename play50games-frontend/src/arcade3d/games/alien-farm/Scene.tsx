"use client";

// Alien Farm scene: one useRunFrame feeds the input, dt and the run into rules.stepRun, then the
// store (rules.feedStore: live points and HUD stats) and the feedback (core/fx bursts, floating
// scores, shake; playSfx) from the step's events. Everything else only reads the run state:
// Farm (static set + decor), Crops (pools), Saucer, Farmer, the arrows and the hum loop. The shell's 100 s
// timer ends the run ("timeup"); afterwards the farmer cheers (or shrugs on 0) for resultDelayMs.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { Toss, useActionPop, useFx, type TossHandle } from "@/arcade3d/core/fx";
import { TargetBeacon, TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { Model } from "@/arcade3d/core/assets";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { Crops } from "./Crops";
import { COOLING, GUIDE, beamGoal, cropGoal, farmHint, hintCode, toolCooling } from "./guide";
import { useLevel } from "@/arcade3d/core/level";
import { FarmScene } from "./Farm";
import type { AlienFarmLevel } from "./levels";
import { Farmer } from "./Farmer";
import { COLORS, VIEW } from "./looks";
import { Saucer } from "./Saucer";
import {
   HARVEST,
   PLOT_COUNT,
   SHIP,
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
         const k = cycleIndex(plot, t), p = cyclePeak(plot, k), w = halfWindow(p, plot.halfLate);
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
   const pop = useActionPop();
   const touch = useCoarsePointer();

   // a fresh seed per run: GameShell remounts the Scene on start and retry
   const { config } = useLevel<AlienFarmLevel>();
   const [run] = useState(() => createRun(randomSeed(), config));

   // camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "alien-farm",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const f = run.farmer;
         o.x = f.x; o.y = 0.9; o.z = f.z; o.heading = f.yaw; o.vx = f.vx; o.vz = f.vz;
      },
   });

   const [reducedMotion] = useState(prefersReducedMotion);
   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, press: false } as StepInput,
      dir: { x: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      ended: false,
      stats: false,
      /** clarity: the last hint code, the tool-cooling flag, the last refused-press pop */
      code: -1,
      cooling: false,
      refusedAt: -9,
   }));
   // clarity (visual only): a beacon on the crop to walk to and one in the saucer's beam while carrying, the
   // hint line, the tool-cooling pill, the fail pops and the crops that fly into the basket and up the beam
   const [cue] = useState(() => ({
      crop: { x: 0, y: 0.9, z: 0, hidden: true },
      beam: { x: 0, y: 0.2, z: 0, hidden: true },
      hand: { x: 0, y: 1.1, z: 0 },
      top: { x: 0, y: SHIP.hoverY, z: 0 },
      from: { x: 0, y: 0.6, z: 0 },
   }));
   const podToss = useRef<TossHandle>(null);
   const gourdToss = useRef<TossHandle>(null);
   const beamToss = useRef<TossHandle>(null);
   const [markers] = useState<MarkerTarget[]>(() => [
      { x: 0, y: 1, z: 0, hidden: true, color: COLORS.beam },
      { x: 0, y: 0.6, z: 0, hidden: true, color: COLORS.mint },
   ]);
   useFarmSound(run);

   useEffect(() => {
      scratch.code = hintCode(run, cropGoal(run));
      GUIDE.set(farmHint(run, scratch.code, touch));
      return () => {
         GUIDE.reset();
         COOLING.reset();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "score"), [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, actionPressed, jumpPressed } = input.current;
      const { step, dir, at } = scratch;
      inputToWorld(moveX, moveY, cam.yaw(), dir);
      step.dirX = dir.x;
      step.dirZ = dir.z;
      // one attempt per frame from either button (E / Enter / Harvest or Space)
      step.press = actionPressed || jumpPressed;
      const ev = run.events;
      const wasCooling = toolCooling(run);
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
         // Juicy glow sparkle feedback on perfect pick
         fx.burst("sparkle", at, ev.pickedPerfect ? 26 : 14);
         at.y = 1.5;
         fx.score(
            at,
            ev.pickedPerfect ? `+${SCORE.perfect} perfect` : `+${SCORE.harvest}`,
            { color: ev.pickedPerfect ? COLORS.gold : "#dcfce7", size: ev.pickedPerfect ? 0.08 : 0.065 }
         );
         // the crop flies from its bed into the farmer's arms
         cue.from.x = plot.x;
         cue.from.z = plot.z;
         (plot.kind === "gourd" ? gourdToss : podToss).current?.play(cue.from, cue.hand, { duration: 0.32, height: 0.7, scaleFrom: 1, scaleTo: 0.5 });
         playSfx("pop", { pitch: ev.pickedPerfect ? 1.5 : 1 });
         playSfx("pickup", { volume: ev.pickedPerfect ? 0.75 : 0.6 });
         if (ev.pickedPerfect) {
            playSfx("chime", { volume: 0.55, pitch: 1 + 0.08 * Math.min(6, run.streak) });
            if (run.streak >= 3) fx.shake(0.06);
         }
      }
      if (ev.missed >= 0) {
         const plot = run.plots[ev.missed];
         at.x = plot.x;
         at.y = 0.5;
         at.z = plot.z;
         // the mistimed press bursts the crop (rules.press): a coral puff, spores land, a short daze
         fx.burst("puff", at, 18);
         at.y = 1.4;
         pop.fail(at, run.time < cyclePeak(plot, cycleIndex(plot, run.time)) ? "Burst! Too early" : "Burst! Too late", { shake: 0 });
         playSfx("hit", { volume: 0.25 });
         playSfx("thud", { volume: 0.2, pitch: 0.8 });
         fx.shake(0.05);
      } else if (ev.refused) {
         playSfx("click", { volume: 0.12, pitch: 0.7 });
         if (run.time - scratch.refusedAt > 0.8) {
            scratch.refusedAt = run.time;
            at.x = f.x;
            at.y = 1.6;
            at.z = f.z;
            pop.info(at, run.cargoCount >= HARVEST.capacity ? "Basket full!" : wasCooling ? "Tool cooling…" : "Nothing ripe in reach");
         }
      }
      if (ev.delivered > 0) {
         at.x = f.x;
         at.y = 1;
         at.z = f.z;
         fx.burst("sparkle", at, 24);
         // the delivered crops fly up the beam into the saucer
         cue.from.x = f.x;
         cue.from.z = f.z;
         for (let k = 0; k < ev.delivered; k++) beamToss.current?.play(cue.from, cue.top, { duration: 0.4 + k * 0.07, height: 0.8, scaleFrom: 0.6, scaleTo: 0.25 });
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
      const goal = cropGoal(run);
      cue.crop.hidden = goal < 0;
      if (goal >= 0) {
         cue.crop.x = run.plots[goal].x;
         cue.crop.z = run.plots[goal].z;
      }
      cue.beam.hidden = !beamGoal(run);
      cue.beam.x = run.ship.x;
      cue.beam.z = run.ship.z;
      cue.hand.x = run.farmer.x;
      cue.hand.z = run.farmer.z;
      cue.top.x = run.ship.x;
      cue.top.z = run.ship.z;
      const code = hintCode(run, goal);
      if (code !== scratch.code) {
         scratch.code = code;
         GUIDE.set(farmHint(run, code, touch));
      }
      const cooling = toolCooling(run);
      if (cooling !== scratch.cooling) COOLING.set((scratch.cooling = cooling));
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
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0], fov: VIEW.fov }}
            follow={run.farmer}
            followFraction={1}
            damping={5}
            offset={view.offset}
            shift={view.shift}
         />
         <FarmScene />
         <Crops run={run} reducedMotion={reducedMotion} />
         <Saucer run={run} reducedMotion={reducedMotion} />
         <Farmer run={run} />
         <TargetBeacon target={cue.crop} variant="pick" color={COLORS.mint} radius={0.9} height={1.0} />
         <TargetBeacon target={cue.beam} variant="drop-here" color={COLORS.beam} radius={SHIP.beamRadius} height={1.6} label="BEAM" />
         <Toss ref={podToss} spin={0}>
            <Model asset={ASSETS.glowPod} />
         </Toss>
         <Toss ref={gourdToss} spin={0}>
            <Model asset={ASSETS.gourd} />
         </Toss>
         <Toss ref={beamToss} slots={4} spin={4}>
            <Model asset={ASSETS.glowPod} />
         </Toss>
         <TargetMarkers targets={markers} size={30} />
      </>
   );
}
