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
import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { createAim, stepAim } from "./aim";
import { Bay } from "./Bay";
import { Cannon, createCannonLook, kickCannon } from "./Cannon";
import { SEA_FOCUS, viewFor } from "./looks";
import { advanceRun, createRun, muzzleAt, type RunState } from "./rules";
import { Floaters, Ships, createShipLooks } from "./Ships";

/** The wave's wind for the HUD vane (store stats; README "Accessibility"). */
function showWind(run: RunState) {
   const { x, z } = run.wind;
   const deg = Math.round(((Math.atan2(-z, x) * 180) / Math.PI + 360) % 360);
   const store = useArcadeStore.getState();
   store.setStat("windDeg", deg);
   store.setStat("wind10", Math.round(Math.hypot(x, z) * 10));
}

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   // a new plan every run: GameShell remounts the Scene (and its game time) on start and retry
   const [run] = useState(() => createRun(randomSeed()));
   const [aim] = useState(createAim);
   const [cannon] = useState(createCannonLook);
   const [ships] = useState(createShipLooks);
   const [at] = useState(() => ({ x: 0, y: 0, z: 0 }));

   useEffect(() => fx.warm("smoke", "splash", "debris", "puff", "sparkle", "score"), [fx]);
   useEffect(() => {
      useArcadeStore.getState().setStat("wave", 1);
      showWind(run);
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
         // TODO(P-06): playSfx("chime", { pitch: 0.7 }) as the ship's bell with the wind change
      }
      if (ev.fired > 0) {
         kickCannon(cannon);
         muzzleAt(aim.yaw, aim.elevation, at);
         fx.burst("smoke", at, 10);
         fx.shake(0.12);
         playSfx("jump"); // TODO(P-06): playSfx("boom", { volume: 0.9 }) + "thud" at pitch 0.6; "whoosh" at pitch 1.4 for the far lanes
      }
      for (let i = 0; i < ev.hitCount; i++) {
         const h = ev.hits[i];
         fx.burst("debris", h, h.sunk ? 16 : 9);
         if (h.sunk) {
            fx.burst("splash", h, 20);
            playSfx("pickup");
         } else playSfx("hit"); // TODO(P-06): "hit" as the wood crack; "combo" rising with the streak
      }
      for (let i = 0; i < ev.splashCount; i++) {
         const p = ev.splashes[i];
         fx.burst(ev.islandFlags[i] ? "puff" : "splash", p, 12); // TODO(P-06): playSfx("splash") on a water miss
      }
      for (let i = 0; i < ev.blastCount; i++) {
         const p = ev.blasts[i];
         fx.burst("smoke", p, 22);
         fx.burst("debris", p, 14);
         fx.shake(0.28);
         playSfx("hit"); // TODO(P-06): playSfx("boom", { pitch: 0.7 })
      }
      if (ev.chestHit) playSfx("pickup");
      for (let i = 0; i < ev.scoreCount; i++) {
         const e = ev.scores[i];
         store.addScore(e.points);
         at.x = e.x;
         at.y = e.y + 2;
         at.z = e.z;
         const text = e.chest ? `Treasure +${e.points}` : e.chain > 0 ? `Chain +${e.points}` : e.combo ? `+${e.points} ×1.5` : `+${e.points}`;
         fx.score(at, text, { color: e.combo || e.chain > 0 || e.chest ? "#fde68a" : "#fff7ed" });
         if (e.chest) fx.burst("sparkle", at, 24);
      }
      for (let i = 0; i < ev.harbour; i++) {
         playSfx("hit");
         useArcadeStore.getState().loseLife();
      }
   });

   return (
      <>
         <CameraRig camera={{ position: view.offset, lookAt: SEA_FOCUS }} offset={view.offset} shift={view.shift} />
         <Bay run={run} />
         <Ships run={run} looks={ships} />
         <Floaters run={run} />
         <Cannon run={run} aim={aim} look={cannon} />
      </>
   );
}
