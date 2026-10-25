// Bot proofs per level (docs/arcade-levels.md §5): honest inputs only, 200 human-paced seeds,
// oracle / spam / idle sweeps at 30/60/144 Hz, then smaller real-store matrices. Level 1 keeps its
// legacy always-win ending; Levels 2-5 clear only by reaching their goal target (a win).
import { describe, expect, it } from "vitest";
import { isLevelCleared } from "@/arcade3d/core/levels";
import { withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { penaltyHeroMeta as meta } from "./meta";
import {
   PROPOSED_LEVEL_LIMITS,
   ZONES,
   capScore,
   createRun,
   finalScore,
   levelReticleOffset,
   step,
   withinServerLimits,
   type RunState,
   type StepInput,
} from "./rules";

type Profile = "oracle" | "human" | "spam" | "idle";
const HZ = [30, 60, 144];
const SWEEP: Record<Profile, number> = { human: 200, oracle: 30, spam: 6, idle: 3 };

/** The bot sees only the current public run: never the next keeper or read draw. */
function createBot(seed: number, profile: Profile, id: LevelId) {
   const run = createRun(seed, LEVELS[id]);
   const rng = createRng(seed ^ 0x5eed);
   let aimedShot = -1;
   let fireAt = 0;
   let zone = 4;

   function advance(dtMs: number): void {
      const input: StepInput = {};
      if (run.phase === "aim") {
         if (aimedShot !== run.shotsDone) {
            aimedShot = run.shotsDone;
            if (profile === "human") {
               // Cycle through every zone, never feeding the same keeper zone twice in a row.
               zone = (zone + 1 + Math.floor(rng() * 5)) % ZONES.length;
               fireAt = run.elapsedMs + 180 + rng() * 120;
            } else if (profile === "oracle") {
               // Perfect timing plus the least reinforced zone is the optimal public-information policy.
               let weight = Infinity;
               for (let i = 0; i < run.weights.length; i++) {
                  if (run.weights[i] < weight) {
                     weight = run.weights[i];
                     zone = i;
                  }
               }
               fireAt = run.elapsedMs;
            }
         }
         if (profile === "spam") {
            input.zoneId = ZONES[Math.floor(rng() * ZONES.length)];
            input.jumpPressed = true;
         } else if ((profile === "human" || profile === "oracle") && run.elapsedMs + 1e-9 >= fireAt) {
            const offset = levelReticleOffset(run.aimMs, run.reticlePhase, run.config);
            const margin = profile === "human" ? 0.8 : 0.98;
            if (Math.abs(offset) <= run.config.reticleBand * margin) input.zoneId = ZONES[zone];
         }
      }
      step(run, dtMs, input);
   }

   return { run, advance };
}

function prefixFits(run: RunState, id: LevelId): boolean {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   return run.score * 1000 <= limits.base! * 1000 + limits.maxPointsPerSec! * run.elapsedMs + 1e-6;
}

function rulesRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id);
   let prefixOK = true;
   let guard = 0;
   while (!bot.run.ended && guard++ < 200000) {
      bot.advance(1000 / hz);
      prefixOK &&= prefixFits(bot.run, id);
   }
   expect(bot.run.ended).not.toBeNull();
   return { run: bot.run, prefixOK };
}

function storeRun(seed: number, profile: Profile, hz: number, id: LevelId) {
   const bot = createBot(seed, profile, id);
   let prefixOK = true;
   const final = simulateRun(createArcadeStore(), {
      frame: fixedFrames(1000 / hz),
      step(dt, _time, store) {
         bot.advance(dt * 1000);
         const state = store.getState();
         if (state.score !== bot.run.score) state.setScore(bot.run.score);
         if (bot.run.ended) state.end(bot.run.ended);
         prefixOK &&= prefixFits(bot.run, id);
      },
   });
   return { run: bot.run, final, prefixOK };
}

describe("penalty-hero levels: bots and server limits", () => {
   for (const id of LEVEL_IDS) {
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const level = meta.levels![id - 1];

      it(`L${id}: 200-seed human sweep at 30/60/144 Hz, clear rate and oracle reach`, () => {
         const stats: Record<string, { clears: number; best: number; mean: number }> = {};
         for (const profile of Object.keys(SWEEP) as Profile[]) {
            let clears = 0, best = 0, sum = 0;
            for (let seed = 0; seed < SWEEP[profile]; seed++) {
               const { run, prefixOK } = rulesRun(seed, profile, HZ[seed % HZ.length], id);
               expect(prefixOK).toBe(true);
               expect(withinServerLimits(run.score, Math.round(run.elapsedMs), limits)).toBe(true);
               expect(capScore(run.score, run.elapsedMs, limits)).toBe(run.score);
               if (isLevelCleared(run.ended, run.score, level)) clears++;
               best = Math.max(best, run.score);
               sum += run.score;
            }
            stats[profile] = { clears, best, mean: Math.round(sum / SWEEP[profile]) };
         }
         console.info("penalty-hero levels", id, JSON.stringify(stats));
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.9 * SWEEP.human);
         expect(stats.oracle.clears).toBe(SWEEP.oracle);
         expect(stats.oracle.best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         if (id === 1) {
            // Today's live game ends every ten-shot run in a win, including idle; that behavior is pinned.
            expect(stats.spam.clears).toBe(SWEEP.spam);
            expect(stats.idle.clears).toBe(SWEEP.idle);
         } else {
            expect(stats.spam.clears).toBe(0);
            expect(stats.idle.clears).toBe(0);
         }
      }, 60000);

      it(`L${id}: real store at 30/60/144 Hz, finalScore inside limits and capScore a no-op`, () => {
         for (const profile of ["oracle", "human", "spam", "idle"] as const) {
            for (const hz of HZ) {
               const { run, final, prefixOK } = storeRun(id * 100 + hz, profile, hz, id);
               const submitted = finalScore(final.score, final.elapsedMs, limits);
               expect(prefixOK).toBe(true);
               expect(final.phase).toBe("over");
               expect(final.endReason).toBe(run.ended);
               expect(final.score).toBe(run.score);
               expect(final.elapsedMs).toBeCloseTo(run.elapsedMs, 8);
               expect(fitsLimits(submitted.score, submitted.durationMs, limits)).toBe(true);
               expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
               expect(submitted.score).toBe(final.score);
               if (profile === "oracle") expect(run.ended).toBe("win");
               if (profile === "idle") expect(run.ended).toBe(id === 1 ? "win" : "lose");
            }
         }
      }, 60000);
   }
});
