// Local multiplayer (menu2/multiplayer): co-op shares the rooms (one player's strike lights the crystal
// for everyone), versus keeps each player's own rooms, Kiro's shield covers the team, the versus race
// ranks by finish time, and the live hero pick stays per game (Vexa preselected, World 5's lead).
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { createMultiRun, onAllyPower, placings, stepMulti } from "./multiplayer";
import { createStepInput, type StepInput } from "./rules";

describe("crystal-cave-switch multiplayer", () => {
   it("every hero starts at the cave's entrance, a little apart", () => {
      const m = createMultiRun(7, 1, ["vexa", "riko", "nami"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(new Set(m.runs.map((r) => r.hero.x)).size).toBe(3);
   });

   it("co-op: one player's strike lights the crystal for everyone; versus: never", () => {
      for (const mode of ["coop", "versus"] as const) {
         const m = createMultiRun(1, 1, ["vexa", "kiro"], mode);
         const s = m.runs[0].course.switches[m.runs[0].course.rooms[0].seq[0]];
         m.runs[0].hero.x = s.x + 0.6;
         m.runs[0].hero.z = s.z;
         stepMulti(m, 16, [{ ...createStepInput(), actionPressed: true }, createStepInput()]);
         expect(m.runs[0].lit[s.id]).toBe(1);
         expect(m.runs[1].lit[s.id], mode).toBe(mode === "coop" ? 1 : 0);
      }
   });

   it("versus: the bots race to the goal; the podium ranks by finish time", () => {
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

   it("Vexa is preselected; a new pick notifies, the same pick does not", () => {
      expect(pickedHero()).toBe("vexa");
      let calls = 0;
      const off = subscribeHero(() => calls++);
      selectHero("riko");
      selectHero("riko");
      expect(calls).toBe(1);
      off();
   });

   it("every hero is its own GLB; the picker lists all five", () => {
      expect(HEROES.map((h) => h.id)).toEqual([...M2_HERO_IDS]);
      expect(new Set(M2_HERO_IDS.map((id) => heroModelAsset(id).url)).size).toBe(5);
   });
});
