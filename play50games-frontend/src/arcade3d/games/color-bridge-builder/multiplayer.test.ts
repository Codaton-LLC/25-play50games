import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "./rules";
import { botInput } from "./bot";

describe("local multiplayer: a bridge crew on one canyon", () => {
   it("three bots cross L1 together: every team has its own hero, orbs and finish time", () => {
      const w = createWorld(1, ["riko", "nami", "kiro"]);
      for (let f = 0; f < 60 * 120 && !w.ended; f++) stepWorld(w, 1000 / 60, w.teams.map((_, k) => botInput(w, k)));
      expect(w.teams.every((t) => t.ended === "win")).toBe(true);
      for (const t of w.teams) expect(t.finishMs).toBeGreaterThan(0);
   }, 120_000);
});
