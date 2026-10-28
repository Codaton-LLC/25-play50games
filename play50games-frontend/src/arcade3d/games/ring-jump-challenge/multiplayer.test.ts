// Local multiplayer (menu2/multiplayer M1): the canyon is shared (versus: the first to thread a ring
// takes it), co-op powers cover the team, every bot lands, the race ends after the grace, and the
// podium ranks by points. The live hero pick stays per game (Nami preselected).
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { createMultiRun, onAllyPower, placings, stepMulti } from "./multiplayer";
import { createStepInput, type StepInput } from "./rules";

describe("ring-jump-challenge multiplayer", () => {
   it("the runs share the rings, the orbs and the seals, and stand side by side on the rim", () => {
      const m = createMultiRun(7, 1, ["nami", "riko", "kiro"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(m.runs[1].threaded).toBe(m.runs[0].threaded);
      expect(m.runs[2].taken).toBe(m.runs[0].taken);
      expect(m.runs[1].broken).toBe(m.runs[0].broken);
      expect(new Set(m.runs.map((r) => r.hero.x)).size).toBe(3);
   });

   it("every bot lands in co-op; the team wins; versus ranks by points", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(3, 1, ["nami", "zuno"], mode);
         const bots = m.runs.map((r) => createBot(r));
         const inputs: StepInput[] = m.runs.map(() => createStepInput());
         for (let f = 0; f < 200_000 && m.ended === null; f++) {
            m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
            stepMulti(m, 1000 / 60, inputs);
         }
         expect(m.ended, mode).toBe("win");
         if (mode === "coop") expect(m.runs.every((r) => r.ended === "win")).toBe(true);
         const p = placings(m);
         const best = Math.max(...m.runs.map((r) => r.score));
         expect(m.runs[p.find((q) => q.place === 1)!.index].score).toBe(best);
      }
   }, 60_000);

   it("co-op: a shield, a magnet or a phase covers an ally until the source's own ends", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "coop");
      const [a, b] = m.runs;
      a.hero.shieldUntil = 5000;
      onAllyPower({ from: 0, to: 1, source: a, ally: b, power: "shield" } as never);
      expect(b.hero.shieldUntil).toBe(5000);
   });
});

describe("live hero pick", () => {
   afterEach(() => selectHero(DEFAULT_HERO));

   it("Nami is preselected; a new pick notifies, the same pick does not", () => {
      expect(pickedHero()).toBe("nami");
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
