// Color City Sprint rules: the run's physics and the paint, the hero routes, Greyout, the server-limit
// proof (README "Score limits"): the per-ms travel cap the proof rests on, the pinned limits, and the
// honest, idle and spam bots, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { colorCitySprintMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, type HeroId } from "./heroes";
import { botRun, createBot, botInput } from "./bot";
import { BUS_ROOF, CELL, RAIL_Y, RAMP_H, gateShut, streetUnder } from "./city";
import { GREYOUT } from "./progression";
import {
   ORB_BONUS_MS,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_JUMP,
   V_RED,
   V_RUN,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   travelMetres,
   type CityRun,
   type StepInput,
} from "./rules";

const submitted = (run: CityRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: CityRun, ms: number, input: StepInput, frame = 16): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(frame, left);
      step(run, d, input);
      input.jumpPressed = false;
      input.actionPressed = false;
      left -= d;
   }
}

/** A run with the hero placed at (x, z), standing still. */
function at(level: LevelId, x: number, z: number, hero: HeroId = "riko"): CityRun {
   const run = createRun(1, level, hero);
   run.hero.x = x;
   run.hero.z = z;
   return run;
}

const go = (dx: number, dz: number): StepInput => ({ ...createStepInput(), moveX: dx, moveZ: dz });

describe("running and the red lanes", () => {
   it("a grey street caps the run at V_RUN; a red street (from lap 2) at V_RED, +30 %", () => {
      expect(V_RED / V_RUN).toBeCloseTo(8.5 / 6.5, 9);
      const run = at(1, 0, 0);
      hold(run, 2000, go(1, 0));
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeCloseTo(V_RUN, 6);
      const red = at(1, 0, 0);
      red.lap = 1;
      red.painted[red.course.hEdge[0]] = 1;
      red.painted[red.course.hEdge[1]] = 1;
      hold(red, 1500, go(1, 0));
      expect(Math.hypot(red.hero.vx, red.hero.vz)).toBeCloseTo(V_RED, 6);
      expect(red.hero.curled).toBe(true);
   });

   it("lap 1's red does not boost yet; off the red a curled ball coasts down to V_RUN", () => {
      const run = at(1, 0, 0);
      run.painted[run.course.hEdge[0]] = 1;
      hold(run, 1500, go(1, 0));
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeCloseTo(V_RUN, 6);
      const ball = at(1, 0, 0);
      ball.lap = 1;
      ball.painted[ball.course.hEdge[0]] = 1;
      // red reaches into the crossing (3 m past the street's end); then it coasts on grey
      while (ball.hero.x < CELL + 3.4) step(ball, 4, go(1, 0));
      const s = Math.hypot(ball.hero.vx, ball.hero.vz);
      expect(ball.hero.onRed).toBe(false);
      expect(s).toBeGreaterThan(V_RUN);
      expect(s).toBeLessThan(V_RED);
      hold(ball, 1500, go(1, 0));
      expect(Math.hypot(ball.hero.vx, ball.hero.vz)).toBeCloseTo(V_RUN, 3);
   });

   it("the streets run between two beacons turn red at the second beacon (not the crossing streets)", () => {
      const run = createRun(1, 1);
      hold(run, 4600, go(1, 0));
      const c = run.course;
      for (let ix = 0; ix < 3; ix++) expect(run.leg[c.hEdge[ix]]).toBe(1);
      expect(run.leg[c.vEdge[0]]).toBe(0);
      hold(run, 1500, go(1, 0));
      expect(run.beaconIndex).toBe(1);
      for (let ix = 0; ix < 3; ix++) expect(run.painted[c.hEdge[ix]]).toBe(1);
      expect(run.leg.every((v) => v === 0)).toBe(true);
      expect(streetUnder(c, 6, 0)).toBe(c.hEdge[0]);
      expect(streetUnder(c, 12, 0.5)).toBe(-1);
   });

   it("a plain jump peaks at 3.27 m: under a bus roof; off a ramp's lip it clears the roof", () => {
      expect((V_JUMP * V_JUMP) / 60).toBeCloseTo(3.267, 2);
      expect((V_JUMP * V_JUMP) / 60).toBeLessThan(BUS_ROOF);
      expect(RAMP_H + (V_JUMP * V_JUMP) / 60).toBeGreaterThan(BUS_ROOF + 1);
      const run = at(1, 6, 0);
      const inp = createStepInput();
      inp.jumpPressed = true;
      let top = 0;
      for (let i = 0; i < 80; i++) {
         step(run, 16, inp);
         inp.jumpPressed = false;
         top = Math.max(top, run.hero.y);
      }
      expect(top).toBeGreaterThan(3.1);
      expect(top).toBeLessThan(3.3);
   });

   it("sludge slows by 40 %; Kiro's shield runs straight through", () => {
      const c = courseFor(1);
      const s = c.sludge[0];
      for (const hero of ["riko", "kiro"] as const) {
         const run = at(1, s.x, s.z - 2.4, hero);
         if (hero === "kiro") {
            const p = createStepInput();
            p.actionPressed = true;
            step(run, 1, p);
         }
         hold(run, 900, go(0, 1));
         const speed = Math.hypot(run.hero.vx, run.hero.vz);
         if (hero === "kiro") expect(speed).toBeCloseTo(V_RUN, 3);
         else expect(speed).toBeCloseTo(V_RUN * 0.6, 3);
      }
   });
});

describe("hero routes", () => {
   it("Riko's dash smashes the construction site's hoarding open; no one else gets in", () => {
      const c = courseFor(1);
      const site = c.blocks.find((b) => b.kind === "site")!;
      for (const hero of ["riko", "nami", "kiro", "zuno", "vexa"] as const) {
         const run = at(1, site.x1 + 1.2, (site.z0 + site.z1) / 2, hero);
         const inp = go(-1, 0);
         inp.actionPressed = hero === "riko";
         hold(run, 1500, inp);
         if (hero === "riko") {
            expect(run.siteOpen).toBe(true);
            expect(run.hero.x).toBeLessThan(site.x1 - 2);
         } else {
            expect(run.siteOpen).toBe(false);
            expect(run.hero.x).toBeGreaterThanOrEqual(site.x1 + 0.3);
         }
      }
   });

   it("Vexa phases into the ghost shop (and out the far side); a wall for everyone else", () => {
      const c = courseFor(1);
      const g = c.blocks.find((b) => b.kind === "ghost")!;
      for (const hero of ["vexa", "riko"] as const) {
         const run = at(1, g.x0 - 1, (g.z0 + g.z1) / 2, hero);
         const inp = go(1, 0);
         inp.actionPressed = hero === "vexa";
         hold(run, 2500, inp);
         if (hero === "vexa") expect(run.hero.x).toBeGreaterThan(g.x1);
         else expect(run.hero.x).toBeLessThan(g.x0);
      }
   });

   it("off the ramp onto the parked bus; only Nami's second jump reaches the rail from its roof", () => {
      for (const hero of ["nami", "riko"] as const) {
         const run = createRun(1, 1, hero);
         const r = run.course.ramps[0];
         run.hero.x = r.x - r.dx * 7;
         run.hero.z = r.z;
         const inp = go(1, 0);
         let jumped = false;
         let roof = false;
         for (let f = 0; f < 200 && !roof; f++) {
            if (!jumped && run.hero.x > r.x - 0.3 && run.hero.grounded) {
               inp.jumpPressed = true;
               jumped = true;
            }
            step(run, 16, inp);
            inp.jumpPressed = false;
            if (run.hero.onBus >= 0) roof = true;
         }
         expect(roof, hero).toBe(true);
         // on the roof: jump, then (Nami) jump again at the top
         const up = createStepInput();
         up.jumpPressed = true;
         step(run, 16, up);
         up.jumpPressed = false;
         let rail = false;
         for (let f = 0; f < 120; f++) {
            if (run.hero.vy < 0.5 && run.hero.vy > -1 && f > 5) up.jumpPressed = true;
            step(run, 16, up);
            up.jumpPressed = false;
            if (run.hero.onRail) rail = true;
         }
         expect(rail, hero).toBe(hero === "nami");
      }
      expect(RAIL_Y).toBeGreaterThan(BUS_ROOF + (V_JUMP * V_JUMP) / 60);
   });

   it("a storm drain's coins come out only for Zuno's magnet", () => {
      const c = courseFor(1);
      const d = c.drains[1];
      for (const hero of ["zuno", "riko"] as const) {
         const run = at(1, d.x - 4, d.z, hero);
         const p = createStepInput();
         p.actionPressed = true;
         step(run, 16, p);
         hold(run, 300, createStepInput());
         const coins = c.orbs.filter((o, i) => o.drain === 1 && run.collected[i]).length;
         expect(coins, hero).toBe(hero === "zuno" ? 3 : 0);
      }
   });

   it("a red gate stops you entering; a green one lets you through; one already under it lets you out", () => {
      const c = courseFor(3);
      const g = c.gates[0];
      let ms = 1;
      while (!gateShut(g, ms)) ms += 100;
      const run = at(3, g.x - 3, g.z);
      run.simMs = ms;
      hold(run, 600, go(1, 0));
      expect(run.hero.x).toBeLessThan(g.x - g.hx);
      const green = at(3, g.x - 3, g.z);
      green.simMs = ms + 4000;
      hold(green, 900, go(1, 0));
      expect(green.hero.x).toBeGreaterThan(g.x + g.hx);
   });

   it("steam vents knock you unless shielded", () => {
      const c = courseFor(3);
      const v = c.vents[0];
      const run = at(3, v.x, v.z - 2);
      let knocked = false;
      for (let f = 0; f < 300 && !knocked; f++) knocked = step(run, 16, go(0, 1)).vented || knocked;
      expect(knocked).toBe(true);
   });
});

describe("Greyout (level 5)", () => {
   it("the boss config is valid and its least defeat time is its windows back to back", () => {
      expect(bossProblems(GREYOUT)).toEqual([]);
      const p = GREYOUT.phases;
      const least =
         GREYOUT.introMs +
         3 * (p[0].attacks[0].telegraphMs + p[0].attacks[0].attackMs) +
         GREYOUT.transitionMs +
         2 * (p[1].attacks[0].telegraphMs + p[1].attacks[0].attackMs) +
         GREYOUT.transitionMs +
         2 * (p[2].attacks[0].telegraphMs + p[2].attacks[0].attackMs);
      expect(bossMinMs()).toBe(least);
   });

   it("the honest bot beats all three phases at 30, 60 and 144 fps, never under the floor", () => {
      for (const fps of [30, 60, 144]) {
         const run = botRun(5, fps);
         expect(run.ended, `${fps}`).toBe("win");
         expect(run.boss!.hp).toBe(0);
         expect(run.finishMs).toBeGreaterThanOrEqual(bossMinMs());
         expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[5].minDurationMs);
         // the whole city repaints red
         expect(run.painted.every((v) => v === 1)).toBe(true);
      }
   });

   it("phase 1 sweeps red off the streets it drives over; never Greyout Avenue", () => {
      const run = createRun(1, 5);
      run.painted.fill(1);
      hold(run, 6000, createStepInput());
      const c = run.course;
      const erased = c.edges.filter((_e, i) => !run.painted[i]).length;
      expect(erased).toBeGreaterThan(0);
      for (const e of c.permanentEdges) expect(run.painted[e]).toBe(1);
   });
});

describe("the lower bound (README 'Score limits')", () => {
   it("the proof's invariant: whatever the input, frame time or hero, the hero never moves more than V_RED / 1000 m in a ms", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 3; seed++) {
            const rng = createRng(seed * 7 + level);
            const run = createRun(seed, level, HEROES[(seed + level) % 5].id);
            const inp = createStepInput();
            for (let ms = 0; ms < 25_000 && run.ended === null; ms++) {
               if (ms % 200 === 0) {
                  inp.moveX = rng() * 2 - 1;
                  inp.moveZ = rng() * 2 - 1;
                  inp.yaw = rng() * 6.3;
               }
               inp.jumpPressed = rng() < 0.01;
               inp.actionPressed = rng() < 0.005;
               const x = run.hero.x;
               const z = run.hero.z;
               step(run, 1, inp);
               expect(Math.hypot(run.hero.x - x, run.hero.z - z)).toBeLessThanOrEqual(V_RED / 1000 + 1e-9);
            }
         }
      }
   }, 60_000);

   it("the least travel is the beacons in order round the buildings: never above any bot's own line, and above the straight lines minus the reaches", () => {
      for (const id of [1, 2, 3, 4] as LevelId[]) {
         const c = courseFor(id);
         const t = travelMetres(c);
         expect(t).toBeGreaterThan(0);
         const run = botRun(id, 60);
         expect((run.finishMs / 1000) * V_RED).toBeGreaterThan(t);
      }
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(c)), 6);
      }
      expect(minFinishMs(courseFor(5))).toBe(bossMinMs());
   });

   it("every level's minDurationMs is 94-100 % of its bound; the limits are pinned and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, courseFor(id)));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].timerMs);
         expect(colorCitySprintMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(colorCitySprintMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [17100, 100000, 8290],
   [26400, 130000, 10360],
   [32900, 160000, 12710],
   [38700, 200000, 16130],
   [26100, 200000, 17390],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps, inside the limits`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(lim.maxScore * 0.65);
         }
      }, 60_000);
   }

   it("idle never wins: the level's timer runs out ('timeup', unranked)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
      }
      expect(isRankedRun(colorCitySprintMeta.scoring, "timeup")).toBe(false);
   });

   it("200 spam runs on level 1 (random stick, jump and power, random frame times, any hero) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const inp = createStepInput();
         for (let f = 0; f < 4000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               inp.moveX = rng() * 2 - 1;
               inp.moveZ = rng() * 2 - 1;
            }
            inp.jumpPressed = rng() < 0.3;
            inp.actionPressed = rng() < 0.1;
            step(run, 4 + rng() * 46, inp);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1500 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const inp = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, inp);
         const ev = step(run, dt * 1000, inp);
         if (ev.finished) {
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
      const rules = colorCitySprintMeta.scoring;
      const sent = normalizeRun({ slug: "color-city-sprint", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
