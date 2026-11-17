import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "./rules";
import { botInput } from "./bot";

describe("local multiplayer: 2-4 pairs on their own copies of the course", () => {
   it("three bots clear L2 side by side; every pair has its own distance, cracks and finish time", () => {
      const w = createWorld(2, ["vexa", "riko", "kiro"]);
      for (let f = 0; f < 60 * 120 && !w.ended; f++) stepWorld(w, 1000 / 60, w.pairs.map((_, k) => botInput(w, k)));
      expect(w.pairs.every((p) => p.ended === "win")).toBe(true);
      for (const p of w.pairs) expect(p.finishMs).toBeGreaterThan(0);
   }, 120_000);
});
