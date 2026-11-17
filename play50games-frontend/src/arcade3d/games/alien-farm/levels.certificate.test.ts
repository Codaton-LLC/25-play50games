// Alien Farm level certificates for L4 and L5 (the slow half of levels.test.ts's "analytical scoring
// proofs", split into its own file so vitest runs both halves in parallel). Same proof, same code.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { alienFarmMeta as meta } from "./meta";
import { CYCLE, HARVEST, PROPOSED_LEVEL_LIMITS } from "./rules";
import { boundNodes, firstPress, harvestBound, pressGap } from "./bound";

describe("alien-farm levels: analytical scoring proofs (arcade-score-limits skill)", () => {
   const EXPECTED_STAR = {
      1: { star: 12400, H: 71, maxScore: 12900, pps: 250 },
      2: { star: 19750, H: 112, maxScore: 20600, pps: 250 },
      3: { star: 25850, H: 146, maxScore: 26900, pps: 260 },
      4: { star: 21250, H: 127, maxScore: 22100, pps: 260 },
      5: { star: 29250, H: 163, maxScore: 30500, pps: 260 },
   } as const;

   for (const id of [4, 5] as const) {
      it(`L${id} (${meta.levels![id - 1].title}): certificate S* and H*, 3-5% margin, rate inequality`, () => {
         const lvl = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const exp = EXPECTED_STAR[id];

         const opts = {
            deadline: lvl.durationMs / 1000,
            plots: lvl.plots,
            halfLate: lvl.cycleHalfLate,
         };

         // Compute S* over all 16 tables
         const S = Array.from({ length: 16 }, (_v, t) => harvestBound(t, opts).best);
         const star = Math.max(...S);
         expect(star).toBe(exp.star);

         // maxScore = 100 * ceil(1.04 * star / 100)
         expect(limits.maxScore).toBe(exp.maxScore);
         expect(limits.maxScore).toBe(100 * Math.ceil((1.04 * star) / 100));
         const margin = limits.maxScore / star - 1;
         expect(margin).toBeGreaterThanOrEqual(0.03);
         expect(margin).toBeLessThanOrEqual(0.05);

         // Rate: every harvest pays at most 200 (50 + 50 perfect + its 100 share of a full load), so the
         // score at t is at most 200 H(t). Presses on different beds are >= g = min pressGap apart (bed
         // positions are the same on every level); the same bed repeats only a cycle later (>= C - 2 x 0.9
         // s > g). The first press is >= f = the level's earliest (window open, walk from the start) over
         // every offset table. So the H-th press is at >= f + (H - 1) g, and base + pps t covers 200 H.
         let g = Infinity;
         for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) if (a !== b) g = Math.min(g, pressGap(a, b));
         expect(g).toBeCloseTo(71 / 90, 6);
         for (const p of lvl.plots) expect(p.cycleS - 2 * CYCLE.halfEarly).toBeGreaterThan(g);
         let f = Infinity;
         for (let t = 0; t < 16; t++) for (const n of boundNodes(t, opts.deadline, lvl.plots, lvl.cycleHalfLate)) f = Math.min(f, Math.max(n.open, firstPress(n.plot)));
         const lastPress = opts.deadline - HARVEST.channelS;
         const maxH = Math.floor(1 + (lastPress - f) / g);
         let minMargin = Infinity;
         for (let h = 1; h <= maxH; h++) minMargin = Math.min(minMargin, limits.base! + limits.maxPointsPerSec! * (f + (h - 1) * g) - 200 * h);
         expect(minMargin).toBeGreaterThanOrEqual(0);
      }, 120000);
   }
});

