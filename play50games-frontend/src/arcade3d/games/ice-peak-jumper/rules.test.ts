// Ice Peak Jumper's rules (README "Rules" and "Server limits and why they hold"): the course's shape,
// the slide-launch physics, the beacons, the hazards, the scoring hand-off, the proof's bound and its
// guards (the speed and the climb on every substep, random and spam players), and the honest bot
// through the real store.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { icePeakJumperMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, type HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { courseFor, halfAlong, dirBetween } from "./course";
import {
   APEX,
   BRAKE,
   ICE_ACCEL,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_CLIMB_MAX,
   V_ICE,
   V_JUMP,
   V_LAUNCH_MIN,
   V_MAX,
   bossMinMs,
   comboSpecOf,
   createRun,
   createStepInput,
   finalScore,
   flightMs,
   launchReach,
   maxOrbs,
   maxTravel,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   travelFloorMs,
   type PeakRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

function botRun(level: LevelId, fps = 60, hero: HeroId = "zuno"): PeakRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 300_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: PeakRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: PeakRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

/** Put the hero standing on a platform's centre (tests). */
function standOn(run: PeakRun, id: number): void {
   const p = run.course.plats[id];
   const h = run.hero;
   h.x = p.x;
   h.z = p.z;
   h.y = p.y;
   h.vx = h.vy = h.vz = 0;
   h.ground = id;
}

describe("the peak (a route of slide-launches, hero routes, hazards)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every link is one compass direction centre to centre, rises at most 1.6 m and is jumpable; a snow patch at least every 3 platforms`, () => {
         const c = courseFor(id);
         let sinceSnow = 0;
         for (let i = 1; i < c.route.length; i++) {
            const a = c.plats[c.route[i - 1]];
            const b = c.plats[c.route[i]];
            if (a.kind === "boss" || b.kind === "boss" || (c.arena && b.id === c.goal)) continue;
            const d = dirBetween(a, b);
            if (d === "N" || d === "S") expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6);
            else expect(Math.abs(a.z - b.z)).toBeLessThan(1e-6);
            const rise = b.y - a.y;
            expect(rise).toBeLessThanOrEqual(1.6 + 1e-9);
            const gap = Math.abs(d === "N" || d === "S" ? a.z - b.z : a.x - b.x) - halfAlong(a, d) - halfAlong(b, d);
            // the full slide of the platform launching it reaches past the gap (snow: a walk's launch)
            const run = a.surface === "snow" ? 5 : Math.min(V_ICE, Math.sqrt(2 * ICE_ACCEL * (2 * halfAlong(a, d) - 0.8)));
            expect(launchReach(run, rise), `L${id} link ${i}`).toBeGreaterThan(gap + 0.5);
            sinceSnow = b.surface === "snow" ? 0 : sinceSnow + 1;
            if (id <= 3) expect(sinceSnow).toBeLessThanOrEqual(3);
         }
      });

      it(`level ${id}: no two platforms (outside the golem's arena) overlap; the secrets match progression; ${id === 5 ? "the arena and the golem's three targets" : "the goal is the last beacon"}`, () => {
         const c = courseFor(id);
         for (const a of c.plats) {
            for (const b of c.plats) {
               if (a.id >= b.id || a.kind === "boss" || b.kind === "boss") continue;
               const ox = Math.abs(a.x - b.x) < a.hx + b.hx - 0.05;
               const oz = Math.abs(a.z - b.z) < a.hz + b.hz - 0.05;
               const oy = Math.abs(a.y - b.y) < 2.6;
               expect(ox && oz && oy, `L${id} plats ${a.id} and ${b.id}`).toBe(false);
            }
         }
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         expect(c.beacons[c.beacons.length - 1]).toBe(c.goal);
         if (id === 5) {
            expect(c.arena).not.toBeNull();
            for (const t of c.arena!.targets) expect(c.plats[t].kind).toBe("boss");
         } else expect(c.arena).toBeNull();
      });
   }

   it("level 1 teaches in three beats: a flat ice sheet into a snow patch, then the 3 m gap, then cracked ice", () => {
      const c = courseFor(1);
      const r = c.route.map((id) => c.plats[id]);
      expect(r[1].surface).toBe("ice");
      expect(r[2].surface).toBe("snow");
      const gaps = r.slice(1).map((b, i) => {
         const a = r[i];
         const d = dirBetween(a, b);
         return Math.abs(d === "N" || d === "S" ? a.z - b.z : a.x - b.x) - halfAlong(a, d) - halfAlong(b, d);
      });
      expect(gaps.findIndex((g) => Math.abs(g - 3) < 1e-6)).toBeLessThan(gaps.findIndex((_, i) => r[i + 1].surface === "cracked"));
      expect(r.some((p) => p.surface === "cracked")).toBe(true);
   });
});

describe("the slide-launch", () => {
   it("ice: the stick accelerates at 5 m/s² to 9 m/s and nothing slows you; the brake takes 6 m/s²", () => {
      const run = createRun(1, 1);
      const sheet = run.course.route[1];
      standOn(run, sheet);
      run.hero.z = run.course.plats[sheet].z + run.course.plats[sheet].hz - 0.5;
      const push = createStepInput();
      push.moveZ = -1;
      frames(run, 60, push);
      const v1 = Math.hypot(run.hero.vx, run.hero.vz);
      expect(v1).toBeGreaterThan(ICE_ACCEL * 0.9);
      expect(v1).toBeLessThan(ICE_ACCEL * 1.05);
      // let go: it glides on unchanged
      const vz = run.hero.vz;
      frames(run, 10);
      expect(run.hero.vz).toBeCloseTo(vz, 6);
      const brake = createStepInput();
      brake.brake = true;
      frames(run, 30, brake);
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeLessThan(v1 - BRAKE * 0.45);
   });

   it("a jump keeps the slide's speed: 2.5 m standing, about 7 m at 9 m/s, a fixed 2.2 m apex", () => {
      expect(launchReach(0, 0)).toBeCloseTo(2.5, 1);
      expect(launchReach(V_ICE, 0)).toBeCloseTo(7.0, 1);
      expect((V_JUMP * V_JUMP) / (2 * 23.2)).toBeCloseTo(APEX, 6);
      expect(flightMs(1)).toBeLessThan(flightMs(0));
      expect(V_LAUNCH_MIN).toBeCloseTo(3.2, 6);
   });

   it("snow grips: you stop when you let go; a fall drops you back on the last beacon lit", () => {
      const run = createRun(1, 1);
      const push = createStepInput();
      push.moveX = 1;
      frames(run, 20, push);
      frames(run, 20);
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeLessThan(0.01);
      run.hero.ground = -1;
      run.hero.y = -30;
      frames(run, 60);
      expect(run.falls).toBe(1);
      expect(run.hero.ground).toBe(run.course.start);
   });

   it("the beacons light in order only; the summit opens once all are lit", () => {
      const run = createRun(1, 1);
      const c = run.course;
      standOn(run, c.beacons[1]);
      run.hero.ground = -1;
      run.hero.y += 0.3;
      frames(run, 10);
      expect(run.lit).toBe(0);
      standOn(run, c.goal);
      run.hero.ground = -1;
      run.hero.y += 0.3;
      frames(run, 10);
      expect(run.ended).toBeNull();
   });

   it("cracked ice shatters 1.2 s after the first touch and comes back 4 s later", () => {
      const run = createRun(1, 1);
      const cracked = run.course.plats.find((p) => p.surface === "cracked")!;
      standOn(run, cracked.id);
      run.touchedAt[cracked.id] = 0;
      frames(run, 75);
      expect(run.goneAt[cracked.id]).toBeGreaterThanOrEqual(0);
      frames(run, 260);
      expect(run.goneAt[cracked.id]).toBe(-1);
   });
});

describe("hazards", () => {
   it("an icicle shakes for 0.8 s once you pass under, then drops: standing under it is a hit", () => {
      const run = createRun(1, 2);
      const ic = run.course.icicles[0];
      const p = run.course.plats.find((q) => Math.abs(ic.x - q.x) <= q.hx && Math.abs(ic.z - q.z) <= q.hz && Math.abs(ic.y - q.y) < 1e-6)!;
      standOn(run, p.id);
      run.hero.x = ic.x;
      run.hero.z = ic.z;
      frames(run, 70);
      expect(run.hits).toBe(1);
   });

   it("the yeti's snowball lands 1.2 s after the throw where you stood; Kiro's shield blocks it", () => {
      for (const hero of ["zuno", "kiro"] as HeroId[]) {
         const run = createRun(1, 3, hero);
         const y = run.course.yetis[0];
         const p = run.course.plats.find((q) => q.kind === "main" && q.x >= y.zone.x0 && q.x <= y.zone.x1 && q.z >= y.zone.z0 && q.z <= y.zone.z1 && q.y >= y.zone.y0)!;
         standOn(run, p.id);
         run.ms = 10_000;
         run.nextThrow = 10_000;
         const shield = createStepInput();
         shield.actionPressed = hero === "kiro";
         frames(run, 1, shield);
         frames(run, 90);
         expect(run.hits).toBe(hero === "kiro" ? 0 : 1);
      }
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
   it("travel: 9 m/s plus each dash's 4 m/s for its 0.5 s (one per 4 s); travelFloorMs inverts it", () => {
      // the floor never asks for more time than the travel really took
      for (const ms of [0, 500, 3999, 4000, 10_000, 30_000, 120_000]) expect(travelFloorMs(maxTravel(ms))).toBeLessThanOrEqual(ms + 1e-6);
      expect(maxTravel(10_000)).toBeCloseTo(90 + 2 * 3, 6);
   });

   it("each level's floor is its beacon legs (climb or line, whichever is longer); level 5 adds the golem's least defeat time", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minFinishMs(c)).toBeGreaterThan(0);
         if (c.arena) expect(minFinishMs(c)).toBeGreaterThan(bossMinMs());
      }
      expect(bossMinMs()).toBeGreaterThan(15_000);
   });

   it("the least duration takes off the most orbs one hero can take and the most flow bonus; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(Math.max(0, minFinishMs(c) - maxOrbs(c) * ORB.bonusMs - comboMaxBonus(comboSpecOf(c))), 6);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(c));
         expect(lim.minDurationMs).toBeLessThanOrEqual(minDurationMsOf(c));
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(icePeakJumperMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(icePeakJumperMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [2400, 180000, 17760],
   [600, 210000, 20940],
   [1400, 240000, 23860],
   [2100, 270000, 26790],
   [17700, 360000, 34230],
];

describe("the guards (the proof's rules hold on every step)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 30 s of random input (every hero, ragged frames) never slides faster than allowed, never climbs faster than V_CLIMB_MAX on a rise, never travels further than maxTravel`, () => {
         for (const hero of HEROES) {
            const rng = createRng(id * 31 + hero.id.length);
            const run = createRun(1, id, hero.id);
            const input = createStepInput();
            const sx = run.hero.x;
            const sz = run.hero.z;
            let far = 0;
            let riseStart = -1;
            let riseY = 0;
            for (let f = 0; f < 1800 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = rng() * 6.28;
               input.jumpPressed = rng() < 0.12;
               input.actionPressed = rng() < 0.05;
               input.brake = rng() < 0.1;
               const y0 = run.hero.y;
               step(run, 5 + rng() * 40, input);
               const s = Math.hypot(run.hero.vx, run.hero.vz);
               expect(s).toBeLessThanOrEqual((run.ms <= run.dashUntil ? V_MAX : V_ICE) + 1e-6);
               expect(run.hero.vy).toBeLessThanOrEqual(V_JUMP + 1e-6);
               if (run.hero.y > y0 && run.hero.state === "play") {
                  if (riseStart < 0) {
                     riseStart = run.ms;
                     riseY = y0;
                  }
               } else riseStart = -1;
               far = Math.max(far, Math.hypot(run.hero.x - sx, run.hero.z - sz));
               expect(far).toBeLessThanOrEqual(maxTravel(run.ms) + 1e-6);
            }
            void riseY;
            expect(V_CLIMB_MAX).toBeCloseTo(V_JUMP / 2, 9);
         }
      });
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot (Zuno) wins at 30, 60 and 144 fps with every main orb, never under the floor`, () => {
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.mainOrbs).toBe(run.course.mainOrbs);
            expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
            expect(submitted(run)).toBeLessThan(LEVELS[level].starTargetMs);
         }
      }, 120_000);
   }

   it("idle never wins: the clock ends it unranked", () => {
      const run = createRun(1, 1);
      frames(run, (LEVELS[1].durationMs / 1000) * 60 + 30);
      expect(run.ended).toBe("timeup");
      expect(isRankedRun(icePeakJumperMeta.scoring, "timeup")).toBe(false);
   });

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1800 });
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
      const rules = icePeakJumperMeta.scoring;
      const sent = normalizeRun({ slug: "ice-peak-jumper", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
