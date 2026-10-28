import { describe, expect, it } from "vitest";
import { createArcadeStore } from "../../core/useArcadeStore";
import { withinServerLimits } from "../../core/limits";
import { LEVEL_IDS } from "../../types";
import { M2_HERO_IDS } from "../../menu2/heroModels";
import { createRun, step, maxScoreFor, limitsFor } from "./rules";
import { botInput } from "./bot";
import { LEVELS } from "./levels";
import { ziplineRushMeta } from "./meta";

describe("Zipline Rush per-level proof through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: all five heroes finish at 30, 60 and 144 Hz inside the pinned bounds`, () => {
         const limits = limitsFor(id);
         for (const hero of M2_HERO_IDS) for (const fps of [30, 60, 144]) {
            const run = createRun(id, hero), store = createArcadeStore();
            store.getState().configure({ durationMs: null }); store.getState().markReady(); store.getState().start();
            for (let f = 0; f < 60000 && store.getState().phase !== "over"; f++) {
               store.getState().tick(1000 / fps);
               if (store.getState().phase !== "playing") continue;
               step(run, store.getState().frameMs, botInput(run));
               store.getState().setScore(run.score);
               expect(store.getState().score).toBeLessThanOrEqual(limits.maxScore);
               if (run.ended) store.getState().end(run.ended);
            }
            const state = store.getState();
            expect(state.endReason, `${hero}/${fps}`).toBe("win");
            expect(withinServerLimits(state.score, Math.round(state.elapsedMs), limits)).toBe(true);
         }
      }, 120_000);
      it(`L${id}: random inputs, retries and power spam cannot multiply a finite score source`, () => {
         for (let seed = 1; seed <= 12; seed++) {
            const r = createRun(id, M2_HERO_IDS[seed % 5]); let n = seed;
            const rand = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
            for (let f = 0; f < 25000 && !r.ended; f++) {
               step(r, 8 + rand() * 40, { x: rand() * 2 - 1, throttle: rand() * 2 - 1, yaw: rand() * Math.PI * 2, jump: rand() < 0.15, power: true });
               expect(r.score).toBeLessThanOrEqual(maxScoreFor(id));
               expect(r.orbs).toBeLessThanOrEqual(LEVELS[id].sections * 4);
               expect(r.combo.events).toBeLessThanOrEqual(LEVELS[id].sections * 5);
            }
         }
      }, 120_000);
   }
   it("pins independent limit rows; an extra orb or landing would require a new proof", () => {
      expect(LEVEL_IDS.map(maxScoreFor)).toEqual([1460, 1780, 2100, 2420, 3990]);
      expect(LEVEL_IDS.map((id) => ziplineRushMeta.levels![id - 1].scoring)).toEqual(LEVEL_IDS.map(limitsFor));
      for (const id of LEVEL_IDS) {
         const sources = LEVELS[id].sections * 4 * (30 + 20) + LEVELS[id].sections * (100 + 20) + (id === 5 ? 5 * 250 : 0) + 500;
         expect(maxScoreFor(id)).toBe(sources);
         expect(sources + 1).toBeGreaterThan(limitsFor(id).maxScore);
      }
   });
});
