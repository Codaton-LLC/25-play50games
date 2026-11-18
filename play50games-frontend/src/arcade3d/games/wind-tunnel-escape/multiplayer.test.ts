// Local multiplayer (multiplayer.ts): one shared tunnel world (one player turns a fan, another rides it),
// co-op and versus endings, shared checkpoints, ally powers, and every run stepped in lock-step.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { dirIndex } from "./tunnel";
import { createStepInput, type StepInput } from "./rules";

function botMulti(mode: "coop" | "versus", heroes: ("nami" | "riko" | "kiro" | "zuno" | "vexa")[], level: 1 | 2 | 5 = 1) {
   const m = createMultiRun(7, level, heroes, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 400 && m.ended === null; f++) {
      // the bots start a second apart (two bots tapping one fan in the same frame would turn it twice)
      m.runs.forEach((r, i) => (f >= i * 70 ? botInput(bots[i], r, inputs[i]) : undefined));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("all runs share one world: a fan one hero turns is turned for the other; only run 0 moves the world", () => {
      const m = createMultiRun(1, 1, ["nami", "kiro"], "coop");
      expect(m.runs[0].world).toBe(m.runs[1].world);
      expect(m.runs[0].owner).toBe(true);
      expect(m.runs[1].owner).toBe(false);
      const f = m.runs[0].course.rooms[1].solution[0].fan;
      m.runs[1].world.dir[f] = dirIndex("n");
      expect(m.runs[0].world.dir[f]).toBe(dirIndex("n"));
      expect(m.runs[0].hero.x).not.toBe(m.runs[1].hero.x);
   });

   it("co-op: two bots clear level 1 together; the team result is a clear", () => {
      const m = botMulti("coop", ["nami", "zuno"]);
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
   }, 60_000);

   it("versus: the first out of the tunnel wins the podium; the run ends after the grace", () => {
      const m = botMulti("versus", ["riko", "vexa", "kiro"]);
      expect(m.ended).toBe("win");
      const p = placings(m);
      expect(p.filter((x) => x.place === 1).length).toBeGreaterThanOrEqual(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
   }, 60_000);

   it("level 5 in co-op: the Gale Engine falls and the team escapes", () => {
      const m = botMulti("coop", ["nami", "kiro"], 5);
      expect(m.runs[0].world.boss?.step).toBe("done");
      expect(m.ended).toBe("win");
   }, 120_000);

   it("ally powers: Kiro's shield and Zuno's magnet cover a teammate until the source's own end", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "coop");
      const [k, n] = m.runs;
      k.hero.shieldUntil = 3000;
      onAllyPower({ source: k, ally: n, power: "shield", sourceIndex: 0, allyIndex: 1 } as never);
      expect(n.hero.shieldUntil).toBe(3000);
      k.hero.magnetUntil = 2500;
      onAllyPower({ source: k, ally: n, power: "magnet", sourceIndex: 0, allyIndex: 1 } as never);
      expect(n.hero.magnetUntil).toBe(2500);
   });
});
