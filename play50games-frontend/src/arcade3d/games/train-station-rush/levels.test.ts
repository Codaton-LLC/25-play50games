// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = the spec's base game,
// monotone difficulty, the clear rate of an honest human-paced bot, and mutation probes showing every
// level knob reaches the simulation.
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { playBot } from "./bots.testing";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES, passengerCount, type StationLevel } from "./levels";
import { trainStationRushMeta as meta } from "./meta";
import {
   CROWD_RADIUS,
   PROPOSED_LEVEL_LIMITS,
   RADIUS,
   SPOTS,
   createRun,
   earliestWinS,
   idleInput,
   padPoint,
   standable,
   step,
   targetAt,
   trainIn,
   type Run,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const openOf = (run: Run) => run.tasks.map((t, i) => (t.state === "open" || t.state === "taken" ? i : -1)).filter((i) => i >= 0);

describe("station levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(meta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
      }
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta).toMatchObject({ slug: "train-station-rush", status: "dev", owner: "claude", order: 44, collection: "skill", difficulty: 2 });
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Use" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
   });

   it("level 1 is the spec's base game: 2 platforms, 4 bags, one task at a time, 120 s, day", () => {
      expect(LEVELS[1]).toEqual({ platforms: 2, tasks: 4, passengerShare: 0, parallel: 1, arriveS: 4, dwellS: 22, crowd: 0, durationMs: 120_000, lighting: "day", background: "#bae6fd" });
      expect(levelRunConfig(definition, 1).durationMs).toBe(120_000);
      expect(levelEnvironment(definition, 1)?.lighting).toBe("day");
      expect(levelHudStats(definition, 1)).toEqual([{ key: "delivered", label: "Delivered", max: 4 }]);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
   });

   it("each level's clock, HUD max, light and instructions come from its config", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelHudStats(definition, id)?.find((s) => s.key === "delivered")?.max).toBe(level.tasks);
         if (passengerCount(level) > 0) expect(levelInstructions(definition, id).some((line) => line.toLowerCase().includes("passenger"))).toBe(true);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["day", "day", "indoor", "sunset", "night"]);
   });
});

describe("station levels: difficulty and points", () => {
   it("is monotone: platforms, tasks, passengers, parallel tasks and the crowd never drop; less clock per task every level", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.platforms).toBeGreaterThanOrEqual(a.platforms);
         expect(b.tasks).toBeGreaterThan(a.tasks);
         expect(b.passengerShare).toBeGreaterThanOrEqual(a.passengerShare);
         expect(b.parallel).toBeGreaterThanOrEqual(a.parallel);
         expect(b.crowd).toBeGreaterThanOrEqual(a.crowd);
         expect(b.arriveS).toBeLessThanOrEqual(a.arriveS);
         expect(b.durationMs / b.tasks).toBeLessThan(a.durationMs / a.tasks);
         expect(earliestWinS(b)).toBeGreaterThanOrEqual(earliestWinS(a));
      }
   });

   it("every level offers at least level 1's points, and level 5 at most 3x level 1", () => {
      for (const id of LEVEL_IDS.slice(1)) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   for (const id of LEVEL_IDS) {
      it(`L${id}: an honest human-paced bot clears it on >= 99 % of 200 seeds (60 Hz), inside the limits; idle never clears`, () => {
         const level = LEVELS[id];
         let wins = 0;
         for (let seed = 0; seed < 200; seed++) {
            const r = playBot(level, (seed * 40503 + 17) >>> 0, 60, "honest");
            if (r.won) wins += 1;
            expect(withinServerLimits(r.score, r.ms, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
         }
         expect(wins / 200).toBeGreaterThanOrEqual(0.99);
         for (let seed = 0; seed < 5; seed++) {
            const idle = playBot(level, seed, 30, "idle");
            expect(idle.won).toBe(false);
            expect(idle.score).toBe(0);
         }
      });
   }
});

describe("station levels: the simulation reads every level knob (mutation probes)", () => {
   const with_ = (id: LevelId, patch: Partial<StationLevel>): StationLevel => ({ ...LEVELS[id], ...patch });

   it("platforms: the pads Use reaches and the platforms on the tasks", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(1, level);
         const last = padPoint(level, level.platforms - 1);
         expect(targetAt(run, last.x, last.z - 0.5)).toEqual({ kind: "pad", platform: level.platforms - 1 });
         const more = createRun(1, with_(id, { platforms: level.platforms + 2 }));
         const extra = padPoint(more.level, level.platforms + 1);
         expect(targetAt(more, extra.x, extra.z - 0.5)).toEqual({ kind: "pad", platform: level.platforms + 1 });
         const used = new Set<number>();
         for (let seed = 0; seed < 30; seed++) for (const t of createRun(seed, level).tasks) used.add(t.platform);
         expect(used.size).toBe(level.platforms);
      }
   });

   it("tasks, passengerShare, parallel: the queue, the passengers and the tasks open at once", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(createRun(2, with_(id, { tasks: level.tasks + 3 })).tasks).toHaveLength(level.tasks + 3);
         expect(createRun(2, with_(id, { passengerShare: 1 })).tasks.every((t) => t.kind === "passenger")).toBe(true);
         expect(createRun(2, with_(id, { passengerShare: 0 })).tasks.every((t) => t.kind === "bag")).toBe(true);
         expect(openOf(createRun(2, with_(id, { parallel: 1 })))).toHaveLength(1);
         expect(openOf(createRun(2, with_(id, { parallel: 2 })))).toHaveLength(2);
         expect(openOf(createRun(2, level))).toHaveLength(level.parallel);
         expect(SPOTS[level.parallel]).toHaveLength(level.parallel);
      }
   });

   it("arriveS and dwellS: when the train is in, and when an untouched task is missed", () => {
      for (const id of LEVEL_IDS) {
         for (const [arriveS, dwellS] of [[LEVELS[id].arriveS, LEVELS[id].dwellS], [6, 9]]) {
            const run = createRun(3, with_(id, { arriveS, dwellS, crowd: 0 }));
            const i = openOf(run)[0];
            const task = run.tasks[i];
            expect(trainIn(task, arriveS - 0.01)).toBe(false);
            expect(trainIn(task, arriveS + 0.01)).toBe(true);
            const input = idleInput();
            // two open tasks can leave in the same frame (ev.missed names one): read the task itself,
            // and stop once the run is over (step no longer advances time then)
            while (task.state !== "missed" && !run.over && run.time < 60) step(run, input, 1 / 60, 100_000);
            expect(task.state).toBe("missed");
            const missedAt = task.doneAt;
            expect(missedAt).toBeGreaterThanOrEqual(arriveS + dwellS - 1e-9);
            expect(missedAt).toBeLessThan(arriveS + dwellS + 1 / 60 + 1e-9);
         }
      }
   });

   it("crowd: that many solid travellers on the concourse; the worker cannot stand in one", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(4, level);
         expect(run.crowd).toHaveLength(level.crowd);
         for (const a of run.crowd) {
            expect(standable(run, a.x, a.z, RADIUS)).toBe(false);
            expect(standable(run, a.x, a.z, CROWD_RADIUS, false)).toBe(true);
            expect(a.z).toBeGreaterThan(CROWD_RADIUS);
         }
         expect(createRun(4, with_(id, { crowd: level.crowd + 3 })).crowd).toHaveLength(level.crowd + 3);
      }
   });

   it("durationMs: an idle run with a long dwell ends at the level's clock (time-up)", () => {
      for (const id of LEVEL_IDS) {
         const r = playBot(with_(id, { durationMs: 20_000, dwellS: 100 }), 1, 30, "idle");
         expect(r.reason).toBe("timeup");
         expect(r.ms).toBeCloseTo(20_000, -2);
      }
   });
});
