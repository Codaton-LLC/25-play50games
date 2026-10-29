import { describe, expect, it } from "vitest";
import { createArcadeStore } from "../../core/useArcadeStore";
import { LEVEL_IDS } from "../../types";
import { HEROES } from "./heroes";
import { botInput } from "./bot";
import { createRun, step, idleInput, STAT, finalScore, LIMITS, TOP_SPEED } from "./rules";
import { LEVELS } from "./levels";

describe("real-store score proofs", () => {
   for (const level of LEVEL_IDS) it(`L${level}: every hero's honest run obeys its own limits through the real store`, () => {
      for (const hero of HEROES) {
         const r = createRun(17, level, hero.id);
         const store = createArcadeStore();
         store.getState().configure({ durationMs: null, lives: null }, level);
         store.getState().markReady(); store.getState().start();
         const input = idleInput();
         for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
            store.getState().tick(1000 / 60);
            const s = store.getState();
            if (s.phase !== "playing" || s.frameMs <= 0) continue;
            botInput(r, input);
            step(r, s.frameMs, input);
            expect(r.speed).toBeLessThanOrEqual(TOP_SPEED);
            if (r.ended) {
               s.setStat(STAT.level, level); s.setStat(STAT.finishMs, r.finishMs);
               s.end(r.ended);
            }
         }
         expect(r.ended, `${hero.id}: d=${r.distance.toFixed(1)}, hp=${r.boss?.hp}, charges=${r.charges}, hits=${r.hits}, t=${r.simMs}`).toBe("win");
         const value = finalScore(store.getState()), lim = LIMITS[level];
         expect(value.durationMs).toBeGreaterThanOrEqual(lim.minDurationMs);
         expect(value.durationMs).toBeLessThanOrEqual(lim.maxDurationMs);
         expect(value.score).toBeLessThanOrEqual(lim.maxScore);
         expect(value.score).toBe(Math.floor((LEVELS[level].durationMs - value.durationMs) / 10));
         console.log(`L${level} ${hero.id}: ${value.durationMs.toFixed(1)} ms, ${value.score} points, ${r.orbs}/${r.config.orbs} stars`);
      }
   });
});
