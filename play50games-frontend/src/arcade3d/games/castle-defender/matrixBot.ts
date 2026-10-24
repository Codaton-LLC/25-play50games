// Test-only (vitest): the rules.test.ts bot profiles on the real store, and the 480-run difficulty
// matrix (4 profiles x 30 / 60 / 144 Hz x 40 seeds), split into one matrix.<profile>.test.ts file
// per profile so vitest runs them in parallel. Runtime code never imports this file.
import { expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { PROPOSED_LIMITS, TYPES, createInput, createRun, flightTime, predict, reload, splash, stepRun, threatenedCrew, type CastleRun } from "./rules";

// All profiles drive the actual inputs, clock, store, reload and projectile flight.
export type Profile = "random" | "human" | "oracle" | "idle";
export function bot(seed: number, profile: Profile, hz: number) {
   const run = createRun(seed), input = createInput(), rng = createRng(seed ^ 0xba7);
   input.coarse = seed % 2 === 0;
   const aim = { x: 0, y: 0, z: 0 }, predicted = { x: 0, y: 0, z: 0 };
   let target = -1, decision = 0, fireAt = 0;
   let boundsOK = true, hpOK = true;
   const started = performance.now();
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
      const randomTap = profile === "random" && run.time + 1e-9 >= fireAt;
      if (randomTap) fireAt += 0.3;
      if (run.offer) {
         // Preserve the existing human's lowest-card/no-double route. Oracle favours double.
         const preferred = [3, 1, 0, 2];
         if (run.chosen < 0 && profile !== "idle") input.choice = profile === "random" ? 1 + Math.floor(rng() * 2) : profile === "human" ? 1 :
            preferred.indexOf(run.cards[0]) < preferred.indexOf(run.cards[1]) ? 1 : 2;
      } else if (randomTap) {
         input.point = true; input.x = rng() * 10 - 5; input.z = rng() * 8 - 6;
         input.fire = true; input.rock = rng() < 0.5;
      } else if (profile === "human" || profile === "oracle") {
         if (run.time + 1e-9 >= decision) {
            target = -1; let urgency = -Infinity;
            for (const g of run.goblins) if (g.status === "ground") {
               if (profile === "human" && run.time - g.spawn < 0.35) continue;
               if (profile === "oracle" && pendingHP(g, run.time + flightTime(g.x, g.z)) <= 0) continue;
               const u = -(8.8 - g.s) / TYPES[g.kind].speed + (g.kind === "crew" ? 0.5 : 0);
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
      boundsOK &&= run.score <= PROPOSED_LIMITS.base + PROPOSED_LIMITS.maxPointsPerSec * s.elapsedMs / 1000 + 1e-6;
      hpOK &&= Number.isInteger(run.hp) && run.hp >= 0 && run.hp <= 125;
   } });
   expect(boundsOK).toBe(true); expect(hpOK).toBe(true);
   expect(withinServerLimits(final.score, final.elapsedMs, PROPOSED_LIMITS)).toBe(true);
   expect(capScore(final.score, final.elapsedMs, PROPOSED_LIMITS)).toBe(final.score);
   expect(run.end).not.toBe("timeup"); expect(final.stats.combo).toBe(run.combo);
   if (run.end === "win") expect(run.time).toBeCloseTo(136, 8);
   return { run, final, runtimeMs: performance.now() - started };
}

export function matrixRows(profile: Profile): void {
   for (const hz of [30, 60, 144]) {
      it(`${profile}: 40 seeds at ${hz}Hz`, () => {
         const results = Array.from({ length: 40 }, (_, seed) => bot(seed, profile, hz));
         const scores = results.map((r) => r.final.score);
         const wins = results.filter((r) => r.run.end === "win").length;
         const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
         const best = Math.max(...scores);
         console.info("castle-defender bots", { profile, hz, seeds: 40, wins, winRate: wins / 40,
            mean, min: Math.min(...scores), max: best, runtimeMs: Math.round(results.reduce((a, r) => a + r.runtimeMs, 0)) });
         if (profile === "random") { expect(mean).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore * 0.4); expect(wins).toBeLessThanOrEqual(16); }
         if (profile === "human") expect(wins).toBeGreaterThanOrEqual(32);
         if (profile === "human") expect(results.every((r) => r.run.stacks[3] === 0)).toBe(true);
         if (profile === "oracle") { expect(mean).toBeGreaterThanOrEqual(PROPOSED_LIMITS.maxScore * 0.85); expect(best).toBeGreaterThanOrEqual(PROPOSED_LIMITS.maxScore * 0.9); }
         if (profile === "idle") { expect(wins).toBe(0); expect(results.every((r) => r.run.killed === 0)).toBe(true); }
      }, 60000);
   }
}
