// The per-level limits proof through the real arcade store: every hero, at 30 / 60 / 144 Hz, finishes
// every level with the honest bot inside the pinned bounds, power spam and random input never beat the
// floor, and the limits rows read the level they claim (mutation probes).
import { describe, expect, it } from "vitest";
import { createRng } from "../../core/math";
import { createArcadeStore } from "../../core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "../../types";
import { M2_HERO_IDS } from "../../menu2/heroModels";
import { LEVELS } from "./levels";
import { mineTunnelRunMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, finalScore, minDurationMsOf, proposeLimits, STAT, createRun, step, submittedMs, idleInput, type World } from "./rules";
import { botInput } from "./bot";

function storeRun(level: LevelId, hero: (typeof M2_HERO_IDS)[number], fps: number, mash = false): { w: World; submitted: number; score: number } {
   const store = createArcadeStore();
   store.getState().configure({ durationMs: null });
   store.getState().markReady();
   store.getState().start();
   const w = createRun(level, hero);
   for (let f = 0; f < fps * 400 && store.getState().phase !== "over"; f++) {
      store.getState().tick(1000 / fps);
      if (store.getState().phase !== "playing") continue;
      const i = botInput(w);
      if (mash) i.power = f % 3 === 0;
      step(w, store.getState().frameMs, i);
      const h = w.heroes[0];
      if (h.ended) {
         // as Scene.tsx publishes it
         const s = store.getState();
         if (h.ended === "win") {
            s.setStat(STAT.finishMs, h.finishMs);
            s.setStat(STAT.orbs, h.orbs);
            s.setStat(STAT.comboMs, Math.round(h.comboMs));
         }
         s.end(h.ended);
      }
   }
   const st = store.getState();
   const res = finalScore({ score: st.score, endReason: st.endReason, stats: st.stats as Record<string, number>, elapsedMs: st.elapsedMs });
   const lim = PROPOSED_LEVEL_LIMITS[level];
   return { w, submitted: res.durationMs, score: Math.max(0, Math.floor((lim.timeBaseMs - res.durationMs) / 10)) };
}

describe("Mine Tunnel Run per-level proof through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`L${level}: all five heroes clear at 30, 60 and 144 Hz inside the pinned bounds`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of M2_HERO_IDS) {
            for (const fps of [30, 60, 144]) {
               const r = storeRun(level, hero, fps);
               expect(r.w.ended, `${hero} ${fps} Hz`).toBe("win");
               expect(r.submitted).toBe(submittedMs(r.w.heroes[0]));
               expect(r.submitted).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(r.submitted).toBeLessThanOrEqual(lim.maxDurationMs);
               expect(r.score).toBeLessThanOrEqual(lim.maxScore);
            }
         }
      }, 300_000);
      it(`L${level}: power mashing and random input never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of M2_HERO_IDS) {
            const r = storeRun(level, hero, 60, true);
            if (r.w.ended === "win") expect(r.submitted, hero).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
         for (let seed = 1; seed <= 12; seed++) {
            const rng = createRng(seed * 7919 + level);
            const w = createRun(level, M2_HERO_IDS[seed % 5]);
            const i = idleInput();
            for (let f = 0; f < 60 * 120 && !w.ended; f++) {
               if (f % 8 === 0) {
                  i.x = rng() * 2 - 1;
                  i.y = rng() * 2 - 0.6;
               }
               i.jump = rng() < 0.2;
               i.power = rng() < 0.2;
               step(w, 4 + rng() * 40, i);
            }
            if (w.ended === "win") expect(submittedMs(w.heroes[0])).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 300_000);
   }
   it("every row is its own level's bound; meta ships the rows in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(minDurationMsOf(id));
         expect(mineTunnelRunMeta.levels![id - 1].scoring.minDurationMs).toBe(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
      }
   });
});
