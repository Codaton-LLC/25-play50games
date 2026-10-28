// Flooded Ruins Escape local multiplayer (menu2/multiplayer adoption): N runs on the same seeded
// rules, one shared temple (orbs, water, levers, broken brick, the tide, the boss).
import { afterEach, describe, expect, it } from "vitest";
import { createBot, botInput, type Bot } from "./bot";
import { POWER_MS } from "./heroes";
import { NONE, courseFor, createRun, createStepInput, zoneLevel, type StepInput } from "./rules";
import { START_SPACING, createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team, type MultiRun } from "./multiplayer";
import { MODES } from "@/arcade3d/menu2/multiplayer/modes";
import { playersStore } from "@/arcade3d/menu2/multiplayer/players";
import definition from "./index";

const FRAME = 1000 / 60;
const COURSE = courseFor(1);

/**
 * Plays until the multi run ends, `until()` holds or `maxFrames`; movers[i] false = that player
 * stands still. The levers are one shared set and any touch pulls one, so two honest bots on one
 * route would pull each other's levers back (two players talk; bots do not): with `leader` set,
 * only that hero works the levers and the others follow its water (their levers stay disarmed).
 */
function play(m: MultiRun, movers: boolean[], maxFrames = 20_000, until: () => boolean = () => false, leader = -1): void {
   const bots: (Bot | null)[] = m.runs.map((r, i) => (movers[i] ? createBot(r) : null));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < maxFrames && m.ended === null && !until(); f++) {
      if (leader >= 0) for (let i = 0; i < m.runs.length; i++) if (i !== leader) m.runs[i].armed.fill(0);
      for (let i = 0; i < m.runs.length; i++) {
         const b = bots[i];
         if (b && m.runs[i].ended === null) botInput(b, m.runs[i], inputs[i]);
         else Object.assign(inputs[i], createStepInput());
      }
      stepMulti(m, FRAME, inputs);
   }
}

afterEach(() => playersStore.getState().endSession());

describe("setup", () => {
   it("every hero gets the same course from the same seed, side by side on the start, in one shared temple", () => {
      const m = createMultiRun(42, 1, ["riko", "nami", "kiro"], "coop");
      expect(m.runs.map((r) => r.heroId)).toEqual(["riko", "nami", "kiro"]);
      expect(m.runs.every((r) => r.course === COURSE && r.seed === 42)).toBe(true);
      for (const r of m.runs) {
         expect(r.collected).toBe(m.runs[0].collected);
         expect(r.water).toBe(m.runs[0].water);
         expect(r.levers).toBe(m.runs[0].levers);
         expect(r.broken).toBe(m.runs[0].broken);
      }
      expect(m.view.collected).toBe(m.runs[0].collected);
      expect(m.view.water).toBe(m.runs[0].water);
      expect(m.runs.map((r) => r.bossOwner)).toEqual([true, false, false]);
      const solo = createRun(42, 1);
      expect(m.runs.map((r) => r.hero.x)).toEqual([solo.hero.x - START_SPACING, solo.hero.x, solo.hero.x + START_SPACING]);
   });

   it("leaves the solo createRun exactly as it was", () => {
      const solo = createRun(42, 1, "riko");
      const start = COURSE.supports[COURSE.checkpoints[0]];
      expect(solo.hero.x).toBe(start.cx);
      const m = createMultiRun(42, 1, ["riko", "nami"], "versus");
      expect(solo.collected).not.toBe(m.runs[0].collected);
      expect(solo.water).not.toBe(m.runs[0].water);
   });

   it("level 5: one Umbra Roller for the whole group", () => {
      const m = createMultiRun(1, 5, ["riko", "nami"], "coop");
      expect(m.runs[0].boss).not.toBeNull();
      expect(m.runs[1].boss).toBe(m.runs[0].boss);
      for (let f = 0; f < 120; f++) stepMulti(m, FRAME, []);
      // stepped once per ms (by the owner), not once per hero
      expect(m.runs[0].boss!.step).not.toBe("intro");
      expect(m.runs[0].bossPose.mode).toBe(m.runs[1].bossPose.mode);
   });
});

describe("determinism", () => {
   it("the same seed and the same inputs give the same race", () => {
      const a = createMultiRun(7, 1, ["riko", "zuno"], "versus");
      const b = createMultiRun(7, 1, ["riko", "zuno"], "versus");
      play(a, [true, true], 600);
      play(b, [true, true], 600);
      expect(a.runs.map((r) => [r.hero.x, r.hero.y, r.hero.z, r.orbs, r.simMs])).toEqual(b.runs.map((r) => [r.hero.x, r.hero.y, r.hero.z, r.orbs, r.simMs]));
      expect(a.runs[0].simMs).toBe(a.runs[1].simMs);
   });
});

describe("the shared temple", () => {
   it("a lever one hero pulls moves the water for everyone", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "versus");
      // the first lever of level 1 (trench A): only P1 plays until it is pulled
      play(m, [true, false], 4000, () => m.runs[0].levers.pos[0] !== 0);
      expect(m.runs[0].levers.pos[0]).not.toBe(0);
      const zi = COURSE.levers[0].effects[m.runs[0].levers.pos[0]][0][0];
      // P2 (standing still) sees the same water, rising
      for (let f = 0; f < 60; f++) stepMulti(m, FRAME, []);
      expect(zoneLevel(m.runs[1].water, zi, m.runs[1].simMs)).toBe(zoneLevel(m.runs[0].water, zi, m.runs[0].simMs));
      expect(zoneLevel(m.runs[1].water, zi, m.runs[1].simMs)).toBeGreaterThan(COURSE.zones[zi].floor);
   });

   it("one storm tide: it starts for everyone the moment one hero starts it", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "versus");
      play(m, [true, false], 20_000, () => m.runs[0].tideFrom !== NONE);
      expect(m.runs[0].tideFrom).not.toBe(NONE);
      expect(m.runs[1].tideFrom).toBe(m.runs[0].tideFrom);
      expect(m.view.tideFrom).toBe(m.runs[0].tideFrom);
   });
});

describe("versus race", () => {
   it("two escapers both reach the gate; the podium orders them by run time", () => {
      const m = createMultiRun(1, 1, ["riko", "riko"], "versus");
      play(m, [true, true], 20_000, undefined, 0);
      expect(m.ended).toBe("win");
      expect(m.runs.some((r) => r.ended === "win")).toBe(true);
      const placed = placings(m);
      expect(placed[0].place).toBe(1);
      expect(placed[0].finished).toBe(true);
      const finishers = placed.filter((p) => p.finished);
      for (let i = 1; i < finishers.length; i++) expect(finishers[i - 1].timeMs!).toBeLessThanOrEqual(finishers[i].timeMs!);
   }, 60_000);

   it("ends finishGraceMs after the first finisher; the one left behind places by how far it got", () => {
      const m = createMultiRun(1, 1, ["nami", "kiro"], "versus");
      play(m, [true, false]);
      expect(m.ended).toBe("win");
      expect(m.firstFinishMs).not.toBeNull();
      // the grace, or the idle hero's own end (the shared tide floods its start) ended it
      expect(m.simMs).toBeLessThan(m.firstFinishMs! + MODES.versus.finishGraceMs + 17);
      expect(m.runs[1].ended).not.toBe("win");
      expect(placings(m).map((p) => [p.index, p.place, p.finished])).toEqual([
         [0, 1, true],
         [1, 2, false],
      ]);
      const ms = m.simMs;
      stepMulti(m, FRAME, []);
      expect(m.simMs).toBe(ms);
   }, 60_000);

   it("orbs are shared: each goes to whoever grabs it first, never twice", () => {
      const m = createMultiRun(1, 1, ["riko", "riko"], "versus");
      play(m, [true, true], 20_000, undefined, 0);
      const taken = m.runs[0].collected.reduce((a, b) => a + b, 0);
      expect(m.runs[0].orbs + m.runs[1].orbs).toBe(taken);
   }, 60_000);

   it("powers stay personal", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "versus");
      const press = [createStepInput(), createStepInput()];
      press[0].actionPressed = true;
      const before = m.runs[1].hero.shieldUntil;
      stepMulti(m, FRAME, press);
      expect(m.runs[0].hero.shieldUntil).toBeGreaterThan(0);
      expect(m.runs[1].hero.shieldUntil).toBe(before);
   });
});

describe("co-op", () => {
   it("Kiro's shield, Zuno's magnet and Vexa's phase reach the allies (onAllyPower), with the source's end time", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno", "vexa", "riko"], "coop");
      const press = m.runs.map(() => createStepInput());
      press[0].actionPressed = true;
      press[1].actionPressed = true;
      press[2].actionPressed = true;
      stepMulti(m, FRAME, press);
      const [kiro, zuno, vexa, riko] = m.runs.map((r) => r.hero);
      for (const h of [zuno, vexa, riko]) expect(h.shieldUntil).toBe(kiro.shieldUntil);
      for (const h of [kiro, vexa, riko]) expect(h.magnetUntil).toBe(zuno.magnetUntil);
      for (const h of [kiro, zuno, riko]) expect(h.phaseUntil).toBe(vexa.phaseUntil);
      expect(kiro.shieldUntil).toBeLessThanOrEqual(m.simMs + POWER_MS.shield + 1);
   });

   it("Riko's dash and Nami's breach do nothing to an ally", () => {
      const run = createMultiRun(1, 1, ["riko", "kiro"], "coop");
      const before = { ...run.runs[1].hero };
      onAllyPower({ from: 0, to: 1, power: "dash", source: run.runs[0], ally: run.runs[1] });
      onAllyPower({ from: 0, to: 1, power: "doubleJump", source: run.runs[0], ally: run.runs[1] });
      expect(run.runs[1].hero).toEqual(before);
   });

   it("checkpoints are shared, and the team clears only when every hero is at the gate", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "coop");
      // one bot for the whole climb (a new bot would start its route again): check the sharing as it goes
      let shared = 0;
      play(
         m,
         [true, false],
         20_000,
         () => {
            if (m.runs[0].checkpoint > 0 && m.runs[0].ended === null) {
               expect(m.runs[1].checkpoint).toBe(m.runs[0].checkpoint);
               expect(m.view.checkpoint).toBe(m.runs[0].checkpoint);
               shared++;
            }
            return m.runs[0].ended !== null;
         },
         0,
      );
      expect(shared).toBeGreaterThan(0);
      expect(m.runs[0].ended).toBe("win");
      expect(team(m)).toMatchObject({ cleared: false, finishers: 1 });
      // the one left standing never makes it: the team did not clear
      play(m, [false, false], 20_000);
      expect(m.ended).toBe("timeup");
      expect(leaderIndex(m)).toBe(0);
   }, 60_000);

   it("the whole team at the gate is a team win, timed by the last hero", () => {
      const m = createMultiRun(3, 1, ["riko", "nami"], "coop");
      play(m, [true, true], 20_000, undefined, 0);
      expect(m.ended).toBe("win");
      const t = team(m);
      expect(t.cleared).toBe(true);
      expect(t.timeMs).toBe(Math.max(...placings(m).map((p) => p.timeMs!)));
   }, 60_000);
});

describe("leaderboard", () => {
   it("index.tsx runPlayers: a multiplayer run reports its player count (never ranked), solo reports 1", () => {
      const s = () => playersStore.getState();
      expect(definition.runPlayers?.({} as never)).toBe(1);
      s().openLobby(["riko", "nami"]);
      s().join("kb1");
      s().join("kb2");
      expect(definition.runPlayers?.({} as never)).toBe(1);
      s().setReady(0, true);
      s().setReady(1, true);
      expect(s().beginRun()).toBe(true);
      expect(definition.runPlayers?.({} as never)).toBe(2);
      s().endSession();
      expect(definition.runPlayers?.({} as never)).toBe(1);
   });
});
