// Local multiplayer (menu2/multiplayer): co-op shares the board and the hazards (anyone's paint counts
// for the team, the blots move once), versus keeps each player's own board, Kiro's shield covers the
// team, the versus race ranks by finish time, and the live hero pick stays per game.
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { createMultiRun, onAllyPower, placings, stepMulti } from "./multiplayer";
import { createStepInput, type StepInput } from "./rules";

describe("paint-the-platforms multiplayer", () => {
   it("every hero starts on the start tile row, a little apart", () => {
      const m = createMultiRun(7, 1, ["vexa", "riko", "nami"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(new Set(m.runs.map((r) => r.hero.x)).size).toBe(3);
   });

   it("co-op: one player's paint is on everyone's board, in that player's colour; versus: never", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(1, 1, ["vexa", "kiro"], mode);
         const go = { ...createStepInput(), moveZ: -1 };
         for (let f = 0; f < 30; f++) stepMulti(m, 1000 / 60, [go, createStepInput()]);
         const vexaTiles = Array.from(m.runs[0].board.paint).filter((p) => p === 4).length;
         expect(vexaTiles).toBeGreaterThan(1);
         expect(Array.from(m.runs[1].board.paint).filter((p) => p === 4).length, mode).toBe(mode === "coop" ? vexaTiles : 0);
      }
   });

   it("co-op: the blots are stepped once (by player 1), not once per player", () => {
      const solo = createMultiRun(1, 2, ["riko"], "coop");
      const duo = createMultiRun(1, 2, ["riko", "nami"], "coop");
      for (let f = 0; f < 60; f++) {
         stepMulti(solo, 1000 / 60, [createStepInput()]);
         stepMulti(duo, 1000 / 60, [createStepInput(), createStepInput()]);
      }
      expect(duo.runs[0].blotAt[0]).toBeCloseTo(solo.runs[0].blotAt[0], 9);
      expect(duo.runs[1].blotAt).toBe(duo.runs[0].blotAt);
   });

   it("versus: the bots race to the target; the podium ranks by finish time", () => {
      const m = createMultiRun(3, 1, ["vexa", "zuno"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs: StepInput[] = m.runs.map(() => createStepInput());
      for (let f = 0; f < 40_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      const p = placings(m);
      const winners = m.runs.filter((r) => r.ended === "win");
      expect(m.runs[p.find((q) => q.place === 1)!.index].finishMs).toBe(Math.min(...winners.map((r) => r.finishMs)));
   }, 120_000);

   it("co-op: Kiro's shield covers an ally until his own ends", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "coop");
      const [a, b] = m.runs;
      a.hero.shieldUntil = 5000;
      onAllyPower({ from: 0, to: 1, source: a, ally: b, power: "shield" } as never);
      expect(b.hero.shieldUntil).toBe(5000);
   });
});

describe("live hero pick", () => {
   afterEach(() => selectHero(DEFAULT_HERO));

   it("Riko is preselected with no earlier pick; a new pick notifies, the same pick does not", () => {
      expect(pickedHero()).toBe("riko");
      let calls = 0;
      const off = subscribeHero(() => calls++);
      selectHero("vexa");
      selectHero("vexa");
      expect(calls).toBe(1);
      off();
   });

   it("every hero is its own GLB; the picker lists all five", () => {
      expect(HEROES.map((h) => h.id)).toEqual([...M2_HERO_IDS]);
      expect(new Set(M2_HERO_IDS.map((id) => heroModelAsset(id).url)).size).toBe(5);
   });
});
