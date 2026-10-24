// Test-only driver: real store clock, honest inputs, no direct kills or score writes.
import { expect } from "vitest";
import type { LevelId } from "@/arcade3d/types";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, createInput, createRun, flightTime, predict, reload, splash, stepRun, threatenedCrew, type CastleRun } from "./rules";

export type Profile = "random" | "human" | "oracle" | "idle" | "spam";
export function levelBot(seed: number, profile: Profile, hz: number, id: LevelId) {
   const run = createRun(seed, LEVELS[id]), input = createInput(), rng = createRng(seed ^ 0xba7);
   input.coarse = seed % 2 === 0;
   const aim = { x: 0, y: 0, z: 0 }, predicted = { x: 0, y: 0, z: 0 };
   let target = -1, decision = 0, fireAt = 0;
   let boundsOK = true, hpOK = true;
   const started = performance.now(), limits = PROPOSED_LEVEL_LIMITS[id];
   const pendingHP = (g: CastleRun["goblins"][number], at: number) => {
      let hp = g.hp;
      for (const b of run.balls) if (b.active && b.impact <= at) {
         predict(g, Math.max(0, b.impact - run.time), predicted);
         if (Math.hypot(predicted.x - b.tx, predicted.z - b.tz) <= splash(run)) hp -= g.kind === "shield" && b.tz >= predicted.z ? 0.5 : 1;
      }
      return hp;
   };
   const final = simulateRun(createArcadeStore(), { frame: fixedFrames(1000 / hz), step(dt, _time, store) {
      input.fire = false; input.rock = false; input.point = false; input.choice = 0;
      // Keep the 0.3s tap clock running through offers; never catch up by spamming frames.
      const randomTap = (profile === "random" || profile === "spam") && run.time + 1e-9 >= fireAt;
      if (randomTap) fireAt += profile === "spam" ? 0 : 0.3;
      if (run.offer) {
         // Preserve the existing human's lowest-card/no-double route. Oracle favours double.
         const preferred = [3, 1, 0, 2];
         if (run.chosen < 0 && profile !== "idle") input.choice = profile === "random" || profile === "spam" ? 1 + Math.floor(rng() * 2) : profile === "human" ? 1 :
            preferred.indexOf(run.cards[0]) < preferred.indexOf(run.cards[1]) ? 1 : 2;
      } else if (randomTap) {
         input.point = true; input.x = rng() * 10 - 5; input.z = rng() * 8 - 6;
         input.fire = true; input.rock = rng() < 0.5;
      } else if (profile === "human" || profile === "oracle") {
         if (run.time + 1e-9 >= decision) {
            target = -1; let urgency = -Infinity;
            for (const g of run.waves[run.wave]) if (g.status === "ground") {
               if (profile === "human" && run.time - g.spawn < 0.35) continue;
               if (profile === "oracle" && pendingHP(g, run.time + flightTime(g.x, g.z)) <= 0) continue;
               const u = -(8.8 - g.s) / g.speed + (g.kind === "crew" ? 0.5 : 0);
               if (u > urgency) { urgency = u; target = g.id; }
            }
            decision = run.time + (profile === "human" ? 0.35 : 0.05);
            if (target >= 0) {
               const g = run.goblins[target];
               let t = flightTime(g.x, g.z);
               for (let n = 0; n < 3; n++) { predict(g, t, aim); t = flightTime(aim.x - g.lateral, aim.z); }
               predict(g, t, aim); aim.x -= g.lateral;
               if (g.kind === "shield") aim.z -= 0.65;
               if (profile === "human") {
                  const angle = rng() * Math.PI * 2, error = Math.sqrt(rng()) * 0.6;
                  aim.x += Math.cos(angle) * error; aim.z += Math.sin(angle) * error;
               }
            }
         }
         if (target >= 0 && run.goblins[target].status === "ground" && run.time + 1e-9 >= fireAt && run.time + 1e-9 >= run.ready) {
            input.x = aim.x; input.z = aim.z; input.fire = true; input.point = true;
            fireAt = run.time + (profile === "human" ? 1.2 : reload(run));
         }
         const c = threatenedCrew(run);
         if (c >= 0 && run.time - run.crews[c].erected >= (profile === "human" ? 0.35 : 0)) input.rock = true;
      }
      const before = run.score;
      stepRun(run, input, dt);
      const s = store.getState();
      if (run.score !== before) s.addScore(run.score - before);
      if (s.stats.hp !== run.hp) s.setStat("hp", run.hp);
      if (s.stats.combo !== run.combo) s.setStat("combo", run.combo);
      if (run.end) { if (run.end === "win") s.setScore(run.score); s.end(run.end); }
      boundsOK &&= run.score <= limits.base! + limits.maxPointsPerSec! * s.elapsedMs / 1000 + 1e-6;
      hpOK &&= Number.isInteger(run.hp) && run.hp >= 0 && run.hp <= 125;
   } });
   expect(boundsOK).toBe(true); expect(hpOK).toBe(true);
   expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
   expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
   expect(run.end).not.toBe("timeup"); expect(final.stats.combo).toBe(run.combo);
   if (run.end === "win") expect(run.time).toBeCloseTo(run.starts[run.starts.length - 1] + run.config.clearAt, 8);
   return { run, final, runtimeMs: performance.now() - started };
}
