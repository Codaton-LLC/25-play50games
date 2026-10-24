// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's
// game, monotone difficulty, the limit proof per level, the same timing for touch and keyboard,
// and the bots. Level 1's 160-run witness and the 80-run oracle stay in rules.test.ts, untouched.
// The sweeps here run on the pure rules loop; one seed per level also goes through the real store.
import { describe, expect, it, vi } from "vitest";
import { isLevelCleared, definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { idleInput, oracle, spammerInput, witness } from "./bots";
import { LEVELS } from "./levels";
import { snowballBattleMeta as meta } from "./meta";
import definition from "./index";
import {
   AI,
   EARLIEST,
   FORT,
   KID,
   PROPOSED_LEVEL_LIMITS,
   PROPOSED_LIMITS,
   SCORE,
   THROW,
   createRun,
   earliestClearS,
   earliestRows,
   flightTime,
   lossChainS,
   stepRun,
   type Run,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const rateAllows = (score: number, t: number, id: LevelId) => {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const ms = Math.round(t * 1000);
   return score * 1000 <= limits.base! * 1000 + limits.maxPointsPerSec! * ms;
};

describe("snowball-battle levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].kind).toBe("points");
         expect(PROPOSED_LEVEL_LIMITS[id].unitLabel).toBe("pts");
         expect(PROPOSED_LEVEL_LIMITS[id].display).toBe("int");
      }
   });

   it("level 1 is today's game: same rivals, same clock, same yard, same start card", () => {
      const l1 = LEVELS[1];
      expect(l1.speed).toBe(KID.speed);
      expect([...l1.dodgeAt]).toEqual([...AI.dodgeAt]);
      expect(l1.windup).toBe(AI.windup);
      expect(l1.slotAt).toBe(AI.slotAt);
      expect(l1.sneakerAt).toBe(AI.sneakerAt);
      expect(l1.distFar).toBe(THROW.distFar);
      expect(l1.flightFar).toBe(THROW.flightFar);
      expect(l1.fortHp).toBe(FORT.hp);
      expect(l1.duration).toBe(SCORE.duration);
      expect(lossChainS(l1)).toBeCloseTo(10.65, 10);
      expect(earliestClearS(l1)).toBeCloseTo(10.9, 10);
      expect(earliestRows(l1)).toBe(EARLIEST);
      const named = createRun(7, false, l1);
      const today = createRun(7, false);
      expect(named.forts).toEqual(today.forts);
      expect(named.pines).toEqual(today.pines);
      expect(named.kids.map((kid) => [kid.x, kid.z, kid.state, kid.ammo, kid.present])).toEqual(
         today.kids.map((kid) => [kid.x, kid.z, kid.state, kid.ammo, kid.present]),
      );
      const input: StepInput = { moveX: 0.4, moveY: -0.2, camYaw: 0, scoop: true, fire: false, tapId: -1, aimYaw: Math.PI };
      for (let n = 0; n < 40; n++) {
         stepRun(named, 1 / 60, input);
         stepRun(today, 1 / 60, input);
      }
      expect(named.time).toBeCloseTo(today.time, 9);
      expect(named.score).toBe(today.score);
      expect(named.kids[1].state).toBe(today.kids[1].state);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(definition.environment).toEqual({ background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" });
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: 1200 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   });

   it("keeps the snow look, the same chips and the same instructions on every level", () => {
      for (const id of LEVEL_IDS) {
         expect(levelEnvironment(definition, id)).toEqual(definition.environment);
         expect(levelInstructions(definition, id)).toBe(definition.instructions);
         expect(levelHudStats(definition, id)).toEqual([
            { key: "time", label: "Time" },
            { key: "ammo", label: "Ammo" },
            { key: "rivals", label: "Rivals" },
         ]);
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(LEVELS[id].duration).toBe(90);
      }
   });
});

describe("snowball-battle levels: difficulty", () => {
   it("is monotone: speed, dodge, wind-up, slot, sneaker and fort HP never get easier, and each level adds pressure", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.speed).toBeLessThanOrEqual(a.speed);
         expect(b.dodgeAt[0]).toBeLessThanOrEqual(a.dodgeAt[0]);
         expect(b.dodgeAt[1]).toBeLessThanOrEqual(a.dodgeAt[1]);
         expect(b.dodgeAt[2]).toBeLessThanOrEqual(a.dodgeAt[2]);
         expect(b.windup).toBeLessThanOrEqual(a.windup);
         expect(b.slotAt).toBeLessThanOrEqual(a.slotAt);
         expect(b.sneakerAt).toBeLessThanOrEqual(a.sneakerAt);
         expect(b.distFar).toBeGreaterThanOrEqual(a.distFar);
         expect(b.flightFar).toBeGreaterThanOrEqual(a.flightFar);
         expect(b.fortHp).toBeLessThanOrEqual(a.fortHp);
         const harder = b.speed < a.speed || b.dodgeAt[0] < a.dodgeAt[0] || b.dodgeAt[1] < a.dodgeAt[1]
            || b.dodgeAt[2] < a.dodgeAt[2] || b.windup < a.windup || b.slotAt < a.slotAt
            || b.sneakerAt < a.sneakerAt || b.distFar > a.distFar || b.flightFar > a.flightFar
            || b.fortHp < a.fortHp;
         expect(harder).toBe(true);
      }
      expect(LEVELS[2].speed).toBe(4);
      expect([...LEVELS[2].dodgeAt]).toEqual([0.3, 0.25, 0.2]);
      expect(LEVELS[2].distFar).toBe(18);
      expect(LEVELS[2].flightFar).toBe(0.95);
      expect(LEVELS[3].slotAt).toBe(30);
      expect(LEVELS[3].sneakerAt).toBe(8);
      expect(LEVELS[4].windup).toBe(1);
      expect([...LEVELS[4].dodgeAt]).toEqual([0.25, 0.2, 0.15]);
      expect(LEVELS[4].fortHp).toBe(2);
      expect(LEVELS[5].slotAt).toBe(0);
      expect(LEVELS[5].sneakerAt).toBe(5);
      expect([...LEVELS[5].dodgeAt]).toEqual([0.2, 0.17, 0.14]);
   });

   it("keeps the near-field flight line when the far cap moves out", () => {
      for (const d of [0, 6, 8, 10, 12, 14]) {
         expect(flightTime(d, LEVELS[2])).toBeCloseTo(flightTime(d, LEVELS[1]), 12);
      }
      expect(flightTime(6, LEVELS[5])).toBe(THROW.flightNear);
      expect(flightTime(18, LEVELS[2])).toBe(0.95);
      expect(flightTime(16, LEVELS[2])).toBeCloseTo(0.9, 10);
   });

   it("level 4 forts start on 2 HP in the same places as level 1", () => {
      const easy = createRun(4, false, LEVELS[1]);
      const hard = createRun(4, false, LEVELS[4]);
      expect(hard.forts.map((fort) => [fort.x, fort.z])).toEqual(easy.forts.map((fort) => [fort.x, fort.z]));
      expect(hard.forts.every((fort) => fort.hp === 2)).toBe(true);
      expect(easy.forts.every((fort) => fort.hp === 3)).toBe(true);
   });
});

describe("snowball-battle levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B(t) fits base + pps, and the duration window sits under the clear and the loss`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const rows = earliestRows(level);
      const clear = earliestClearS(level);
      const loss = lossChainS(level);
      expect(rows[rows.length - 1].t).toBeCloseTo(clear, 10);
      expect(rows[rows.length - 1].score).toBe(2550);
      expect(limits.maxScore).toBe(2550);
      expect(limits.base).toBe(600);
      expect(limits.maxDurationMs).toBe(92000);
      for (const row of rows) {
         expect(rateAllows(row.score, row.t, id)).toBe(true);
         expect(row.score).toBeLessThanOrEqual(limits.maxScore);
      }
      expect(withinServerLimits(2550, Math.round(clear * 1000), limits)).toBe(true);
      expect(capScore(2550, Math.round(clear * 1000), limits)).toBe(2550);
      // one full sneaker cycle early (level 1's 10.00 s); levels 3-5 also reject one stagger early
      const forged = level.sneakerAt === 10 ? level.sneakerAt : clear - AI.stagger;
      expect(withinServerLimits(2550, Math.round(forged * 1000), limits)).toBe(false);
      const fastest = Math.min(clear, loss);
      expect(limits.minDurationMs).toBeLessThanOrEqual(fastest * 1000 - 500);
      expect(limits.minDurationMs).toBeGreaterThan(fastest * 1000 - 1500);
      expect(withinServerLimits(0, Math.round(loss * 1000), limits)).toBe(true);
      expect(withinServerLimits(0, limits.minDurationMs - 1, limits)).toBe(false);
      expect(level.duration * 1000 + 2000).toBe(limits.maxDurationMs);
   });

   it("pins the chains that the limits are built on", () => {
      expect(lossChainS(LEVELS[1])).toBeCloseTo(10.65, 10);
      expect(lossChainS(LEVELS[3])).toBeCloseTo(10.65, 10);
      expect(lossChainS(LEVELS[4])).toBeCloseTo(9.65, 10);
      expect(lossChainS(LEVELS[5])).toBeCloseTo(6.25, 10);
      expect(earliestClearS(LEVELS[1])).toBeCloseTo(10.9, 10);
      expect(earliestClearS(LEVELS[3])).toBeCloseTo(8.9, 10);
      expect(earliestClearS(LEVELS[5])).toBeCloseTo(5.9, 10);
      expect(PROPOSED_LEVEL_LIMITS[1]).toBe(PROPOSED_LIMITS);
      expect(PROPOSED_LEVEL_LIMITS[2]).toBe(PROPOSED_LIMITS);
      expect(PROPOSED_LEVEL_LIMITS[3].maxPointsPerSec).toBe(230);
      expect(PROPOSED_LEVEL_LIMITS[3].minDurationMs).toBe(8000);
      expect(PROPOSED_LEVEL_LIMITS[5].maxPointsPerSec).toBe(348);
      expect(PROPOSED_LEVEL_LIMITS[5].minDurationMs).toBe(5000);
   });
});

describe("snowball-battle levels: the same timing on touch and keyboard", () => {
   for (const id of LEVEL_IDS) it(`L${id}: a coarse pointer does not change the clock, the dodge or the wind-up`, () => {
      const fine = createRun(11, false, LEVELS[id]);
      const touch = createRun(11, true, LEVELS[id]);
      const input: StepInput = { moveX: 1, moveY: 0, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: Math.PI };
      for (let n = 0; n < 90; n++) {
         stepRun(fine, 1 / 60, input);
         stepRun(touch, 1 / 60, input);
      }
      expect(touch.time).toBeCloseTo(fine.time, 9);
      expect(touch.kids.map((kid) => [kid.x, kid.z, kid.state, kid.timer, kid.tags])).toEqual(
         fine.kids.map((kid) => [kid.x, kid.z, kid.state, kid.timer, kid.tags]),
      );
      expect(touch.playerTags).toBe(fine.playerTags);
      expect(touch.score).toBe(fine.score);
   });
});

function play(seed: number, coarse: boolean, brain: (run: Run) => StepInput, id: LevelId, dt = 1 / 60): Run {
   const level = LEVELS[id];
   const run = createRun(seed, coarse, level);
   while (!run.endReason) {
      stepRun(run, dt, brain(run));
      if (run.time > level.duration + 1) break;
   }
   return run;
}

function legal(run: Run, id: LevelId): void {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const ms = Math.round(run.time * 1000);
   expect(withinServerLimits(run.score, ms, limits)).toBe(true);
   expect(capScore(run.score, ms, limits)).toBe(run.score);
}

const WITNESS_SEEDS = 200;

describe("snowball-battle levels: bots", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the witness wins at least 90% of ${WITNESS_SEEDS} seeds on keyboard and on touch`, () => {
         let wins = 0;
         let runs = 0;
         const lost: string[] = [];
         for (let seed = 1; seed <= WITNESS_SEEDS; seed++) {
            for (const coarse of [false, true]) {
               const run = play(seed, coarse, witness(coarse), id);
               legal(run, id);
               runs += 1;
               const health = SCORE.healthMax - run.playerTags;
               const cleared = isLevelCleared(run.endReason, run.score, meta.levels![id - 1]);
               if (cleared && run.time <= 85 && health >= 1) wins += 1;
               else lost.push(`${seed}${coarse ? "t" : "k"}:${run.endReason}@${run.time.toFixed(1)} hp${health} s${run.score}`);
            }
         }
         expect(wins / runs, `${wins}/${runs} ${lost.slice(0, 6).join(" ")}`).toBeGreaterThanOrEqual(0.9);
      }, 120000);

      it(`L${id}: oracle reaches 90% of the cap; idle never clears; spam stays inside the line`, () => {
         let best = 0;
         for (let seed = 1; seed <= 20; seed++) {
            const run = play(seed, false, oracle(), id);
            legal(run, id);
            best = Math.max(best, run.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * PROPOSED_LEVEL_LIMITS[id].maxScore);
         for (let seed = 1; seed <= 3; seed++) {
            const run = play(seed, false, idleInput, id);
            legal(run, id);
            expect(run.score).toBe(0);
            expect(isLevelCleared(run.endReason, run.score, meta.levels![id - 1])).toBe(false);
         }
         for (let seed = 1; seed <= 2; seed++) {
            const run = play(seed, false, spammerInput, id);
            legal(run, id);
            expect(run.score).toBeLessThan(1800);
            expect(run.endReason).not.toBe("win");
         }
         for (const hz of [30, 60, 144]) {
            legal(play(1, false, oracle(), id, 1 / hz), id);
            legal(play(1, false, spammerInput, id, 1 / hz), id);
            legal(play(1, false, idleInput, id, 1 / hz), id);
         }
      }, 180000);

      it(`L${id}: one oracle and one idle run through the real store`, () => {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (const brain of [oracle(), idleInput]) {
            const store = createArcadeStore();
            const run = createRun(1, false, LEVELS[id]);
            simulateRun(store, {
               frame: fixedFrames(1000 / 60),
               step: (dt) => {
                  stepRun(run, dt, brain(run));
                  const state = store.getState();
                  if (run.scoreDelta) state.addScore(run.scoreDelta);
                  if (run.endReason) {
                     state.setScore(run.score);
                     state.end(run.endReason);
                  }
               },
            });
            const state = store.getState();
            expect(withinServerLimits(state.score, state.elapsedMs, limits)).toBe(true);
            expect(capScore(state.score, state.elapsedMs, limits)).toBe(state.score);
         }
      }, 60000);
   }
});
