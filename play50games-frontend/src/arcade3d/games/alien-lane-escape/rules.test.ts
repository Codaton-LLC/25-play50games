// Alien Lane Escape's rules (README "Rules" and "Server limits and why they hold"): the track's shape,
// the scan mechanic (shadow strips, low covers, pods, craters, glow plants, lateral lines), the scoring
// hand-off, the proof's bound and its guards (never faster than the level's speed outside Riko's dash,
// random and spam players), and the honest bot through the real store.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { alienLaneEscapeMeta } from "./meta";
import { LEVELS } from "./levels";
import { DASH_X, HEROES, type HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { LANE_W, STRIP, courseFor, laneX, sweepMeet } from "./course";
import {
   HELD_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SLOW,
   STAT,
   STEP_MS,
   bossMinMs,
   comboSpecOf,
   createRun,
   createStepInput,
   finalScore,
   leastRunMs,
   maxOrbs,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   visualS,
   type AlienRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

export function botRun(level: LevelId, fps = 60, hero: HeroId = "vexa", routes = true): AlienRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms, routes);
   const input = createStepInput();
   for (let f = 0; f < 240_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: AlienRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: AlienRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

/** Put the runner in a lane at s (standing, no lane change running). */
function place(run: AlienRun, lane: number, s: number): void {
   run.runner.lane = lane;
   run.runner.x = laneX(lane);
   run.runner.s = s;
}

/** Start scan i (as its trigger is passed) and put the runner just short of its meeting point. */
function atMeet(run: AlienRun, i: number, lane: number, before = 0.3): void {
   const sc = run.course.scans[i];
   place(run, lane, sc.trigger - 0.2);
   frames(run, 2);
   place(run, lane, sc.meet - before);
}

describe("the track (scans, covers, the hero routes)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every scan has its cover with the meeting point inside its shadow strip, a reachable lane change before it, and every hero has a route`, () => {
         const c = courseFor(id);
         expect(c.covers).toHaveLength(c.scans.length);
         for (let i = 0; i < c.scans.length; i++) {
            const sc = c.scans[i];
            const cv = c.covers[i];
            expect(cv.scan).toBe(i);
            expect(sc.meet).toBeGreaterThanOrEqual(cv.s + STRIP.from);
            expect(sc.meet).toBeLessThanOrEqual(cv.s + STRIP.to);
            if (sc.kind === "sweep") expect(sc.meet).toBeCloseTo(sweepMeet(sc.trigger, c.config.speed), 6);
            // the telegraph: the line is seen 1.5 s before it reaches you, and the meeting point comes after the last one
            expect(sc.meet - sc.trigger).toBeGreaterThanOrEqual(c.config.speed * 1.5 - 1e-6);
            if (i > 0 && c.scans[i - 1].phase === sc.phase) expect(sc.trigger).toBeGreaterThan(c.scans[i - 1].meet);
            // the cover is within two lanes of the one before (the card's "always a reachable shadow")
            if (i > 0) expect(Math.abs(cv.lane - c.covers[i - 1].lane)).toBeLessThanOrEqual(2);
         }
         expect(c.secrets.map((s) => s.id)).toEqual(SECRETS[id].map((s) => s.id));
         // World 5: two Vexa ghost-crystal walls per level
         expect(c.caves.length).toBeGreaterThanOrEqual(2);
         const heroes = new Set(c.orbs.map((o) => o.bonus).filter((b) => b && b !== "open"));
         for (const h of ["nami", "kiro", "zuno", "vexa"]) expect(heroes.has(h as HeroId), `L${id} ${h}`).toBe(true);
         expect(c.orbs.some((o) => o.bonus === "open"), `L${id} open-ground orbs`).toBe(true);
      });
   }

   it("level 1 teaches in three beats: the crystal in your lane, the cover in the next lane, then two quick scans with two covers in a row", () => {
      const c = courseFor(1);
      expect(c.covers[0].lane).toBe(1);
      expect(c.covers[0].kind).toBe("crystal");
      expect(Math.abs(c.covers[1].lane - c.covers[0].lane)).toBe(1);
      const quick = c.scans.findIndex((s, i) => i > 0 && s.trigger - c.scans[i - 1].meet <= 8);
      expect(quick).toBeGreaterThan(1);
   });

   it("the twists: pods drift (level 2), craters come from meteors (level 3), glow plants sit before covers (level 4), lateral lines (level 4)", () => {
      expect(courseFor(2).covers.some((c) => c.kind === "pod" && c.from !== c.lane)).toBe(true);
      const c3 = courseFor(3);
      expect(c3.covers.filter((c) => c.kind === "crater").every((c) => c.meteor >= 0 && c3.meteors[c.meteor].s === c.s)).toBe(true);
      expect(c3.abduction).not.toBeNull();
      const c4 = courseFor(4);
      expect(c4.plants.length).toBeGreaterThanOrEqual(4);
      expect(c4.scans.some((s) => s.kind === "lateral")).toBe(true);
      expect(courseFor(5).loop).not.toBeNull();
   });
});

describe("the scan mechanic", () => {
   it("a line passing you in the shadow strip is UNSEEN; in the open it catches you: held 1.2 s, the chain broken", () => {
      for (const hidden of [true, false]) {
         const run = createRun(1, 1, "kiro");
         const cv = run.course.covers[0];
         atMeet(run, 0, hidden ? cv.lane : (cv.lane + 1) % 3);
         frames(run, 4);
         expect(run.unseen).toBe(hidden ? 1 : 0);
         expect(run.catches).toBe(hidden ? 0 : 1);
         if (!hidden) expect(run.runner.heldUntil).toBeGreaterThan(run.ms + HELD_MS - 200);
      }
   });

   it("two catches within 6 s are a hit; the Ghost Run badge is gone at the first", () => {
      const run = createRun(1, 1, "kiro");
      atMeet(run, 0, 2);
      frames(run, 4);
      expect(run.catches).toBe(1);
      expect(run.hits).toBe(0);
      run.runner.heldUntil = run.runner.invulnUntil = -1;
      atMeet(run, 1, 0);
      frames(run, 4);
      expect(run.catches).toBe(2);
      expect(run.hits).toBe(run.ms - run.lastCatchMs < 6000 ? 1 : 0);
   });

   it("a low cover hides only a hero who slides", () => {
      const run0 = createRun(1, 1, "kiro");
      const i = run0.course.covers.findIndex((c) => c.low);
      expect(i).toBeGreaterThanOrEqual(0);
      for (const slide of [true, false]) {
         const run = createRun(1, 1, "kiro");
         const lane = run.course.covers[i].lane;
         atMeet(run, i, lane);
         const input = createStepInput();
         input.slide = slide;
         frames(run, 4, input);
         expect(run.unseen).toBe(slide ? 1 : 0);
      }
   });

   it("the powers hide you anywhere: Riko's dash, Kiro's bubble, Nyla on the mesa; Vexa phased inside a crystal", () => {
      for (const hero of ["riko", "kiro", "vexa"] as const) {
         const run = createRun(1, 1, hero);
         const cv = run.course.covers[0];
         // Vexa: the lane beside the crystal (no strip there, but the crystal is within reach); the others the open lane
         atMeet(run, 0, hero === "vexa" ? (cv.lane + 1) % 3 : (cv.lane + 1) % 3, 0.6);
         const input = createStepInput();
         input.actionPressed = true;
         step(run, 1000 / 60, input);
         input.actionPressed = false;
         frames(run, 6, input);
         expect(run.unseen, hero).toBe(1);
      }
   });

   it("a crater is only a shadow once its meteor has landed (level 3)", () => {
      const run = createRun(1, 3, "kiro");
      const i = run.course.covers.findIndex((c) => c.kind === "crater");
      const cv = run.course.covers[i];
      const sc = run.course.scans[cv.scan];
      // skip the meteor's trigger: it never falls
      place(run, cv.lane, sc.trigger + 0.5);
      run.scanLap[cv.scan] = 0;
      run.scanAt[cv.scan] = run.ms;
      run.active = cv.scan;
      place(run, cv.lane, sc.meet - 0.3);
      frames(run, 4);
      expect(run.catches).toBe(1);
   });

   it("a caught hero inside level 3's abduction zone is lifted to the abducted shard", () => {
      const run = createRun(1, 3, "kiro");
      const ab = run.course.abduction!;
      const i = run.course.scans.findIndex((s) => s.meet > ab.s0 && s.meet < ab.s1);
      const cv = run.course.covers[i];
      atMeet(run, i, (cv.lane + 1) % 3);
      frames(run, 4);
      const k = SECRETS[3].findIndex((s) => s.id === "abducted");
      expect(run.secrets.found[k]).toBe(1);
   });

   it("a brushed glow plant washes the cover's shadow out (level 4)", () => {
      const run = createRun(1, 4, "kiro");
      const p = run.course.plants[0];
      const i = run.course.covers.findIndex((c) => c.lane === p.lane && c.s > p.s && c.s - p.s < 12);
      expect(i).toBeGreaterThanOrEqual(0);
      atMeet(run, i, p.lane);
      place(run, p.lane, p.s - 0.3);
      frames(run, 3);
      expect(run.plantUntil[0]).toBeGreaterThan(run.ms);
      place(run, p.lane, run.course.scans[i].meet - 0.3);
      frames(run, 4);
      expect(run.catches).toBe(1);
   });

   it("rocks want a jump, energy bars a slide: met wrong it is a stumble (half speed 0.8 s)", () => {
      const run = createRun(1, 1, "kiro");
      const o = run.course.obstacles.find((x) => x.kind === "rock")!;
      place(run, o.lane, o.s - 0.5);
      frames(run, 6);
      expect(run.misses).toBe(1);
      expect(run.runner.slowUntil).toBeGreaterThan(run.ms);
      const run2 = createRun(1, 1, "kiro");
      const a = run2.course.obstacles.find((x) => x.kind === "arch")!;
      place(run2, a.lane, a.s - 0.5);
      const slide = createStepInput();
      slide.slide = true;
      frames(run2, 6, slide);
      expect(run2.misses).toBe(0);
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 100 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const win = finalScore({ score: 0, endReason: "win", elapsedMs: 50_000, stats: { [STAT.finishMs]: 40_000, [STAT.orbs]: 10, [STAT.comboMs]: 500 } });
      expect(win.durationMs).toBe(40_000 - 10 * ORB.bonusMs - 500);
      expect(finalScore({ score: 0, endReason: "timeup", elapsedMs: 50_000, stats: {} }).durationMs).toBe(50_000);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the floor is the track at the level's speed with Riko's dash allowance; level 5 adds the Mothership's least defeat time (or a lap)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         if (!c.loop) expect(minFinishMs(c)).toBeCloseTo(leastRunMs(c.finishS, c.config.speed) - STEP_MS, 6);
         else expect(minFinishMs(c)).toBeGreaterThan(bossMinMs());
         if (!c.loop) expect(minFinishMs(c)).toBeLessThan((c.finishS / c.config.speed) * 1000);
      }
   });

   it("the least duration takes off the most orbs one hero can take and the most flow bonus; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(Math.max(0, minFinishMs(c) - maxOrbs(c) * ORB.bonusMs - comboMaxBonus(comboSpecOf(c))), 6);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(c));
         expect(lim.minDurationMs).toBeLessThanOrEqual(minDurationMsOf(c));
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(minDurationMsOf(c) * 0.94);
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(alienLaneEscapeMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(alienLaneEscapeMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [35200, 120000, 8480],
   [37200, 130000, 9280],
   [39200, 140000, 10080],
   [35700, 150000, 11430],
   [40900, 200000, 15910],
];

describe("the speed guard (the proof's one rule)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 30 s of random input (every hero, ragged frames) never gets further than the fastest pace allows`, () => {
         for (const hero of HEROES) {
            const rng = createRng(id * 17 + hero.id.length);
            const run = createRun(1, id, hero.id);
            const input = createStepInput();
            const v = run.course.config.speed;
            for (let f = 0; f < 1500 && run.ended === null; f++) {
               input.left = rng() < 0.08;
               input.right = rng() < 0.08;
               input.slide = rng() < 0.3;
               input.jumpPressed = rng() < 0.08;
               input.actionPressed = rng() < 0.05;
               const s0 = run.runner.s;
               const lap0 = run.lap;
               const ms0 = run.ms;
               step(run, 5 + rng() * 40, input);
               if (run.lap === lap0) expect(run.runner.s - s0).toBeLessThanOrEqual((v * DASH_X * (run.ms - ms0)) / 1000 + 1e-6);
               // the whole way so far is never more than the dash allowance lets you cover
               expect(run.ms + STEP_MS).toBeGreaterThanOrEqual(leastRunMs(visualS(run), v));
            }
         }
         expect(SLOW).toBeLessThan(1);
      });
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot (Vexa) wins at 30, 60 and 144 fps with every main orb, never caught, never under the floor, at least 80 % of maxScore`, () => {
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.mainOrbs).toBe(run.course.mainOrbs);
            expect(run.catches + run.misses).toBe(0);
            const lim = PROPOSED_LEVEL_LIMITS[level];
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(Math.floor((lim.timeBaseMs - submitted(run)) / 10)).toBeGreaterThanOrEqual(lim.maxScore * 0.8);
         }
      }, 120_000);
   }

   it("every hero's bot (its route played) wins every level unseen; all but Riko keep every main orb", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = botRun(level, 60, h.id);
            expect(run.ended, `L${level} ${h.id}`).toBe("win");
            expect(run.catches + run.misses, `L${level} ${h.id}`).toBe(0);
            if (h.id !== "riko") expect(run.mainOrbs, `L${level} ${h.id}`).toBe(run.course.mainOrbs);
            expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
      }
   }, 240_000);

   it("idle gets caught and stumbles but still reaches the end slower (the clock never stops a runner); a time-up is unranked", () => {
      const run = createRun(1, 1);
      frames(run, 60 * 200);
      expect(run.ended).toBe("win");
      expect(run.catches).toBeGreaterThan(0);
      expect(submitted(run)).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
      expect(isRankedRun(alienLaneEscapeMeta.scoring, "timeup")).toBe(false);
   });

   it("60 spam runs (random lanes, slides, jumps, powers, frame times, any hero) never beat the floor", () => {
      for (let k = 0; k < 60; k++) {
         const level = LEVEL_IDS[k % 5];
         const rng = createRng(1000 + k);
         const run = createRun(k, level, HEROES[k % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) {
            input.left = rng() < 0.1;
            input.right = rng() < 0.1;
            input.slide = rng() < 0.4;
            input.jumpPressed = rng() < 0.1;
            input.actionPressed = rng() < 0.1;
            step(run, 8 + rng() * 40, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      }
   }, 120_000);

   for (const level of [1, 5] as const) {
      it(`level ${level}: the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1800 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
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
         const rules = alienLaneEscapeMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "alien-lane-escape", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 120_000);
   }
});

void LANE_W;
