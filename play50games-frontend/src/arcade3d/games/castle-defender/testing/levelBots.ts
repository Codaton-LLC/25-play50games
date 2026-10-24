// Test-only (vitest) helper for rules.levels.test.ts (L1-L3) and rules.levels-late.test.ts (L4-L5),
// split so vitest runs the two halves in parallel. Runtime code never imports this file.
// Bot proofs per level (docs/arcade-levels.md §5): the honest bots never break the level's limits,
// the oracle reaches >= 90 % of maxScore, the human-paced bot clears (wins) >= 90 % of 200 seeds,
// idle never clears. Level 1 also keeps its own 480-run real-store matrix (matrix.<profile>.test.ts).
// The 200-seed sweeps run on the pure rules loop (rulesRun: the same bot at the same frame lengths;
// the store tick is ~80 % of a run's cost); a smaller set per level goes through the real store
// (storeRun) for the end-to-end check.
import { expect, it } from "vitest";
import type { LevelId } from "@/arcade3d/types";
import { isLevelCleared } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "../levels";
import { castleDefenderMeta as meta } from "../meta";
import { PROPOSED_LEVEL_LIMITS, createInput, createRun, flightTime, predict, reload, splash, stepRun, threatenedCrew, type CastleRun } from "../rules";

// The rules.test.ts bot profiles plus input spam; honest inputs only: no direct kills or score writes.
type Profile = "random" | "human" | "oracle" | "idle" | "spam";

function createBot(seed: number, profile: Profile, id: LevelId) {
   const run = createRun(seed, LEVELS[id]), input = createInput(), rng = createRng(seed ^ 0xba7);
   input.coarse = seed % 2 === 0;
   const aim = { x: 0, y: 0, z: 0 }, predicted = { x: 0, y: 0, z: 0 };
   let target = -1, decision = 0, fireAt = 0;
   const pendingHP = (g: CastleRun["goblins"][number], at: number) => {
      let hp = g.hp;
      for (const b of run.balls) if (b.active && b.impact <= at) {
         predict(g, Math.max(0, b.impact - run.time), predicted);
         if (Math.hypot(predicted.x - b.tx, predicted.z - b.tz) <= splash(run)) hp -= g.kind === "shield" && b.tz >= predicted.z ? 0.5 : 1;
      }
      return hp;
   };
   function step(dt: number): void {
      input.fire = false; input.rock = false; input.point = false; input.choice = 0;
      // Keep the 0.3 s tap clock running through offers; spam taps every frame.
      const randomTap = (profile === "random" || profile === "spam") && run.time + 1e-9 >= fireAt;
      if (randomTap && profile === "random") fireAt += 0.3;
      if (run.offer) {
         // The human takes the left card (never Double on purpose); the oracle prefers Double.
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
      stepRun(run, input, dt);
   }
   return { run, step };
}

/** The bot through the real store (as Scene publishes): checks every raw prefix against the level's limits. */
function storeRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id), { run } = bot, limits = PROPOSED_LEVEL_LIMITS[id];
   let prefixOK = true, hpOK = true;
   const final = simulateRun(createArcadeStore(), { frame: fixedFrames(1000 / hz), step(dt, _time, store) {
      const before = run.score;
      bot.step(dt);
      const s = store.getState();
      if (run.score !== before) s.addScore(run.score - before);
      if (s.stats.hp !== run.hp) s.setStat("hp", run.hp);
      if (run.end) { if (run.end === "win") s.setScore(run.score); s.end(run.end); }
      prefixOK &&= run.score <= limits.base! + limits.maxPointsPerSec! * s.elapsedMs / 1000 + 1e-6;
      hpOK &&= Number.isInteger(run.hp) && run.hp >= 0 && run.hp <= 125;
   } });
   return { run, final, prefixOK, hpOK };
}

/** The same bot on the pure rules loop, one fixed frame per step (run.time = the store's played time). */
function rulesRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id), { run } = bot, limits = PROPOSED_LEVEL_LIMITS[id];
   let prefixOK = true;
   while (!run.end) {
      bot.step(1 / hz);
      prefixOK &&= run.score <= limits.base! + limits.maxPointsPerSec! * run.time + 1e-6;
   }
   return { run, prefixOK };
}

const HZ = [30, 60, 144];
const SWEEP: Record<Profile, number> = { human: 200, oracle: 30, random: 30, spam: 6, idle: 6 };

export function levelRows(ids: readonly LevelId[]): void {
   for (const id of ids) {
      const limits = PROPOSED_LEVEL_LIMITS[id], level = meta.levels![id - 1];

      it(`L${id}: 200-seed sweep at 30/60/144 Hz (limits, clear rate, oracle reach)`, () => {
         const stats: Record<string, { clears: number; best: number; mean: number }> = {};
         for (const profile of Object.keys(SWEEP) as Profile[]) {
            let clears = 0, best = 0, sum = 0;
            for (let seed = 0; seed < SWEEP[profile]; seed++) {
               const { run, prefixOK } = rulesRun(seed, profile, HZ[seed % 3], id);
               expect(prefixOK).toBe(true);
               expect(run.end).not.toBe("timeup");
               expect(withinServerLimits(run.score, run.time * 1000, limits)).toBe(true);
               if (isLevelCleared(run.end, run.score, level)) clears++;
               best = Math.max(best, run.score); sum += run.score;
            }
            stats[profile] = { clears, best, mean: Math.round(sum / SWEEP[profile]) };
         }
         console.info("castle-defender levels", id, JSON.stringify(stats));
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.9 * SWEEP.human);
         expect(stats.oracle.clears).toBe(SWEEP.oracle);
         expect(stats.oracle.best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         expect(stats.random.clears).toBe(0);
         expect(stats.spam.clears).toBe(0);
         expect(stats.idle.clears).toBe(0);
      }, 60000);

      it(`L${id}: real store at 30/60/144 Hz: final score inside the limits, capScore a no-op`, () => {
         for (const profile of ["oracle", "human", "spam", "idle"] as const) for (const hz of HZ) {
            const { run, final, prefixOK, hpOK } = storeRun(id * 10 + hz, profile, hz, id);
            expect(prefixOK).toBe(true); expect(hpOK).toBe(true);
            expect(final.phase).toBe("over");
            expect(final.score).toBe(run.score);
            expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
            expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
            if (run.end === "win") expect(run.time).toBeCloseTo(run.starts[run.starts.length - 1] + run.config.clearAt, 8);
            if (profile === "oracle") expect(run.end).toBe("win");
            if (profile === "idle") expect(run.end).toBe("lose");
         }
      }, 60000);
   }
}
