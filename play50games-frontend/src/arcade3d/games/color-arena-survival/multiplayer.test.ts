// Local multiplayer: N runs on ONE arena (run 0 advances it); a lock-in needs every hero still in; co-op
// spreads shield / magnet / phase; two honest bots survive level 1 (versus, placings and a leader); a
// co-op team of two bots clears level 2; the arena keeps going when P1 is out.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { START_MS, STEP_MS, createStepInput, tileCentre, tileSafe } from "./rules";
import { createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";

describe("color-arena-survival multiplayer", () => {
   it("every run shares the one arena; only run 0 advances it", () => {
      const m = createMultiRun(1, 2, ["kiro", "nami", "zuno"], "versus");
      expect(m.runs[1].arena).toBe(m.arena);
      expect(m.runs[2].arena).toBe(m.arena);
      const inputs = m.runs.map(() => createStepInput());
      for (let k = 0; k < 60; k++) stepMulti(m, 1000 / 60, inputs);
      expect(m.arena.simMs).toBeCloseTo(m.runs[0].simMs, 3);
   });

   it("a lock-in needs every hero still in: one hero standing on the colour is not enough", () => {
      const m = createMultiRun(2, 1, ["kiro", "nami"], "coop");
      const inputs = m.runs.map(() => createStepInput());
      while (m.arena.simMs < START_MS + 20) stepMulti(m, STEP_MS, inputs);
      const a = m.arena;
      const safe = [...a.colour.keys()].find((i) => tileSafe(a, i))!;
      const c = tileCentre(a, safe, { x: 0, z: 0 });
      const h = m.runs[0].hero;
      for (let k = 0; k < 200; k++) {
         h.x = c.x;
         h.z = c.z;
         // P2 keeps running, so never locks in
         m.runs[1].hero.vx = 6;
         stepMulti(m, STEP_MS, inputs);
      }
      expect(a.votes[0]).toBe(true);
      expect(a.phase).toBe("call");
   });

   it("co-op: a shield, a magnet and a phase cover the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "vexa"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 5000;
      a.magnetUntil = 4000;
      a.phaseUntil = 3000;
      onAllyPower({ source: a, ally: b, power: "shield" } as never);
      onAllyPower({ source: a, ally: b, power: "magnet" } as never);
      onAllyPower({ source: a, ally: b, power: "phase" } as never);
      expect([b.shieldUntil, b.magnetUntil, b.phaseUntil]).toEqual([5000, 4000, 3000]);
   });

   it("two honest bots survive level 1 (versus): placings and a leader", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 40_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].place).toBe(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
   }, 120_000);

   it("a co-op team of two bots clears level 2 together", () => {
      const m = createMultiRun(2, 2, ["vexa", "riko"], "coop");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
   }, 120_000);

   it("when P1 is out the arena keeps going for P2", () => {
      const m = createMultiRun(3, 1, ["kiro", "nami"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      m.runs[0].lives = 1;
      m.runs[0].hero.x = 100; // off the floor: P1 falls out at once
      m.runs[0].hero.grounded = false;
      for (let f = 0; f < 40_000 && m.ended === null; f++) {
         botInput(bots[1], m.runs[1], inputs[1]);
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.runs[0].ended).toBe("lose");
      expect(m.runs[1].ended).toBe("win");
   }, 120_000);
});
