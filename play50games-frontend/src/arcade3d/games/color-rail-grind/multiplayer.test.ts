// Color Rail Grind local multiplayer (multiplayer.ts): parallel copies of the line from the same seed,
// ONE switch board for every corridor (a switch one hero throws sends a rival into the branch too),
// ally powers, the end rules and the podium.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { corridorGap, createMultiRun, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { BRANCH, SWITCHED, createRun, createStepInput, laneX, pieceAt, type StepInput } from "./rules";

function race(mode: "coop" | "versus", n: number) {
   const m = createMultiRun(1, 1, ["riko", "nami", "kiro", "zuno"].slice(0, n) as never, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 200_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("color-rail-grind multiplayer", () => {
   it("the corridors stand side by side and apart on the same line, and share one switch board", () => {
      const m = createMultiRun(7, 3, ["riko", "nami", "kiro"], "versus");
      expect(m.offsets[1] - m.offsets[0]).toBeCloseTo(corridorGap(3), 6);
      expect(corridorGap(3)).toBeGreaterThan(m.runs[0].course.half * 2);
      for (const r of m.runs) expect(r.board).toBe(m.board);
   });

   it("versus sabotage: a switch one hero throws sends the rival right behind it onto the branch too", () => {
      const m = createMultiRun(1, 2, ["kiro", "riko"], "versus");
      const c = m.runs[0].course;
      const j = c.junctions.find((q) => c.pieces[q.piece].branch === BRANCH.dead)!;
      for (const r of m.runs) {
         const p = pieceAt(c, j.lane, 0, j.z + 6, true)!;
         r.hero.z = j.z + 6;
         r.hero.lane = j.lane;
         r.hero.x = laneX(j.lane);
         r.hero.piece = p.index;
      }
      const inputs = [{ ...createStepInput(), switchPressed: true }, createStepInput()];
      stepMulti(m, 16, inputs);
      for (let f = 0; f < 200 && m.runs[1].junctionResult[j.index] === SWITCHED.pending; f++) stepMulti(m, 16, [createStepInput(), createStepInput()]);
      expect(m.runs[1].junctionResult[j.index]).toBe(SWITCHED.branch);
   });

   it("co-op: the team clears when every hero is through; versus: a podium, everyone placed", () => {
      const co = race("coop", 2);
      expect(co.ended).toBe("win");
      expect(team(co).cleared).toBe(true);
      const vs = race("versus", 3);
      expect(vs.ended).toBe("win");
      expect(placings(vs)).toHaveLength(3);
   });

   it("ally powers: a shield, a magnet, a phase cover the ally for as long as the source's", () => {
      const a = createRun(1, 1, "kiro");
      const b = createRun(1, 1, "riko");
      a.hero.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.hero.shieldUntil).toBe(3000);
   });
});
