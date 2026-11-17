// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game
// (replayed against today's createRun), monotone difficulty, every level setting reaching the
// simulation (on level 1's map, so the staged poses mean the same), each level's own map and twist
// (jeeps, birds, crowds, night searchlights), the limit proof per level and the bots through the
// real store. Each map's fairness proof is fairness.level-N.test.ts (level 1: fairness.test.ts).
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, isLevelCleared, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { MAP_1, type StageIndex } from "./level";
import { LEVELS, type ZooLevel } from "./levels";
import { zooEscapeMeta as meta } from "./meta";
import {
   BIRDS, CATCH, CLOCK, KEEPER, PANDA, PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, SCORE, SEARCHLIGHT, SNACK, SUSPICION, TOSS, applyToStore, createRun, investigateFor, jeepBox, jeepPose,
   searchlightSees, searchlightYaw, seedLayout, sendKeeper, stepRun, type RunState, type StepInput,
} from "./rules";
import { followPlan, oraclePlan, stageRouteBound } from "./testkit";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const DT = 1 / 60;
const STILL: StepInput = { dirX: 0, dirZ: 0, sneak: false, toss: false };
const levelMeta = (id: LevelId) => meta.levels![id - 1];
const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const steps = (run: RunState, n: number, input = STILL) => { for (let i = 0; i < n && !run.over; i++) stepRun(run, input, DT); };
const snapshot = (run: RunState) => JSON.stringify({ ...run, level: undefined, keepers: run.keepers.map((k) => ({ ...k, inv: undefined })) });

/** A level's settings on level 1's map (the staged poses below are level 1's geometry). */
const onMap1 = (level: ZooLevel): ZooLevel => ({ ...level, map: MAP_1 });

/** rules.test.ts's staring keeper, on a level: keeper 0 investigates a point and stares at the panda. */
function staring(level: ZooLevel): RunState {
   const run = createRun(7, undefined, onMap1(level));
   run.grace = 0;
   run.panda.x = 2; run.panda.z = 15;
   const k = run.keepers[0];
   k.agent.x = 2; k.agent.z = 8.5; k.agent.yaw = 0;
   sendKeeper(k, { x: 2, z: 13.5 }, "heard");
   return run;
}

/** rules.test.ts's oracle (earliest-arrival grid plan, all 12 snacks) through the real store, on a level. */
function oracleRun(seed: number, level: ZooLevel, frame: () => number) {
   const map = level.map;
   const L = seedLayout(seed, map);
   const plan = oraclePlan(L.offsets, 0, map.stages[0].start.x, map.stages[0].start.z, 0, L.snacks.map((ps, s) => ps.map((i) => map.snacks[s][i])), true, map)!;
   expect(plan, `oracle plan seed ${seed}`).not.toBeNull();
   return play(seed, level, frame, (run, input, dt) => { followPlan(plan, run.panda.x, run.panda.z, run.time + dt, input); });
}

function play(seed: number, level: ZooLevel, frame: () => number, brain: (run: RunState, input: StepInput, dt: number) => void) {
   const run = createRun(seed, undefined, level);
   const input: StepInput = { ...STILL };
   const shown = { time: -1, bamboo: -1 };
   const end = simulateRun(createArcadeStore(), { frame, step: (dt, _t, store) => { brain(run, input, dt); stepRun(run, input, dt); applyToStore(run, store.getState(), shown); } });
   return { end, run };
}

describe("zoo-escape levels: declarations", () => {
   it("declares five levels in meta and definition; every level serves today's block and is proven by PROPOSED_LIMITS", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(meta.scoring);
         expect(PROPOSED_LEVEL_LIMITS[id]).toBe(PROPOSED_LIMITS);
         // the sum board: every level offers level 1's points; level 5 stays under 3x
         expect(scoringFor(meta, id).maxScore).toBe(scoringFor(meta, 1).maxScore);
      }
      expect([1, 2, 3, 4].map((id) => levelMeta(id as LevelId).clearScore)).toEqual([1500, 1600, 1700, 1800]);
      expect(levelMeta(5).clearScore).toBeUndefined();
   });

   it("level 1 is today's game: same catch time, decay, investigate speed, bundles, penalty, and a replayed run", () => {
      expect(LEVELS[1]).toEqual({ catchS: SUSPICION.catchS, decay: SUSPICION.decay, investigate: KEEPER.investigateSpeed, bundles: TOSS.perStage, penalty: CATCH.penalty, map: MAP_1 });
      for (let seed = 1; seed <= 8; seed++) {
         const today = createRun(seed);
         const named = createRun(seed, undefined, LEVELS[1]);
         expect(named.keepers[0].inv).toBe(today.keepers[0].inv);
         const rng = createRng(seed + 40);
         const input: StepInput = { ...STILL };
         for (let n = 0; n < 60 * 120 && !today.over; n++) {
            if (rng() < 0.03) { input.dirX = rng() * 2 - 1; input.dirZ = rng() * 2 - 1.4; input.sneak = rng() < 0.4; }
            input.toss = rng() < 0.01;
            stepRun(today, input, DT);
            stepRun(named, input, DT);
         }
         expect(snapshot(named)).toBe(snapshot(today));
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: 1500 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   });

   it("each level's chips and instructions show its own bundles and catch penalty", () => {
      for (const id of LEVEL_IDS) {
         const bamboo = (levelHudStats(definition, id) ?? []).find((s) => s.label === "Bamboo")!;
         expect(bamboo.max).toBe(LEVELS[id].bundles);
         expect(levelInstructions(definition, id).join(" ")).toContain(`-${LEVELS[id].penalty} s`);
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
      }
   });
});

describe("zoo-escape levels: difficulty", () => {
   it("is monotone: quicker catches, slower decay, faster keepers, fewer bundles, dearer catches", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.catchS).toBeLessThan(a.catchS);
         expect(b.decay).toBeLessThan(a.decay);
         expect(b.investigate).toBeGreaterThan(a.investigate);
         expect(b.bundles).toBeLessThanOrEqual(a.bundles);
         expect(b.penalty).toBeGreaterThan(a.penalty);
         expect(levelMeta(id).clearScore ?? Infinity).toBeGreaterThan(levelMeta((id - 1) as LevelId).clearScore!);
      }
      for (const id of LEVEL_IDS) {
         expect(LEVELS[id].bundles).toBeGreaterThanOrEqual(1);
         expect(LEVELS[id].bundles).toBeLessThanOrEqual(TOSS.perStage);
      }
   });
});

describe("zoo-escape levels: the simulation reads the level", () => {
   it("a stare catches after the level's catch time", () => {
      for (const id of [1, 3, 5] as const) {
         const run = staring(LEVELS[id]);
         let t = 0;
         while (!run.events.caught && t < 3) { stepRun(run, STILL, DT); t += DT; }
         expect(run.events.caught, `L${id}`).toBe("seen");
         expect(t).toBeGreaterThanOrEqual(LEVELS[id].catchS - 1e-9);
         expect(t).toBeLessThan(LEVELS[id].catchS + 2 * DT);
      }
   });

   it("the meter decays at the level's rate, and the keeper investigates at the level's speed", () => {
      for (const id of [1, 4] as const) {
         const run = staring(LEVELS[id]);
         steps(run, 36);
         const k = run.keepers[0];
         run.panda.x = 3; run.panda.z = 15.6; // into the bush
         steps(run, 1);
         const m = k.meter;
         const x = k.agent.x, z = k.agent.z;
         steps(run, 30);
         expect(k.meter, `L${id}`).toBeCloseTo(m - LEVELS[id].decay * 0.5, 6);
         expect(k.inv.seen.speed).toBe(LEVELS[id].investigate);
         // walking to the last seen point: never faster than the level's speed
         const moved = Math.hypot(k.agent.x - x, k.agent.z - z);
         expect(moved).toBeLessThanOrEqual(LEVELS[id].investigate * 0.5 + 1e-9);
      }
      const slow = staring(LEVELS[1]);
      const fast = staring(LEVELS[5]);
      steps(slow, 30); steps(fast, 30);
      slow.panda.x = fast.panda.x = 3; slow.panda.z = fast.panda.z = 15.6;
      const s0 = { x: slow.keepers[0].agent.x, z: slow.keepers[0].agent.z };
      const f0 = { x: fast.keepers[0].agent.x, z: fast.keepers[0].agent.z };
      steps(slow, 40); steps(fast, 40);
      const ds = Math.hypot(slow.keepers[0].agent.x - s0.x, slow.keepers[0].agent.z - s0.z);
      const df = Math.hypot(fast.keepers[0].agent.x - f0.x, fast.keepers[0].agent.z - f0.z);
      expect(df).toBeGreaterThan(ds * 1.1);
      expect(investigateFor(LEVELS[1]).seen.speed).toBe(KEEPER.investigateSpeed);
   });

   it("a catch costs the level's seconds and resets the level's bundles", () => {
      for (const id of [1, 3, 5] as const) {
         const run = createRun(7, undefined, onMap1(LEVELS[id]));
         run.grace = 0;
         expect(run.bundlesLeft).toBe(LEVELS[id].bundles);
         run.keepers[0].agent.x = run.panda.x + 0.5; run.keepers[0].agent.z = run.panda.z;
         run.bundlesLeft = 0;
         stepRun(run, STILL, DT);
         expect(run.catches).toBe(1);
         expect(run.timeLeft).toBeCloseTo(CLOCK.startS - DT - LEVELS[id].penalty, 9);
         expect(run.bundlesLeft).toBe(LEVELS[id].bundles);
      }
   });
});

describe("zoo-escape levels: the searchlight and the gates read the level", () => {
   it("the searchlight catches after the level's catch time and its meter decays at the level's rate", () => {
      const pt = { x: 0, y: 0, z: 0 };
      for (const id of [1, 5] as const) {
         const run = createRun(7, undefined, onMap1(LEVELS[id]));
         run.stage = 2; run.reached = 2; run.grace = 0;
         for (const k of run.keepers) { k.agent.x = 9; k.agent.z = 16; }
         let t = 0;
         let rises = 0;
         while (!run.events.caught && t < 6) {
            // stand 5 m out along the beam (keepers parked far away); every step in the beam fills dt / catchS
            const yaw = searchlightYaw(run.time + DT, run.light.phase);
            pt.x = SEARCHLIGHT.x + Math.sin(yaw) * 5; pt.z = SEARCHLIGHT.z + Math.cos(yaw) * 5;
            run.panda.x = pt.x; run.panda.z = pt.z;
            for (const k of run.keepers) { k.agent.x = 9; k.agent.z = 16; }
            const before = run.light.meter;
            stepRun(run, STILL, DT);
            t += DT;
            if (run.light.seeing && run.light.meter < 1 && run.light.meter > before) {
               expect(run.light.meter - before, `L${id}`).toBeCloseTo(DT / LEVELS[id].catchS, 9);
               rises += 1;
            }
         }
         expect(run.events.caught, `L${id}`).toBe("light");
         expect(rises).toBeGreaterThan(10);
      }
      for (const id of [1, 5] as const) {
         const run = createRun(7, undefined, onMap1(LEVELS[id]));
         run.stage = 2; run.reached = 2;
         run.panda.x = -8; run.panda.z = -40; // in stage 3, 20 m from the tower: out of the beam (14 m)
         run.light.meter = 0.8;
         for (const k of run.keepers) { k.agent.x = 9; k.agent.z = 16; }
         stepRun(run, STILL, 0.5);
         expect(run.light.meter, `L${id}`).toBeCloseTo(0.8 - LEVELS[id].decay * 0.5, 6);
      }
   });

   it("crossing a gate refills the level's bundles", () => {
      for (const id of [1, 3] as const) {
         const run = createRun(7, undefined, onMap1(LEVELS[id]));
         run.panda.x = 4; run.panda.z = 1.5; run.bundlesLeft = 0;
         const north: StepInput = { dirX: 0, dirZ: -1, sneak: false, toss: false };
         while (run.panda.z > -1.6 && !run.over) stepRun(run, north, DT);
         expect(run.stage).toBe(1);
         expect(run.bundlesLeft, `L${id}`).toBe(LEVELS[id].bundles);
      }
   });
});

describe("zoo-escape levels: five different maps, each with its twist", () => {
   const sig = (id: LevelId) => JSON.stringify({ gates: LEVELS[id].map.stages.map((s) => s.gate), keepers: LEVELS[id].map.keepers.map((k) => k.route), bushes: LEVELS[id].map.bushes.map((b) => b.box.min) });
   it("no two levels share a layout (gates, keeper routes, hiding spots); level 1 is today's map", () => {
      expect(LEVELS[1].map).toBe(MAP_1);
      expect(new Set(LEVEL_IDS.map(sig)).size).toBe(5);
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[id].map.stages, b = MAP_1.stages;
         expect(a.some((s, i) => s.gate.x0 !== b[i].gate.x0)).toBe(true);
         expect(LEVELS[id].map.theme).not.toBe("enclosure");
      }
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].map.theme)).size).toBe(5);
   });

   it("Safari Zone has jeeps and tall grass, Bird Garden birds and ponds, Central Zoo crowds and a fountain, Night Escape night and two searchlights", () => {
      expect(LEVELS[2].map.jeeps.length).toBeGreaterThanOrEqual(2);
      expect(LEVELS[2].map.bushes.filter((b) => b.look === "grass").length).toBeGreaterThanOrEqual(8);
      expect(LEVELS[3].map.birds.length).toBeGreaterThanOrEqual(9);
      expect(LEVELS[3].map.props.filter((p) => p.kind === "pond").length).toBeGreaterThanOrEqual(4);
      expect(LEVELS[4].map.bushes.filter((b) => b.look === "crowd").length).toBeGreaterThanOrEqual(10);
      expect(LEVELS[4].map.props.some((p) => p.kind === "fountain")).toBe(true);
      expect(LEVELS[5].map.theme).toBe("night");
      expect(LEVELS[5].map.lights.filter(Boolean).length).toBe(2);
      for (const id of [1, 3, 4] as const) expect(LEVELS[id].map.jeeps.length).toBe(0);
   });

   it("a jeep that touches the panda catches it (the level's seconds), and only on its own stage", () => {
      const level = LEVELS[2];
      const run = createRun(5, undefined, level);
      const j = level.map.jeeps[0];
      run.stage = j.stage; run.reached = j.stage; run.grace = 0;
      for (const k of run.keepers) { k.agent.x = 100; k.agent.z = 100; }
      // the panda stands where the jeep will be next step
      const pose = jeepPose(j, level.map.cycles[j.stage], run.time + DT + run.phases[j.stage], { x: 0, z: 0, yaw: 0 });
      run.panda.x = pose.x; run.panda.z = pose.z;
      stepRun(run, STILL, DT);
      expect(run.lastCatch).toBe("jeep");
      expect(run.catches).toBe(1);
      expect(run.timeLeft).toBeCloseTo(CLOCK.startS - DT - level.penalty, 9);
      // the panda's start on stage 1: no jeep there
      const other = createRun(5, undefined, level);
      other.grace = 0;
      for (const k of other.keepers) { k.agent.x = 100; k.agent.z = 100; }
      stepRun(other, STILL, DT);
      expect(other.catches).toBe(0);
      const b = jeepBox(j, pose, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
      expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeCloseTo(j.length, 9);
   });

   it("a bird squawks when the panda walks past (not when it sneaks) and a calm keeper comes to look", () => {
      const level = LEVELS[3];
      const bird = level.map.birds.find((b) => b.stage === 0)!;
      const walk = (sneak: boolean) => {
         const run = createRun(9, undefined, level);
         run.grace = 0;
         run.panda.x = bird.x + BIRDS.range + 0.6; run.panda.z = bird.z;
         let squawk = -1, heard = -1;
         const input: StepInput = { dirX: -1, dirZ: 0, sneak, toss: false };
         for (let n = 0; n < 60 && squawk < 0; n++) {
            stepRun(run, input, DT);
            if (run.events.squawk >= 0) { squawk = run.events.squawk; heard = run.events.heard; }
         }
         return { run, squawk, heard };
      };
      const loud = walk(false);
      expect(loud.squawk).toBe(level.map.birds.indexOf(bird));
      expect(loud.run.birds[loud.squawk].cool).toBeGreaterThan(BIRDS.cooldown - 0.1);
      if (loud.heard >= 0) expect(loud.run.keepers[loud.heard].kind).toBe("heard");
      expect(walk(true).squawk).toBe(-1);
   });

   it("Night Escape's plaza searchlight sees on stage 2 and never reaches the stage's entry", () => {
      const map = LEVELS[5].map;
      const light = map.lights[1]!;
      const pt = { x: light.x + Math.sin(light.baseYaw) * 6, y: 0, z: light.z + Math.cos(light.baseYaw) * 6 };
      expect(searchlightSees(light.baseYaw, pt, light, map)).toBe(true);
      for (let t = 0; t < light.period; t += 0.05) expect(searchlightSees(searchlightYaw(t, 0, light), { x: map.stages[1].start.x, y: 0, z: map.stages[1].start.z }, light, map)).toBe(false);
   });
});

describe("zoo-escape levels: limit proof per level (README)", () => {
   it("every level's route floor keeps its bound at or under level 1's: PROPOSED_LIMITS hold on every map", () => {
      for (const id of LEVEL_IDS) {
         const map = LEVELS[id].map;
         const per = [0, 1, 2].map((s) => [0, 1, 2, 3, 4].map((m) => stageRouteBound(s as StageIndex, m, SNACK.reach, SNACK.minGap, PANDA.radius, map)));
         let best = 0, pps = 0;
         for (let k = 0; k <= 12; k++) {
            let L = Infinity;
            for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) { const c = k - a - b; if (c >= 0 && c <= 4) L = Math.min(L, per[0][a] + per[1][b] + per[2][c]); }
            const t = L / PANDA.walk;
            const score = SCORE.win + SCORE.snack * k + SCORE.perSecond * Math.floor(CLOCK.startS - t);
            best = Math.max(best, score);
            pps = Math.max(pps, score / t);
         }
         // level 1's bound is 3190 and 158.0 pts/s (rules.test.ts); every map's is at most that
         expect(best, `L${id}`).toBeLessThanOrEqual(3190);
         expect(pps, `L${id}`).toBeLessThanOrEqual(158.1);
         expect(Math.ceil(best * 1.03)).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(pps * 1.03).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxPointsPerSec);
      }
   });


   it("every level keeps the proof's inputs: the clock, the scoring, three catches, the grace and the card", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, undefined, LEVELS[id]);
         expect(run.timeLeft).toBe(CLOCK.startS);
         // the earliest end: three bump catches, each after the 1 s grace, two 1.2 s cards between
         let t = 0;
         while (!run.over && t < 20) {
            if (run.card <= 0) { run.keepers[0].agent.x = run.panda.x + 0.5; run.keepers[0].agent.z = run.panda.z; }
            stepRun(run, STILL, DT);
            t += DT;
         }
         expect(run.over).toBe("lose");
         expect(t).toBeGreaterThanOrEqual(3 * CATCH.graceS + 2 * CATCH.cardS - 2 * DT);
         expect(t * 1000).toBeGreaterThanOrEqual(PROPOSED_LIMITS.minDurationMs);
      }
   });
});

describe("zoo-escape levels: bots through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the oracle escapes on every seed inside the proven limits; idle and toss-spam never clear`, () => {
         const target = levelMeta(id).clearScore ?? levelMeta(4).clearScore!;
         let wins = 0;
         let reached = 0;
         const seeds = 12;
         for (let seed = 1; seed <= seeds; seed++) {
            const { end, run } = oracleRun(seed, LEVELS[id], seed % 2 ? fixedFrames(1000 / 60) : randomFrames(seed));
            expect(withinServerLimits(end.score, end.elapsedMs, PROPOSED_LIMITS), `seed ${seed}`).toBe(true);
            expect(capScore(end.score, end.elapsedMs, PROPOSED_LIMITS)).toBe(end.score);
            expect(withinServerLimits(end.score, end.elapsedMs, meta.scoring) || end.elapsedMs < meta.scoring.minDurationMs).toBe(true);
            if (end.endReason === "win") wins += 1;
            if (end.score >= target) reached += 1;
            if (id < 5) expect(isLevelCleared(end.endReason, end.score, levelMeta(id))).toBe(end.endReason === "win" || end.score >= target);
            expect(run.level).toBe(LEVELS[id]);
            expect(run.map).toBe(LEVELS[id].map);
         }
         expect(wins / seeds).toBeGreaterThanOrEqual(0.9);
         expect(reached / seeds).toBeGreaterThanOrEqual(0.99);
         const idle = play(3, LEVELS[id], fixedFrames(1000 / 30), () => undefined);
         expect(idle.end.endReason).toBe("timeup");
         expect(idle.end.score).toBe(0);
         expect(isLevelCleared(idle.end.endReason, idle.end.score, levelMeta(id))).toBe(false);
         const spam = play(4, LEVELS[id], fixedFrames(1000 / 30), (_r, input) => { input.toss = !input.toss; });
         expect(spam.end.score).toBe(0);
         expect(withinServerLimits(spam.end.score, spam.end.elapsedMs, PROPOSED_LIMITS)).toBe(true);
      }, 180_000);
   }
});
