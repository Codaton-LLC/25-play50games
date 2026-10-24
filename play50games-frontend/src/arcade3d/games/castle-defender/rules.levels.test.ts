import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";
import { levelBot } from "./levelBots";

describe("per-level real-store score and solvability proofs", () => {
   for (const id of LEVEL_IDS) for (const profile of ["oracle", "human", "idle", "random", "spam"] as const) {
      it("L" + id + ": " + profile + " across 200 seeds and 30/60/144 Hz", () => {
         let wins = 0, best = 0, sum = 0;
         for (let seed = 0; seed < 200; seed++) {
            const result = levelBot(seed, profile, [30, 60, 144][seed % 3], id);
            if (result.run.end === "win") wins++;
            best = Math.max(best, result.final.score); sum += result.final.score;
         }
         console.info("castle levels", { id, profile, seeds: 200, wins, best, mean: sum / 200 });
         if (profile === "oracle") { expect(wins).toBe(200); expect(best).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore * 0.9); }
         if (profile === "human") expect(wins).toBeGreaterThanOrEqual(180);
         if (profile === "idle") expect(wins).toBe(0);
      }, 60000);
   }
});
