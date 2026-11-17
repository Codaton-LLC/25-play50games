import { describe, expect, it } from "vitest";
import { createArcadeStore } from "../../core/useArcadeStore";
import { LEVEL_IDS } from "../../types";
import { HEROES } from "./heroes";
import { botInput } from "./bot";
import { createRun, step, idleInput, STAT, finalScore, LIMITS, HOP_MS } from "./rules";
import { LEVELS } from "./levels";

// One real-store proof per level: an input-only bot leads with each of the five heroes, through the
// genuine countdown and play ticks, and its finish obeys the level's pinned limits.
describe("real-store score proofs", () => {
   for (const level of LEVEL_IDS) it(`L${level}: every lead hero's honest run wins inside its limits`, () => {
      for (const hero of HEROES) {
         const r = createRun(17, level, hero.id);
         const store = createArcadeStore();
         store.getState().configure({ durationMs: null, lives: null }, level);
         store.getState().markReady();
         store.getState().start();
         const input = idleInput();
         for (let f = 0; f < 40_000 && store.getState().phase !== "over"; f++) {
            store.getState().tick(1000 / 60);
            const s = store.getState();
            if (s.phase !== "playing" || s.frameMs <= 0) continue;
            botInput(r, input);
            step(r, s.frameMs, input);
            if (r.ended) {
               s.setStat(STAT.level, level);
               s.setStat(STAT.finishMs, r.finishMs);
               s.end(r.ended);
            }
         }
         expect(r.ended, `${hero.id}: codes ${r.codes}/${r.config.codes} hearts ${r.hearts} boss ${r.boss?.hp}/${r.boss?.phase} shards ${r.shards} t=${r.simMs}`).toBe("win");
         const value = finalScore(store.getState());
         const lim = LIMITS[level];
         expect(value.durationMs).toBeGreaterThanOrEqual(lim.minDurationMs);
         expect(value.durationMs).toBeLessThanOrEqual(lim.maxDurationMs);
         expect(value.score).toBeLessThanOrEqual(lim.maxScore);
         expect(value.score).toBe(Math.floor((LEVELS[level].durationMs - value.durationMs) / 10));
         expect(value.durationMs).toBeGreaterThan(HOP_MS);
         console.log(`L${level} lead ${hero.id}: ${(value.durationMs / 1000).toFixed(2)} s, score ${value.score}, orbs ${r.orbs}, hits ${r.hits}`);
      }
   });
});
