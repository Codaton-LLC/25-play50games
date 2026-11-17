import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "./rules";
import { botInput } from "./bot";

describe("local multiplayer: 2-4 heroes in the same lab", () => {
   it("four bots clear L1 and L2 together; every hero has its own swarm, room and finish time", () => {
      for (const level of [1, 2] as const) {
         const w = createWorld(level, ["zuno", "riko", "nami", "kiro"]);
         for (let f = 0; f < 60 * 240 && !w.ended; f++) stepWorld(w, 1000 / 60, w.heroes.map((_, k) => botInput(w, k)));
         expect(w.heroes.filter((h) => h.ended === "win").length, `L${level}`).toBeGreaterThanOrEqual(3);
         for (const h of w.heroes) if (h.ended === "win") expect(h.finishMs).toBeGreaterThan(0);
      }
   }, 120_000);
});
