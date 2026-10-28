"use client";

// Pirate Cannon Battle scene: feeds the aim, fire presses and dt into rules.ts every frame and draws
// the result (the treasure-island pattern):
// - run state created once per run (GameShell remounts Scene for every run): a seeded plan and a
//   plain RunState; the frame loop mutates them, never calls setState, never allocates;
// - one useRunFrame: input -> aim.ts (drag, keys, fire) -> rules.advanceRun -> the store (addScore,
//   loseLife, setStat) and the feedback (core/fx bursts and popups, playSfx) on the step's events;
// - visuals (Bay, Ships, Cannon) only read the run state and animate with useGameTime();
// - a fixed camera behind the cannon (looks.ts viewFor: useFittedView keeps the three lanes clear of
//   the HUD, the wind vane and the cookie banner).
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import { useActionPop, useFx } from "@/arcade3d/core/fx";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useInput } from "@/arcade3d/core/input";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { createAim, stepAim } from "./aim";
import { Bay } from "./Bay";
import { Cannon, createCannonLook, kickCannon } from "./Cannon";
import { GUIDE, hintCode, hintFor, targetShip } from "./guide";
import { COLORS, SEA_FOCUS, viewFor } from "./looks";
import { advanceRun, createRun, muzzleAt, type RunState } from "./rules";
import { usePirateLevel } from "./usePirateLevel";
import { Floaters, Ships, createShipLooks } from "./Ships";

/** Stereo position of a sound at world x (the bay spans about x ±20). */
const panAt = (x: number) => Math.max(-0.8, Math.min(0.8, x / 24));
const DEG = Math.PI / 180;

/** The wave's wind for the HUD vane (store stats; README "Accessibility"). */
function showWind(run: RunState) {
   const { x, z } = run.wind;
   const deg = Math.round(((Math.atan2(-z, x) * 180) / Math.PI + 360) % 360);
   const store = useArcadeStore.getState();
   store.setStat("windDeg", deg);
   store.setStat("wind10", Math.round(Math.hypot(x, z) * 10));
}

function LevelScene() {
   const { config } = usePirateLevel();
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   // a static CameraRig puts the camera at camera.position (absolute): the fitted offset is from the
   // focus, so the position is focus + offset (camera.test.ts projects the same camera)
   const position = useMemo<[number, number, number]>(() => [SEA_FOCUS[0] + view.offset[0], SEA_FOCUS[1] + view.offset[1], SEA_FOCUS[2] + view.offset[2]], [view.offset]);
   const input = useInput();
   const fx = useFx();
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const guideCode = useRef(-1);
   const mark = useRef({ x: 0, y: 3.2, z: 0, hidden: true }).current;
   // a new plan every run: GameShell remounts the Scene (and its game time) on start and retry
   const [run] = useState(() => createRun(randomSeed(), config));
   const [aim] = useState(createAim);
   const [cannon] = useState(createCannonLook);
   const [ships] = useState(createShipLooks);
   const [at] = useState(() => ({ x: 0, y: 0, z: 0 }));

   useStageLighting("day", 0, COLORS.sky, COLORS.fog);
   useEffect(() => fx.warm("smoke", "splash", "debris", "puff", "sparkle", "sparks", "score"), [fx]);
   // the surf under the fort while the run is live; the shell stops every loop on pause, the end and
   // mute, so it starts again on resume and unmute
   const live = useArcadeStore((s) => s.phase === "countdown" || s.phase === "playing");
   const muted = useMuted();
   useEffect(() => {
      if (!live || muted) return;
      const surf = startLoop("surf", { volume: 0.22 });
      return () => surf.stop();
   }, [live, muted]);
   useEffect(() => {
      useArcadeStore.getState().setStat("wave", 1);
      showWind(run);
      guideCode.current = hintCode(run);
      GUIDE.set(hintFor(guideCode.current, touch));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   // the game: aim, fire, ships, balls, blasts, harbour, score. Only while "playing", before every visual.
   useRunFrame((_state, dt) => {
      const fire = stepAim(aim, input.current, dt, width, height);
      advanceRun(run, dt, aim.yaw, aim.elevation, fire);
      const ev = run.events;
      const store = useArcadeStore.getState();

      if (ev.wave > 0) {
         store.setStat("wave", ev.wave);
         showWind(run);
         if (ev.wave > 1) playSfx("chime", { pitch: 0.7, volume: 0.7 }); // the ship's bell: a new wave, a new wind
      }
      if (ev.fired > 0) {
         kickCannon(cannon);
         muzzleAt(aim.yaw, aim.elevation, at);
         fx.burst("smoke", at, 14);
         fx.burst("sparks", at, 8);
         fx.shake(0.12);
         const pan = panAt(at.x);
         playSfx("boom", { volume: 0.9, pan });
         playSfx("thud", { pitch: 0.6, pan });
         // a high lob (the far lanes) whistles away
         if (aim.elevation > 12 * DEG) playSfx("whoosh", { pitch: 1.4, volume: 0.45, pan });
      }
      for (let i = 0; i < ev.hitCount; i++) {
         const h = ev.hits[i];
         fx.burst("debris", h, h.sunk ? 22 : 12);
         fx.burst("sparks", h, 6);
         const pan = panAt(h.x);
         playSfx("thud", { pan });
         playSfx("pop", { pitch: 0.8, volume: 0.6, pan }); // the wood cracks
         if (h.sunk) {
            fx.burst("splash", h, 20);
            playSfx("chime", { pan });
         }
      }
      for (let i = 0; i < ev.splashCount; i++) {
         const p = ev.splashes[i];
         const island = ev.islandFlags[i];
         fx.burst(island ? "puff" : "splash", p, 16);
         if (island) playSfx("thud", { pitch: 1.4, volume: 0.5, pan: panAt(p.x) });
         else {
            playSfx("splash", { pan: panAt(p.x) });
            if (ev.hitCount === 0 && ev.blastCount === 0) {
               at.x = p.x;
               at.y = 2;
               at.z = p.z;
               pop.fail(at, "Miss", { shake: 0 });
            }
         }
      }
      for (let i = 0; i < ev.blastCount; i++) {
         const p = ev.blasts[i];
         fx.burst("smoke", p, 26);
         fx.burst("sparks", p, 18);
         fx.burst("debris", p, 16);
         fx.shake(0.28);
         playSfx("boom", { pitch: 0.7, pan: panAt(p.x) });
      }
      if (ev.chestHit) playSfx("pickup", { pitch: 1.2 });
      for (let i = 0; i < ev.scoreCount; i++) {
         const e = ev.scores[i];
         store.addScore(e.points);
         at.x = e.x;
         at.y = e.y + 2;
         at.z = e.z;
         const text = e.chest ? `Treasure +${e.points}` : e.chain > 0 ? `Chain +${e.points}` : e.combo ? `+${e.points} ×1.5` : `+${e.points}`;
         fx.score(at, text, { color: e.combo || e.chain > 0 || e.chest ? "#fde68a" : "#fff7ed" });
         if (e.chest) fx.burst("sparkle", at, 24);
         // the combo cue rises with the streak (x1.5 from the 3rd scoring shot)
         if (e.combo) playSfx("combo", { pitch: Math.min(1.6, 1 + 0.08 * (run.streak - 3)), pan: panAt(e.x) });
      }
      for (let i = 0; i < ev.harbour; i++) {
         playSfx("buzz", { volume: 0.8, pan: 0.6 }); // the harbour is on the right
         useArcadeStore.getState().loseLife();
      }
      // the marked ship (nearest the harbour) and the hint line; the hint is rebuilt only on a change
      const target = targetShip(run);
      mark.hidden = !target;
      if (target) {
         mark.x = target.rider.position.x;
         mark.z = target.rider.position.z;
         mark.y = target.spec.y + 2.4;
      }
      const code = hintCode(run);
      if (code !== guideCode.current) {
         guideCode.current = code;
         GUIDE.set(hintFor(code, touch));
      }
   });

   return (
      <>
         <CameraRig camera={{ position, lookAt: SEA_FOCUS }} shift={view.shift} />
         <Bay run={run} />
         <Ships run={run} looks={ships} />
         <Floaters run={run} />
         <Cannon run={run} aim={aim} look={cannon} />
         <TargetBeacon target={mark} variant="pick" color="#fde047" radius={2.2} height={1.6} label="TARGET" />
      </>
   );
}

/** Remounts when another level is picked, so the waves are that level's. */
export default function Scene() {
   const { id } = usePirateLevel();
   return <LevelScene key={id} />;
}
