// Flooded Ruins Escape rules (the card's FLOOD verb): levers that move a chamber's water at 0.8 m/s,
// swimming (hold Jump to rise, let go to sink, a press at the surface leaps out), the 6 s air meter
// and the bubble spouts, floating crates, the storm tide (the escape clock), falls and respawns, the
// hand-off to the store, and the server-limit proof (README "Server limits"): the pinned limits, the
// dash floor, and an honest, an idle and a spam bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { floodedRuinsEscapeMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, POWER_MS, V_DASH, heroById } from "./heroes";
import { createBot, botInput } from "./bot";
import {
   AIR_MS,
   CRATE_LIFT,
   FLOAT_DEPTH,
   LEVEL1_LIMITS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPAWN_MS,
   STAT,
   V_RUN,
   V_SINK,
   V_SWIM_UP,
   V_WATER,
   bossDefeatMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   dashFloorMs,
   finalScore,
   minArrivalMs,
   minDurationMsOf,
   minFinishMs,
   runTimeMs,
   solidBoxes,
   step,
   supportTop,
   tideY,
   zoneLevel,
   type RuinRun,
   type SolidBox,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;
const botCache = new Map<string, RuinRun>();

function botRun(level: LevelId, fps: number, seed = 1): RuinRun {
   const key = `${level}:${fps}:${seed}`;
   const hit = botCache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(seed, level);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   botCache.set(key, run);
   return run;
}

const submitted = (run: RuinRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: RuinRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      left -= d;
   }
}

/** Puts the hero on block `i` at (x, z), at rest. */
function standOn(run: RuinRun, i: number, x: number, z: number): void {
   const s = run.course.supports[i];
   const top = supportTop(run.course, run.water, s, run.simMs);
   Object.assign(run.hero, { x, y: top, z, vx: 0, vz: 0, vy: 0, grounded: true, swim: false, support: i, lastTop: top, arcStart: run.simMs, arcY0: top, arcV: 0 });
}

/** Level 1's trench A floor, its lever, its chamber and its crate. */
function trenchA() {
   const c = courseFor(1);
   const floor = c.supports.findIndex((s) => s.kind === "floor");
   const crate = c.supports.findIndex((s) => s.kind === "crate");
   return { c, floor, crate, zone: 0, lever: 0 };
}

describe("the drowned temple (a lever puzzle against a rising tide)", () => {
   it("every level has a start, a goal, chambers and a tide; every level but the swim level (4) sets water with levers", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.checkpoints[0]).toBeGreaterThanOrEqual(0);
         expect(c.goal).toBeGreaterThanOrEqual(0);
         expect(c.zones.length).toBeGreaterThan(0);
         expect(c.tide.rate).toBeGreaterThan(0);
         const leverSteps = c.route.filter((s) => "lever" in s).length;
         if (id === 4) expect(leverSteps).toBe(0);
         else expect(leverSteps, `level ${id}`).toBeGreaterThanOrEqual(2);
      }
   });

   it("the storm tide speeds up level by level (the card's 0.25 to 0.8 m/s)", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].tide.rate)).toEqual([0.25, 0.32, 0.4, 0.6, 0.8]);
   });

   it("a lever never soft-locks: it cycles through its positions (a wrong pull is undone by pulling again)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const l of c.levers) {
            expect(l.positions).toBe(l.effects.length);
            expect(l.positions).toBeGreaterThanOrEqual(2);
            for (const eff of l.effects) for (const [zi, level] of eff) expect(c.zones[zi].levels[level], `level ${id}`).toBeDefined();
         }
      }
      // level 2's linked levers: each position moves two chambers in opposite directions
      const c2 = courseFor(2);
      const linked = c2.levers.filter((l) => l.effects[1].length === 2);
      expect(linked.length).toBeGreaterThanOrEqual(2);
      for (const l of linked) {
         const [[za, la], [zb, lb]] = l.effects[1];
         const [[, la0], [, lb0]] = l.effects[0];
         expect(Math.sign(c2.zones[za].levels[la] - c2.zones[za].levels[la0])).toBe(-Math.sign(c2.zones[zb].levels[lb] - c2.zones[zb].levels[lb0]));
      }
   });

   it("the same level is the same race for every seed", () => {
      const a = createRun(1, 2);
      const b = createRun(99, 2);
      expect(a.course).toBe(b.course);
      expect(a.hero).toEqual(b.hero);
   });
});

describe("levers, water, swimming and air", () => {
   it("a lever moves its chamber's water at V_WATER (0.8 m/s) towards its target; the swimmer rises at 1.2 m/s holding Jump and sinks at 0.9", () => {
      const { c, floor, zone } = trenchA();
      const run = createRun(1, 1, "riko");
      const l = c.levers[0];
      standOn(run, floor, l.x, l.z + 0.4);
      const input = createStepInput();
      let pulledAt = -1;
      for (let i = 0; i < 20 && pulledAt < 0; i++) {
         input.moveZ = -0.3;
         step(run, 16, input);
         if (run.events.lever === 0) pulledAt = run.simMs;
      }
      expect(pulledAt).toBeGreaterThan(0);
      expect(run.levers.pos[0]).toBe(1);
      input.moveZ = 0;
      hold(run, 1000, input);
      const y = zoneLevel(run.water, zone, run.simMs);
      expect(y).toBeCloseTo(c.zones[zone].levels[0] + (V_WATER * (run.simMs - run.levers.at[0])) / 1000, 9);
      // the water rises over the hero: swimming. Holding Jump rises at V_SWIM_UP (faster than the water) to the float height
      hold(run, 300, input);
      expect(run.hero.swim).toBe(true);
      input.jumpHeld = true;
      hold(run, 600, input);
      const up0 = run.hero.y;
      hold(run, 160, input);
      expect((run.hero.y - up0) / 0.16).toBeCloseTo(V_SWIM_UP, 2);
      hold(run, 6000, input);
      expect(run.hero.y).toBeCloseTo(c.zones[zone].levels[1] - FLOAT_DEPTH, 6);
      expect(run.hero.air).toBe(AIR_MS);
      // let go: it sinks at V_SINK
      input.jumpHeld = false;
      hold(run, 500, input);
      const s0 = run.hero.y;
      hold(run, 160, input);
      expect((s0 - run.hero.y) / 0.16).toBeCloseTo(V_SINK, 2);
   });

   it("a floating crate rests on the floor and rides the water up, CRATE_LIFT over the surface, to its cap", () => {
      const { c, crate, zone } = trenchA();
      const run = createRun(1, 1);
      const s = c.supports[crate];
      expect(supportTop(c, run.water, s, 0)).toBe(s.floatMin);
      // pull the lever by hand: the water rises to 2.4
      run.levers.pos[0] = 1;
      run.water.fromY[zone] = zoneLevel(run.water, zone, 0);
      run.water.fromMs[zone] = 0;
      run.water.target[zone] = c.zones[zone].levels[1];
      expect(supportTop(c, run.water, s, 3000)).toBeCloseTo(zoneLevel(run.water, zone, 3000) + CRATE_LIFT, 9);
      expect(supportTop(c, run.water, s, 60_000)).toBe(s.floatMax);
   });

   it("under water the 6 s air meter runs out (lost: air); in a bubble column it stays full", () => {
      // level 4's flooded crypt, water at 3.0 over a floor at -6
      const c = courseFor(4);
      const drown = createRun(1, 4, "riko");
      Object.assign(drown.hero, { x: -2, y: -5.5, z: -21, grounded: false, swim: true, support: -1, vx: 0, vz: 0, vy: 0, lastTop: -5.5 });
      const input = createStepInput();
      let lostAt = -1;
      for (let i = 0; i < 1000 && lostAt < 0; i++) {
         step(drown, 16, input);
         if (drown.events.lost) lostAt = drown.simMs;
      }
      expect(drown.hero.lostCause).toBe("air");
      expect(lostAt).toBeGreaterThanOrEqual(AIR_MS - 20);
      expect(lostAt).toBeLessThanOrEqual(AIR_MS + 20);
      const sp = c.spouts[0];
      const breathe = createRun(1, 4, "riko");
      Object.assign(breathe.hero, { x: sp.x, y: sp.y0 + 0.2, z: sp.z, grounded: false, swim: true, support: -1, vx: 0, vz: 0, vy: 0, lastTop: sp.y0 });
      hold(breathe, AIR_MS + 1500, input);
      expect(breathe.hits).toBe(0);
      expect(breathe.hero.air).toBe(AIR_MS);
   });

   it("a pressure lever springs back after its hold time (level 5's drain levers)", () => {
      const c = courseFor(5);
      const li = c.boss!.pressure[0];
      const l = c.levers[li];
      expect(l.kind).toBe("pressure");
      const run = createRun(1, 5);
      const arena = c.supports.findIndex((s) => s.kind === "floor" && s.cz < -26);
      standOn(run, arena, l.x, l.z + 1.2);
      const input = createStepInput();
      input.moveZ = -0.4;
      let at = -1;
      for (let i = 0; i < 60 && at < 0; i++) {
         step(run, 16, input);
         if (run.events.lever === li) at = run.simMs;
      }
      expect(at).toBeGreaterThan(0);
      input.moveZ = 0.6;
      hold(run, 400, input);
      input.moveZ = 0;
      hold(run, l.holdMs - 600, input);
      expect(run.levers.pos[li]).toBe(1);
      hold(run, 400, input);
      expect(run.levers.pos[li]).toBe(0);
   });
});

describe("the storm tide, falls and respawns", () => {
   it("the tide starts at its checkpoint (level 1: the switchbacks) and rises at its rate; it never stops a finish from being ranked", () => {
      const run = botRun(1, 60);
      expect(run.ended).toBe("win");
      expect(run.tideFrom).toBeGreaterThan(0);
      const t = run.course.tide;
      expect(tideY(run, run.tideFrom + 4000)).toBeCloseTo(t.y0 + t.rate * 4, 9);
      expect(tideY(run, run.tideFrom - 1)).toBe(-Infinity);
   });

   it("a fall is lost for LOST_MS, then SPAWN_MS frozen on the checkpoint; a tide over the checkpoint ends the run 'flood' (unranked)", () => {
      const run = createRun(1, 1);
      const start = run.course.supports[run.course.checkpoints[0]];
      Object.assign(run.hero, { x: 30, y: start.top, z: 0, grounded: false, swim: false, support: -1, arcStart: 0, arcY0: start.top, arcV: 0, lastTop: start.top });
      const input = createStepInput();
      let lostAt = -1;
      let backAt = -1;
      for (let i = 0; i < 400 && backAt < 0; i++) {
         step(run, 10, input);
         if (run.events.lost) lostAt = run.simMs;
         if (run.events.respawned) backAt = run.simMs;
      }
      expect(run.hero.lostCause).toBe("fall");
      expect(backAt - lostAt).toBe(LOST_MS);
      expect(run.hero.state).toBe("spawn");
      hold(run, SPAWN_MS, input);
      expect(run.hero.state).toBe("play");
      // level 4 idle: the fast tide climbs over the start, and the run ends "flood"
      const idle = createRun(1, 4);
      hold(idle, 60_000, input);
      expect(idle.ended).toBe("flood");
      expect(isRankedRun(floodedRuinsEscapeMeta.scoring, "lose")).toBe(false);
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 300 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      expect(ORB.bonusMs).toBe(300);
      const stats = { [STAT.finishMs]: 40_000, [STAT.orbs]: 10, [STAT.comboMs]: 500 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 41_000 }).durationMs).toBe(40_000 - 3000 - 500);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 41_000 }).durationMs).toBe(41_000);
      expect(runTimeMs(1000, 10)).toBe(0);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the least finish is the goal's least arrival (level 5: also Umbra Roller's least defeat time)", () => {
      for (const id of [1, 2, 3, 4] as const) {
         const c = courseFor(id);
         expect(minFinishMs(c)).toBe(minArrivalMs(c)[c.goal]);
         expect(Number.isFinite(minFinishMs(c))).toBe(true);
      }
      const c5 = courseFor(5);
      expect(bossDefeatMinMs(c5)).toBeGreaterThan(10_000);
      expect(minFinishMs(c5)).toBeGreaterThanOrEqual(bossDefeatMinMs(c5));
      expect(minFinishMs(c5)).toBeGreaterThanOrEqual(minArrivalMs(c5)[c5.goal]);
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBe(minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)));
      }
   });

   it("the dash floor: (POWER_MS.dash + 1) ms at V_DASH where the bound counted V_RUN, one dash per cooldown and the first", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const per = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
         const F = minFinishMs(c);
         let T = 0;
         while (T + per * (1 + Math.floor(T / heroById("riko").cooldownMs)) < F) T += 1;
         expect(dashFloorMs(c)).toBe(T - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)));
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(dashFloorMs(c));
      }
   });

   it("every level's minDurationMs sits in 94-100 % of its bound and under the dash floor; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(Math.min(lb * 0.94, Math.floor(dashFloorMs(courseFor(id)) / 100) * 100));
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(lim.maxDurationMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL1_LIMITS).toBe(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(floodedRuinsEscapeMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(floodedRuinsEscapeMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [7900, 180000, 180000, 17210],
   [4900, 210000, 210000, 20510],
   [9200, 240000, 240000, 23080],
   [1700, 270000, 270000, 26830],
   [14300, 300000, 300000, 28570],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot reaches the goal at 30, 60 and 144 fps with every main orb, never under the floor, at least 90 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(lim.maxScore * 0.9);
            expect(run.mainOrbs, `${fps} fps every main orb`).toBe(run.course.mainOrbs);
         }
      }, 120_000);
   }

   it("the honest bot's points: each level at least level 1, level 5 at most 3x", () => {
      const points = (id: LevelId) => Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - submitted(botRun(id, 60))) / 10);
      const first = points(1);
      for (const id of LEVEL_IDS) expect(points(id)).toBeGreaterThanOrEqual(first);
      expect(points(5)).toBeLessThanOrEqual(first * 3);
   }, 120_000);

   it("idle never wins: the timer or the tide ends it unranked", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 40_000 && run.ended === null; f++) step(run, 50, none);
         expect(["timeup", "flood"]).toContain(run.ended);
      }
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 1);
      const input = createStepInput();
      for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, input);
         if (ev.timeup) store.getState().end("timeup");
         if (ev.flooded) store.getState().end("lose");
      }
      expect(["timeup", "lose"]).toContain(store.getState().endReason);
      expect(isRankedRun(floodedRuinsEscapeMeta.scoring, store.getState().endReason)).toBe(false);
   });

   it("120 spam bots on level 1 (random stick, jump mashing and holding, power, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 120; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 6000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = -rng();
               input.jumpHeld = rng() < 0.6;
            }
            input.jumpPressed = rng() < 0.5;
            input.actionPressed = rng() < 0.1;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   }, 120_000);

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const input = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, input);
         const ev = step(run, dt * 1000, input);
         if (ev.finished || run.ended === "win") {
            store.getState().setStat(STAT.orbs, run.orbs);
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
      const fin = finalScore(s);
      const rules = floodedRuinsEscapeMeta.scoring;
      const sent = normalizeRun({ slug: "flooded-ruins-escape", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   }, 120_000);
});

describe("camera-relative stick and solid boxes (for menu2/camera)", () => {
   it("yaw 0 is the world direction itself; a turned camera turns the stick (the yaw is part of the rules' input)", () => {
      const z0 = createRun(1, 1).hero.z;
      const x0 = createRun(1, 1).hero.x;
      const a = createRun(1, 1);
      const ia = createStepInput();
      ia.moveZ = -1;
      hold(a, 300, ia);
      const c = createRun(1, 1);
      const ic = createStepInput();
      ic.moveZ = -1;
      ic.yaw = Math.PI / 2;
      hold(c, 300, ic);
      expect(a.hero.z).toBeLessThan(z0 - 1);
      expect(Math.abs(a.hero.x - x0)).toBeLessThan(1e-9);
      // with the camera turned a quarter, the stick's "up" points along -x
      expect(c.hero.x).toBeLessThan(x0 - 1);
      expect(Math.abs(c.hero.z - z0)).toBeLessThan(1e-9);
   });

   it("the bot at yaw 0 plays exactly as with the yaw left out", () => {
      const a = createRun(1, 1);
      const b = createRun(1, 1);
      const ba = createBot(a);
      const bb = createBot(b);
      const ia = createStepInput();
      const ib = createStepInput();
      for (let f = 0; f < 3000 && a.ended === null; f++) {
         botInput(ba, a, ia);
         botInput(bb, b, ib);
         ib.yaw = 0;
         step(a, 1000 / 60, ia);
         step(b, 1000 / 60, ib);
      }
      expect(b.hero).toEqual(a.hero);
   });

   it("solidBoxes lists every block where it is now (a crate at its water, a broken brick left out)", () => {
      const run = createRun(1, 1);
      const out: SolidBox[] = [];
      const n = solidBoxes(run, 0, out);
      expect(n).toBe(run.course.supports.length);
      const first = run.course.supports[0];
      expect(out[0]).toEqual({ minX: first.cx - first.hw, maxX: first.cx + first.hw, minY: first.bottom, maxY: first.top, minZ: first.cz - first.hd, maxZ: first.cz + first.hd });
      const r2 = createRun(1, 2);
      const crack = r2.course.supports.findIndex((s) => s.crack);
      r2.broken[crack] = 1;
      expect(solidBoxes(r2, 0, out)).toBe(r2.course.supports.length - 1);
   });
});
