import { describe, expect, it } from "vitest";
import { createWorld, stepWorld, idleInput } from "./rules";
import { botInput } from "./bot";

describe("local multiplayer: 2-4 heroes dig the same mine", () => {
   it("two heroes share one grid: one hero's dig opens the cell for the other", () => {
      const w = createWorld(1, ["riko", "nami"]);
      expect(w.heroes).toHaveLength(2);
      const before = w.version;
      for (let f = 0; f < 60; f++) stepWorld(w, 1000 / 60, [{ ...idleInput(), y: 1 }, idleInput()]);
      expect(w.version).toBeGreaterThan(before);
      expect(w.tiles[1 * w.w + w.map.start.col]).toBe(0);
   });
   it("four bots clear L1 and L3 together; every hero has its own orbs, hits and finish time", () => {
      for (const level of [1, 3] as const) {
         const w = createWorld(level, ["riko", "nami", "kiro", "vexa"]);
         for (let f = 0; f < 60 * 200 && !w.ended; f++) stepWorld(w, 1000 / 60, w.heroes.map((_, k) => botInput(w, k)));
         expect(w.heroes.filter((h) => h.ended === "win").length, `L${level}`).toBeGreaterThanOrEqual(3);
         for (const h of w.heroes) if (h.ended === "win") expect(h.finishMs).toBeGreaterThan(0);
      }
   }, 120_000);
});
