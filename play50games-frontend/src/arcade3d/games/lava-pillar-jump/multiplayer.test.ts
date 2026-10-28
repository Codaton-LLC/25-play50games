// Lava Pillar Jump local multiplayer (menu2/multiplayer adoption): N runs on the same seeded rules.
import { afterEach, describe, expect, it } from "vitest";
import { createBot, botInput, type Bot } from "./bot";
import { MAGNET_REACH, POWER_MS } from "./heroes";
import { COURSE, createRun, createStepInput, type StepInput } from "./rules";
import { START_SPACING, createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team, type MultiRun } from "./multiplayer";
import { MODES } from "@/arcade3d/menu2/multiplayer/modes";
import { playersStore } from "@/arcade3d/menu2/multiplayer/players";
import definition from "./index";

const FRAME = 1000 / 60;

/** Plays until the multi run ends, `until()` holds or `maxFrames`; climbers[i] false = that player stands still. */
function play(m: MultiRun, climbers: boolean[], maxFrames = 20_000, until: () => boolean = () => false): void {
   const bots: (Bot | null)[] = m.runs.map((r, i) => (climbers[i] ? createBot(r) : null));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < maxFrames && m.ended === null && !until(); f++) {
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
   it("every hero gets the same course from the same seed, side by side on the start", () => {
      const m = createMultiRun(42, 1, ["riko", "nami", "kiro"], "coop");
      expect(m.runs.map((r) => r.heroId)).toEqual(["riko", "nami", "kiro"]);
      expect(m.runs.every((r) => r.course === COURSE && r.seed === 42)).toBe(true);
      expect(m.runs[1].collected).toBe(m.runs[0].collected);
      expect(m.view.collected).toBe(m.runs[0].collected);
      const start = COURSE.supports[COURSE.checkpoints[0]];
      expect(m.runs.map((r) => r.hero.x)).toEqual([start.cx - START_SPACING, start.cx, start.cx + START_SPACING]);
   });

   it("leaves the solo createRun exactly as it was", () => {
      const solo = createRun(42, 1, "riko");
      const start = COURSE.supports[COURSE.checkpoints[0]];
      expect(solo.hero.x).toBe(start.cx);
      expect(solo.collected).not.toBe(createMultiRun(42, 1, ["riko", "nami"], "versus").runs[0].collected);
   });
});

describe("determinism", () => {
   it("the same seed and the same inputs give the same race", () => {
      const a = createMultiRun(7, 1, ["riko", "zuno"], "versus");
      const b = createMultiRun(7, 1, ["riko", "zuno"], "versus");
      // 600 frames = 10 s, under the fastest finish: both clocks still run in lock-step
      play(a, [true, true], 600);
      play(b, [true, true], 600);
      expect(a.runs.map((r) => [r.hero.x, r.hero.y, r.hero.z, r.orbs, r.simMs])).toEqual(b.runs.map((r) => [r.hero.x, r.hero.y, r.hero.z, r.orbs, r.simMs]));
      expect(a.runs[0].simMs).toBe(a.runs[1].simMs);
   });
});

describe("versus race", () => {
   it("two climbers both reach the goal shelf; the podium orders them by run time", () => {
      const m = createMultiRun(1, 1, ["riko", "riko"], "versus");
      play(m, [true, true]);
      expect(m.ended).toBe("win");
      expect(m.runs.every((r) => r.ended === "win")).toBe(true);
      const placed = placings(m);
      expect(placed[0].place).toBe(1);
      expect(placed[0].timeMs!).toBeLessThanOrEqual(placed[1].timeMs!);
   });

   it("ends finishGraceMs after the first finisher (or once the lava has the one left behind); that one places by height", () => {
      const m = createMultiRun(1, 1, ["nami", "kiro"], "versus");
      play(m, [true, false]);
      expect(m.ended).toBe("win");
      expect(m.firstFinishMs).not.toBeNull();
      // on the frame that crosses the grace (frame steps are whole ms, at most 17 at 60 fps), unless the
      // idle hero was swallowed on the start first (every run done ends the race at once)
      if (m.runs[1].ended === null) expect(m.simMs).toBeGreaterThanOrEqual(m.firstFinishMs! + MODES.versus.finishGraceMs);
      else expect(m.runs[1].ended).toBe("lose");
      expect(m.simMs).toBeLessThan(m.firstFinishMs! + MODES.versus.finishGraceMs + 17);
      expect(placings(m).map((p) => [p.index, p.place, p.finished])).toEqual([
         [0, 1, true],
         [1, 2, false],
      ]);
      // after the end nothing moves
      const ms = m.simMs;
      stepMulti(m, FRAME, []);
      expect(m.simMs).toBe(ms);
   });

   it("orbs are shared: each goes to whoever grabs it first, never twice", () => {
      const m = createMultiRun(1, 1, ["riko", "riko"], "versus");
      play(m, [true, true]);
      const taken = m.runs[0].collected.reduce((a, b) => a + b, 0);
      expect(m.runs[0].orbs + m.runs[1].orbs).toBe(taken);
   });

   it("powers stay personal", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "versus");
      const press = [createStepInput(), createStepInput()];
      press[0].actionPressed = true;
      stepMulti(m, FRAME, press);
      expect(m.runs[0].hero.shieldUntil).toBeGreaterThan(0);
      expect(m.runs[1].hero.shieldUntil).toBe(-1);
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
      expect(kiro.shieldUntil).toBeLessThanOrEqual(m.simMs + POWER_MS.shield);
      expect(MAGNET_REACH).toBeGreaterThan(0);
   });

   it("Riko's dash and Nami's double jump do nothing to an ally", () => {
      const run = createMultiRun(1, 1, ["riko", "kiro"], "coop");
      const before = { ...run.runs[1].hero };
      onAllyPower({ from: 0, to: 1, power: "dash", source: run.runs[0], ally: run.runs[1] });
      onAllyPower({ from: 0, to: 1, power: "doubleJump", source: run.runs[0], ally: run.runs[1] });
      expect(run.runs[1].hero).toEqual(before);
   });

   it("checkpoints are shared, and the team clears only when every hero is on the goal shelf", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "coop");
      play(m, [true, false], 20_000, () => m.runs[0].checkpoint > 0);
      expect(m.runs[0].checkpoint).toBeGreaterThan(0);
      expect(m.runs[1].checkpoint).toBe(m.runs[0].checkpoint);
      expect(m.view.checkpoint).toBe(m.runs[0].checkpoint);
      play(m, [true, false], 20_000, () => m.runs[0].ended !== null);
      // one finished, one stood still: no team win at the first finish
      expect(m.runs[0].ended).toBe("win");
      expect(m.ended).toBeNull();
      expect(team(m)).toMatchObject({ cleared: false, finishers: 1 });
      expect(leaderIndex(m)).toBe(1);
      // the one left standing is swallowed on the start, respawns on the friend's crystal, and is
      // swallowed there in the end: the team did not clear
      const before = m.runs[1].respawns;
      play(m, [false, false], 20_000);
      expect(m.runs[1].respawns).toBeGreaterThan(before);
      expect(m.ended === "lose" || m.ended === "timeup").toBe(true);
   });

   it("the whole team on the goal shelf is a team win, timed by the last hero", () => {
      const m = createMultiRun(3, 1, ["riko", "nami"], "coop");
      play(m, [true, true]);
      expect(m.ended).toBe("win");
      const t = team(m);
      expect(t.cleared).toBe(true);
      expect(t.timeMs).toBe(Math.max(...placings(m).map((p) => p.timeMs!)));
   });
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

describe("level 5", () => {
   it("in versus each hero fights its own Kalder; the first to bring him down wins the race", () => {
      const m = createMultiRun(1, 5, ["riko", "vexa"], "versus");
      play(m, [true, true], 60_000);
      expect(m.ended).toBe("win");
      expect(m.runs[0].boss).not.toBe(m.runs[1].boss);
      const winners = m.runs.filter((r) => r.ended === "win");
      expect(winners.length).toBeGreaterThan(0);
      for (const r of winners) expect(r.boss!.hp).toBe(0);
   });
});
