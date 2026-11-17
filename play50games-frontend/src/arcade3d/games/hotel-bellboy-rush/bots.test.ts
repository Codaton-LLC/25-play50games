// The bots through the real store (createArcadeStore + advanceRunClock, like the canvas) on every
// level: server limits, capScore a no-op, who wins. The honest bot's 200-seed clear rate at 60 Hz is
// in levels.test.ts; the per-level proof in rules.test.ts.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS } from "@/arcade3d/types";
import { playBot, type BotStyle } from "./bots.testing";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, earliestEndS, earliestWinS } from "./rules";

const RESULTS = new Map<string, ReturnType<typeof playBot>[]>();
function batch(id: (typeof LEVEL_IDS)[number], style: BotStyle, hz: number, seeds: number) {
   const key = `${id}:${style}:${hz}:${seeds}`;
   let out = RESULTS.get(key);
   if (!out) {
      out = [];
      for (let seed = 0; seed < seeds; seed++) out.push(playBot(LEVELS[id], seed * 2654435761 >>> 0, hz, style));
      RESULTS.set(key, out);
   }
   return out;
}

describe("hotel bots through the real store (30 / 60 / 144 Hz)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: every bot run is inside the level's server limits; honest (30 / 144 Hz) wins >= 99 %, the oracle always, idle and spam never`, () => {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (const [style, hz, seeds] of [["honest", 30, 30], ["honest", 144, 30], ["oracle", 60, 120], ["oracle", 144, 30], ["oracle", 30, 30], ["idle", 30, 30], ["spam", 30, 40], ["spam", 60, 40], ["spam", 144, 20]] as const) {
            const runs = batch(id, style, hz, seeds);
            for (const r of runs) {
               expect(withinServerLimits(r.score, r.ms, limits), `${style} ${hz} Hz score ${r.score} at ${r.ms} ms`).toBe(true);
               expect(capScore(r.score, r.ms, limits)).toBe(r.score);
            }
            const wins = runs.filter((r) => r.won).length;
            if (style === "honest") expect(wins / runs.length).toBeGreaterThanOrEqual(0.99);
            if (style === "oracle") expect(wins).toBe(runs.length);
            if (style === "idle") {
               expect(wins).toBe(0);
               expect(runs.every((r) => r.score === 0 && r.reason === "timeup")).toBe(true);
            }
            if (style === "spam") expect(wins).toBe(0);
         }
      });
   }

   it("no bot wins sooner than the level's proven earliest win, and no run of any kind ends before 2 s", () => {
      for (const id of LEVEL_IDS) {
         for (const [style, hz, n] of [["spam", 60, 40], ["honest", 144, 30], ["oracle", 60, 120]] as const) for (const r of batch(id, style, hz, n)) expect(r.ms / 1000).toBeGreaterThanOrEqual(earliestEndS(LEVELS[id]));
         const fastest = Math.min(...batch(id, "oracle", 60, 120).map((r) => r.ms), ...batch(id, "oracle", 144, 30).map((r) => r.ms));
         expect(fastest / 1000).toBeGreaterThanOrEqual(earliestWinS(LEVELS[id]));
      }
   });

   it("the oracle's best run reaches 90 % of maxScore on every level", () => {
      for (const id of LEVEL_IDS) {
         const best = Math.max(...batch(id, "oracle", 60, 120).map((r) => r.score));
         expect(best).toBeGreaterThanOrEqual(0.9 * PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });
});

