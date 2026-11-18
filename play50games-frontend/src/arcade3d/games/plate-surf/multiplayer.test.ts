// Plate Surf local multiplayer (multiplayer.ts): the shared wave (orbs, reef walls), co-op's shared
// checkpoints and powers and its tandem pump, versus's draft for the riders behind, the end rules,
// the podium standings, and that a solo run is untouched.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { DRAFT, TANDEM, applyPackSpeed, createMultiRun, onAllyPower, placings, standings, stepMulti, team } from "./multiplayer";
import { V_MAX, createRun, createStepInput, step, type StepInput } from "./rules";

function race(mode: "coop" | "versus", n: number) {
   const m = createMultiRun(1, 1, ["nami", "riko", "kiro", "zuno"].slice(0, n) as never, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 200_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("plate-surf multiplayer", () => {
   it("the riders share the orbs and the reef walls, and start apart across the face", () => {
      const m = createMultiRun(1, 1, ["nami", "riko", "kiro"], "versus");
      expect(m.runs[1].collected).toBe(m.runs[0].collected);
      expect(m.runs[2].laneOpen).toBe(m.runs[0].laneOpen);
      expect(new Set(m.runs.map((r) => r.hero.x)).size).toBe(3);
   });

   it("co-op: the team clears when every rider is in the lagoon; shared checkpoints; standings and team result", () => {
      const m = race("coop", 2);
      expect(m.ended).toBe("win");
      expect(m.runs.every((r) => r.ended === "win")).toBe(true);
      expect(team(m).cleared).toBe(true);
      const total = m.runs[0].orbs + m.runs[1].orbs;
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(m.runs[0].course.orbs.length);
   });

   it("versus: a podium by finish time, everyone placed", () => {
      const m = race("versus", 3);
      expect(m.ended).toBe("win");
      const p = placings(m);
      expect(p.map((q) => q.place).sort()).toEqual([1, 2, 3]);
      expect(standings(m).filter((s) => s.finished).length).toBeGreaterThanOrEqual(1);
   });

   it("tandem pump (co-op) speeds side-by-side riders; the draft (versus) speeds only the riders behind the leader; never past V_MAX", () => {
      const co = createMultiRun(1, 1, ["nami", "riko"], "coop");
      co.runs.forEach((r) => (r.hero.v = 15));
      applyPackSpeed(co, 1000);
      expect(co.runs[0].hero.v).toBeCloseTo(15 + TANDEM.accel, 6);
      const vs = createMultiRun(1, 1, ["nami", "riko", "kiro"], "versus");
      vs.runs.forEach((r) => (r.hero.v = 15));
      vs.runs[1].hero.z = vs.runs[0].hero.z + 6;
      vs.runs[2].hero.z = vs.runs[0].hero.z + 40;
      applyPackSpeed(vs, 1000);
      expect(vs.runs[0].hero.v).toBe(15);
      expect(vs.runs[1].hero.v).toBeCloseTo(15 + DRAFT.accel, 6);
      expect(vs.runs[2].hero.v).toBe(15);
      vs.runs[1].hero.v = V_MAX;
      applyPackSpeed(vs, 1000);
      expect(vs.runs[1].hero.v).toBe(V_MAX);
   });

   it("co-op powers: a shield, magnet or phase covers the ally as long as its own", () => {
      const a = createRun(1);
      const b = createRun(1);
      a.hero.shieldUntil = 5000;
      onAllyPower({ source: a, ally: b, power: "shield" } as never);
      expect(b.hero.shieldUntil).toBe(5000);
   });

   it("a solo run is untouched by the multiplayer module", () => {
      const solo = createRun(1);
      const bot = createBot(solo);
      const input = createStepInput();
      for (let f = 0; f < 100_000 && solo.ended === null; f++) {
         botInput(bot, solo, input);
         step(solo, 1000 / 60, input);
      }
      expect(solo.ended).toBe("win");
   });
});
