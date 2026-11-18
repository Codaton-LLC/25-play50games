// Laser Maze Run's rules (README "Rules" and "Server limits and why they hold"): the vault's shape, the
// laser mechanics (beams, pulses, sweeps, gates and switches, barriers, live floors, checkpoints), the
// scoring hand-off, the proof's bound and its guards (never faster than the walk outside Riko's dash,
// random and spam players), and the honest bot through the real store.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { laserMazeRunMeta } from "./meta";
import { LEVELS } from "./levels";
import { DASH_X, HEROES, type HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { HALF, courseFor } from "./course";
import {
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPEED,
   STAT,
   STEP_MS,
   barrierX,
   bossMinMs,
   comboSpecOf,
   createRun,
   createStepInput,
   finalScore,
   laserOn,
   leastRunMs,
   maxOrbs,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   type LaserRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

export function botRun(level: LevelId, fps = 60, hero: HeroId = "vexa", routes = false): LaserRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms, routes);
   const input = createStepInput();
   for (let f = 0; f < 200_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: LaserRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: LaserRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

function place(run: LaserRun, x: number, s: number): void {
   run.runner.x = x;
   run.runner.s = s;
   run.zone = run.course.zones.findIndex((z) => s >= z.s0 && s < z.s1);
   run.cp = run.course.zones[run.zone].cp;
}

/** Walk forward (world +s) for n frames. */
const forward = (): StepInput => ({ ...createStepInput(), moveY: -1 });

describe("the vault (rooms, lasers, the hero routes)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the card's laser zones, a checkpoint per room, every laser inside the corridor, the secrets in place`, () => {
         const c = courseFor(id);
         expect(c.zones).toHaveLength(LEVELS[id].zones);
         for (const z of c.zones) expect(z.cp).toBeGreaterThan(z.s0);
         for (const l of c.lasers) {
            expect(l.x0).toBeGreaterThanOrEqual(-HALF);
            expect(l.x1).toBeLessThanOrEqual(HALF);
            expect(l.y1).toBeGreaterThan(l.y0);
         }
         for (const sw of c.switches) expect(Math.abs(sw.x)).toBeLessThan(HALF);
         expect(c.secrets.map((s) => s.id)).toEqual(SECRETS[id].map((s) => s.id));
         // the routes: a cage on every level; Nami's high orbs on 1, 2, 4, 5
         expect(c.lasers.some((l) => l.kind === "cage")).toBe(true);
         expect(c.orbs.some((o) => o.bonus === "floor")).toBe(true);
      });
   }

   it("the levels grow: static beams and a gate (1), pulses, sweeps and barriers (2), linked switches (3), decoys (4), the arena (5)", () => {
      expect(courseFor(1).lasers.every((l) => l.kind !== "pulse" && l.kind !== "sweep")).toBe(true);
      const c2 = courseFor(2);
      expect(c2.lasers.some((l) => l.kind === "pulse") && c2.lasers.some((l) => l.kind === "sweep") && c2.barriers.length > 0).toBe(true);
      expect(courseFor(3).switches.some((s) => s.on.length > 0)).toBe(true);
      expect(courseFor(4).switches.some((s) => s.decoy)).toBe(true);
      expect(courseFor(5).arena?.pylons).toHaveLength(3);
   });
});

describe("the laser mechanics", () => {
   it("a low beam is jumped; walked into it sends you back to the room's checkpoint pad, frozen", () => {
      const run = createRun(1, 1, "kiro");
      const beam = run.course.lasers[0];
      place(run, 0, beam.s - 0.6);
      frames(run, 20, forward());
      expect(run.hits).toBe(1);
      expect(run.runner.s).toBeLessThan(beam.s);
      const run2 = createRun(1, 1, "kiro");
      place(run2, 0, beam.s - 1.5);
      const jump = { ...forward(), jumpPressed: true };
      step(run2, 1000 / 60, jump);
      frames(run2, 40, forward());
      expect(run2.hits).toBe(0);
      expect(run2.runner.s).toBeGreaterThan(beam.s + 1);
   });

   it("a pulsing wall is only live while it is on", () => {
      const run = createRun(1, 2, "kiro");
      const i = run.course.lasers.findIndex((l) => l.kind === "pulse");
      const l = run.course.lasers[i];
      let on = 0;
      for (let ms = 0; ms < l.period; ms += 10) if (laserOn(run, i, ms)) on += 10;
      expect(on).toBeCloseTo(l.onMs, -1);
   });

   it("a switch drops its gate for a while; a linked switch turns the next gate on (level 3)", () => {
      const run = createRun(1, 1, "kiro");
      const sw = run.course.switches[0];
      const g = sw.off[0];
      expect(laserOn(run, g)).toBe(true);
      place(run, sw.x, sw.s);
      step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
      expect(laserOn(run, g)).toBe(false);
      expect(laserOn(run, g, run.ms + sw.ms + 50)).toBe(true);
      const r3 = createRun(1, 3, "kiro");
      const linked = r3.course.switches.find((s) => s.on.length > 0)!;
      expect(laserOn(r3, linked.on[0])).toBe(false);
      place(r3, linked.x, linked.s);
      step(r3, 1000 / 60, { ...createStepInput(), actionPressed: true });
      expect(laserOn(r3, linked.on[0])).toBe(true);
   });

   it("a barrier is solid: walking into it does not pass", () => {
      const run = createRun(1, 2, "kiro");
      const b = run.course.barriers[0];
      // stand where the barrier sits now and walk into it
      const cx = barrierX(run, 0);
      place(run, Math.max(-HALF + 0.5, Math.min(HALF - 0.5, cx)), b.s - 1);
      for (let k = 0; k < 10; k++) {
         run.runner.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, barrierX(run, 0)));
         step(run, 1000 / 60, forward());
      }
      expect(run.runner.s).toBeLessThan(b.s);
   });

   it("a live floor tile is a hit on the ground", () => {
      const run = createRun(1, 1, "riko");
      const f = run.course.floors[0];
      place(run, (f.x0 + f.x1) / 2, f.s0 + 0.5);
      frames(run, 2);
      expect(run.hits).toBe(1);
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
   it("the floor is the corridor at the walk with Riko's dash allowance; level 5 adds the Vault Core's least defeat time", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         if (!c.arena) expect(minFinishMs(c)).toBeCloseTo(leastRunMs(c.finishS) - STEP_MS, 6);
         else expect(minFinishMs(c)).toBeGreaterThan(bossMinMs());
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
         expect(laserMazeRunMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(laserMazeRunMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [5700, 75000, 6930],
   [7100, 90000, 8290],
   [8800, 105000, 9620],
   [10500, 120000, 10950],
   [34100, 150000, 11590],
];

describe("the speed guard (the proof's one rule)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 30 s of random input (every hero, ragged frames) never gets further than the fastest pace allows`, () => {
         for (const hero of HEROES) {
            const rng = createRng(id * 17 + hero.id.length);
            const run = createRun(1, id, hero.id);
            const input = createStepInput();
            let far = 0;
            for (let f = 0; f < 1500 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveY = -rng() * 1.2 + 0.2;
               input.yaw = (rng() - 0.5) * 0.6;
               input.jumpPressed = rng() < 0.08;
               input.actionPressed = rng() < 0.05;
               const s0 = run.runner.s;
               const ms0 = run.ms;
               step(run, 5 + rng() * 40, input);
               if (run.runner.s >= s0) expect(run.runner.s - s0).toBeLessThanOrEqual((SPEED * DASH_X * (run.ms - ms0)) / 1000 + 1e-6);
               far = Math.max(far, run.runner.s);
               expect(run.ms + STEP_MS).toBeGreaterThanOrEqual(leastRunMs(far));
            }
         }
      });
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps with every main orb, never zapped, never under the floor, at least 80 % of maxScore`, () => {
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.mainOrbs).toBe(run.course.mainOrbs);
            expect(run.hits).toBe(0);
            const lim = PROPOSED_LEVEL_LIMITS[level];
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(Math.floor((lim.timeBaseMs - submitted(run)) / 10)).toBeGreaterThanOrEqual(lim.maxScore * 0.8);
         }
      }, 120_000);
   }

   it("every hero's bot with its own route wins every level, never under the floor; Vexa takes the cage shard, Nami the high sticker", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = botRun(level, 60, h.id, true);
            expect(run.ended, `L${level} ${h.id}`).toBe("win");
            expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
            const ids = SECRETS[level].map((s) => s.id);
            if (h.id === "vexa") expect(run.secrets.found[ids.indexOf("cage")], `L${level}`).toBe(1);
            if (h.id === "nami" && ids.includes("high")) expect(run.secrets.found[ids.indexOf("high")], `L${level}`).toBe(1);
         }
      }
   }, 240_000);

   it("idle never finishes (a time-up is unranked)", () => {
      const run = createRun(1, 1);
      frames(run, 60 * 80);
      expect(run.ended).toBe("timeup");
      expect(isRankedRun(laserMazeRunMeta.scoring, "timeup")).toBe(false);
   });

   it("60 spam runs (random moves, jumps, presses, powers, frame times, any hero) never beat the floor", () => {
      for (let k = 0; k < 60; k++) {
         const level = LEVEL_IDS[k % 5];
         const rng = createRng(1000 + k);
         const run = createRun(k, level, HEROES[k % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 12_000 && run.ended === null; f++) {
            input.moveX = rng() * 2 - 1;
            input.moveY = -rng();
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
         const bot = createBot(run, 1000 / 60, false);
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
         const rules = laserMazeRunMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "laser-maze-run", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 120_000);
   }
});
