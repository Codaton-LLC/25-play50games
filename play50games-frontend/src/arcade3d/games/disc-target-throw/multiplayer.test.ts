// Local multiplayer (menu2/multiplayer): the yard is shared (the first disc to hit a target takes it),
// co-op powers cover the team, the bots clear together, and the podium ranks by points. The live hero
// pick stays per game (Kiro preselected, World 3's lead).
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { createMultiRun, onAllyPower, placings, stepMulti, targetsDown } from "./multiplayer";
import { createStepInput, type StepInput } from "./rules";

describe("disc-target-throw multiplayer", () => {
   it("the runs share the targets and the monkeys, and stand side by side", () => {
      const m = createMultiRun(7, 1, ["kiro", "riko", "nami"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(m.runs[1].hit).toBe(m.runs[0].hit);
      expect(m.runs[2].monkeyPaid).toBe(m.runs[0].monkeyPaid);
      expect(new Set(m.runs.map((r) => r.hero.x)).size).toBe(3);
   });

   it("the bots clear the yard together; versus ranks by points", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(3, 1, ["kiro", "zuno"], mode);
         const bots = m.runs.map((r) => createBot(r));
         const inputs: StepInput[] = m.runs.map(() => createStepInput());
         for (let f = 0; f < 40_000 && m.ended === null; f++) {
            m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
            stepMulti(m, 1000 / 60, inputs);
         }
         expect(m.ended, mode).toBe("win");
         expect(targetsDown(m)).toBe(m.runs[0].course.required);
         const p = placings(m);
         const best = Math.max(...m.runs.map((r) => r.score));
         expect(m.runs[p.find((q) => q.place === 1)!.index].score).toBe(best);
      }
   }, 120_000);

   it("co-op: a shield or a magnet covers an ally until the source's own ends", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "coop");
      const [a, b] = m.runs;
      a.hero.shieldUntil = 5000;
      onAllyPower({ from: 0, to: 1, source: a, ally: b, power: "shield" } as never);
      expect(b.hero.shieldUntil).toBe(5000);
      b.hero.magnetUntil = 4000;
      onAllyPower({ from: 1, to: 0, source: b, ally: a, power: "magnet" } as never);
      expect(a.hero.magnetUntil).toBe(4000);
   });
});

describe("live hero pick", () => {
   afterEach(() => selectHero(DEFAULT_HERO));

   it("Kiro is preselected; a new pick notifies, the same pick does not", () => {
      expect(pickedHero()).toBe("kiro");
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
