// Local multiplayer (menu2/multiplayer): the same gorge for every hero, co-op's shared rope (another
// hero walking your link sways your needle), Kiro's shield covering the team, the bots crossing, and the
// race podium by finish time. The live hero pick stays per game (Kiro preselected, World 3's lead).
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { createMultiRun, onAllyPower, placings, sharedSway, stepMulti } from "./multiplayer";
import { createStepInput, type StepInput } from "./rules";

describe("tightrope-path multiplayer", () => {
   it("every hero starts on the start pillar, a little apart", () => {
      const m = createMultiRun(7, 1, ["kiro", "riko", "nami"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(new Set(m.runs.map((r) => r.hero.s)).size).toBe(3);
      expect(m.runs.every((r) => r.hero.link === r.course.start)).toBe(true);
   });

   it("co-op: another hero walking your link sways your needle; versus never does", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(1, 1, ["kiro", "zuno"], mode);
         const [a, b] = m.runs;
         a.hero.link = b.hero.link = 3;
         b.hero.v = 1.6;
         b.simMs = 250;
         sharedSway(m);
         expect(a.ext !== 0, mode).toBe(mode === "coop");
      }
   });

   it("the bots cross together; the race ranks by finish time", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(3, 1, ["kiro", "zuno"], mode);
         const bots = m.runs.map((r) => createBot(r));
         const inputs: StepInput[] = m.runs.map(() => createStepInput());
         for (let f = 0; f < 40_000 && m.ended === null; f++) {
            m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
            stepMulti(m, 1000 / 60, inputs);
         }
         expect(m.ended, mode).toBe("win");
         const p = placings(m);
         const winners = m.runs.filter((r) => r.ended === "win");
         const best = Math.min(...winners.map((r) => r.finishMs));
         expect(m.runs[p.find((q) => q.place === 1)!.index].finishMs).toBe(best);
      }
   }, 300_000);

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
