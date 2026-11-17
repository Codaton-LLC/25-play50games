// Local multiplayer: N runs from one seed share the chart; band co-op keeps every bandmate's combo window
// open on a Perfect and clears on the band's average accuracy; versus ranks two honest bots by score.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { PERFECT, createStepInput } from "./rules";
import { createMultiRun, placings, progressOf, stepMulti, team } from "./multiplayer";

function playOut(m: ReturnType<typeof createMultiRun>, skills: number[]): void {
   const bots = m.runs.map((r, i) => createBot(r, 1000 / 60, skills[i] ?? 0, i + 1));
   const inputs = m.runs.map(() => createStepInput());
   for (let f = 0; f < 100_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
}

describe("temple-gong-timing multiplayer", () => {
   it("the runs share one chart, each with its own hero", () => {
      const m = createMultiRun(1, 2, ["kiro", "nami", "zuno"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(m.runs[1].chart.notes.map((n) => n.t)).toEqual(m.runs[0].chart.notes.map((n) => n.t));
      expect(m.runs.map((r) => r.heroId)).toEqual(["kiro", "nami", "zuno"]);
   });

   it("band co-op: a Perfect keeps a bandmate's combo window open", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "coop");
      const [a, b] = m.runs;
      const bots = [createBot(a), createBot(b)];
      const inputs = [createStepInput(), createStepInput()];
      let shared = false;
      for (let f = 0; f < 20_000 && m.ended === null && !shared; f++) {
         botInput(bots[0], a, inputs[0]);
         botInput(bots[1], b, inputs[1]);
         // the second player stops striking once a chain is built; the first keeps going
         if (b.combo.chain >= 2) inputs[1].actionPressed = false;
         const before = b.combo.lastMs;
         const ev = stepMulti(m, 1000 / 60, inputs);
         if (ev[0].strike === PERFECT && ev[1].strike !== PERFECT && b.combo.chain > 0 && b.combo.lastMs > before) shared = true;
      }
      expect(shared).toBe(true);
   }, 120_000);

   it("a co-op band of two bots clears level 1 together", () => {
      const m = createMultiRun(2, 1, ["kiro", "riko"], "coop");
      playOut(m, [0, 40]);
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
      expect(progressOf(m.runs[0])).toBe(100);
   }, 120_000);

   it("versus: the better player places first", () => {
      const m = createMultiRun(3, 1, ["kiro", "zuno"], "versus");
      playOut(m, [0, 80]);
      expect(m.ended).toBe("win");
      const p = placings(m);
      expect(p.find((x) => x.place === 1)!.index).toBe(0);
      expect(m.runs[0].score).toBeGreaterThan(m.runs[1].score);
   }, 120_000);
});
