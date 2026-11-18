// The score limits per level (README "Scoring and the proof"): the bot through the real store submits a
// ranked run inside the level's row; the travel bound (no ball faster than V_MAX, bar the respawn on the
// plunger) holds every step under spam with random camera yaws, frame times and powers; idle and a lost
// table are unranked; the pinned rows are proposeLimits. Every hero's bot win is bots.test.ts.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES } from "./heroes";
import { LEVELS } from "./levels";
import { plateBounceArenaMeta } from "./meta";
import {
   PROPOSED_LEVEL_LIMITS, STAT, V_MAX, bossMinMs, chainFloorM, courseFor, createRun, createStepInput, finalScore, minDurationMsOf, proposeLimits, runTimeMs, step,
   travelFloorMs, type PinRun,
} from "./rules";

const submitted = (run: PinRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

describe("through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: a ragged-frame bot run is a ranked win inside the level's row, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[level].durationMs, resultDelayMs: 1400 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level, HEROES[level % 5].id);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(17 + level);
         for (let f = 0; f < 200_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.finished) {
               store.getState().setStat(STAT.orbs, run.orbs);
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            } else if (ev.gameOver) store.getState().end("lose");
            else if (ev.timeup) store.getState().end("timeup");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(run.simMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         const fin = finalScore(s);
         const rules = plateBounceArenaMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "plate-bounce-arena", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBe(submitted(run));
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 300_000);
   }

   it("idle never wins and a lost table is unranked", () => {
      for (const level of LEVEL_IDS) {
         const run = createRun(1, level);
         const none = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
         expect(isRankedRun(plateBounceArenaMeta.levels![level - 1].scoring, "timeup")).toBe(false);
      }
      expect(isRankedRun(plateBounceArenaMeta.levels![0].scoring, "lose")).toBe(false);
   });
});

describe("the travel bound", () => {
   it("between two steps the ball moves at most V_MAX x the rules time, unless it was put back on the plunger", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 6; seed++) {
            const rng = createRng(seed * 53 + level);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 4000 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = (rng() - 0.5) * Math.PI * 2;
               input.left = rng() < 0.4;
               input.right = rng() < 0.4;
               input.jumpHeld = run.ball.mode === "plunger" ? rng() < 0.85 : rng() < 0.2;
               input.jumpPressed = rng() < 0.1;
               input.actionPressed = rng() < 0.1;
               input.actionHeld = rng() < 0.5;
               const x0 = run.ball.x;
               const z0 = run.ball.z;
               const t0 = run.simMs;
               const ev = step(run, 1 + rng() * 49, input);
               if (ev.respawned) continue;
               const d = Math.hypot(run.ball.x - x0, run.ball.z - z0);
               expect(d).toBeLessThanOrEqual((V_MAX * (run.simMs - t0)) / 1000 + 1e-9);
            }
         }
      }
   }, 120_000);
});

describe("the limits read this level", () => {
   it("the pinned rows are proposeLimits, distinct per level, in meta's order; the boss floor counts on level 5", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(plateBounceArenaMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(minDurationMsOf(courseFor(id)));
         if (id < 5) expect(chainFloorM(courseFor(id))).toBeGreaterThan(40);
      }
      expect(bossMinMs()).toBeGreaterThan(15_000);
      expect(minDurationMsOf(courseFor(5))).toBeGreaterThan(bossMinMs() - 4000);
      expect(travelFloorMs(courseFor(5))).toBe(0);
   });

   it("the travel floor counts the ramp's whole length for every ramp shot a section needs", () => {
      const t = courseFor(4);
      const r = t.ramps[0];
      expect(chainFloorM(t)).toBeGreaterThan(2 * r.length);
   });
});
