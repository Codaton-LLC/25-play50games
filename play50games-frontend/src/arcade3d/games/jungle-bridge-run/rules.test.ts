import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   AIRBORNE_Y,
   GAP_EDGE,
   GAP_LEN,
   GEM_POINTS,
   INITIAL_LIVES,
   JUMP_S,
   LOG_PILLAR_AFTER,
   PAIR_AT,
   SINGLE_AT,
   LANE_CHANGE_S,
   LANE_X,
   LAVA_ON,
   LAVA_PERIOD,
   RESPAWN_BACK,
   RESPAWN_S,
   RUN_IN_Z,
   SECTION_LEN,
   SECTION_POINTS,
   SLIDE_S,
   TIME_BONUS_PER_SECOND,
   createRun,
   finishZ,
   hasClearLine,
   hits,
   isLavaActive,
   logXAt,
   obstacleEnd,
   step,
   syncStore,
   type Obstacle,
   type Run,
} from "./rules";

const DT = 1 / 60;
const idle = {};
/** Put the runner at z on a lane, standing, mid-run. */
function place(run: Run, z: number, lane = 1): Run {
   run.z = z;
   run.lane = lane;
   run.x = LANE_X[lane];
   run.laneFromX = run.x;
   run.laneToX = run.x;
   run.laneTimer = 0;
   run.jumpTimer = 0;
   run.slideTimer = 0;
   run.y = 0;
   return run;
}
/** A run whose section 0 holds exactly this obstacle. */
function withObstacle(o: Obstacle, id: 1 | 2 | 3 | 4 | 5 = 3): Run {
   const run = createRun(1, LEVELS[id], id);
   run.sections[0].obstacles = [o];
   return run;
}

describe("jungle-bridge-run rules: determinism", () => {
   it("the same seed and inputs give the same run", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(77, LEVELS[id], id);
         const b = createRun(77, LEVELS[id], id);
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
         for (let i = 0; i < 600; i++) {
            const inp = { left: i % 97 === 5, right: i % 89 === 40, jump: i % 41 === 7, slide: i % 53 === 20 };
            step(a, inp, DT, 60_000);
            step(b, inp, DT, 60_000);
         }
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
   });
});

describe("jungle-bridge-run rules: the generator (200 seeds per level)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: counts, clear line, forced action, spacing, reachable gems`, () => {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, level, id);
            expect(run.level).toBe(level);
            expect(run.levelId).toBe(id);
            expect(run.speed).toBe(level.speed);
            expect(run.sections.length).toBe(level.sections);
            expect(run.gems.length).toBe(level.sections * level.gemsPerSection);
            expect(hasClearLine(run)).toBe(true);
            let arrival = 1;
            let lastEnd = -Infinity;
            run.sections.forEach((sec, s) => {
               expect(sec.startZ).toBe(RUN_IN_Z + s * SECTION_LEN);
               expect(sec.gateZ).toBe(sec.startZ + SECTION_LEN);
               // every section's clear lane differs from the lane the runner arrives on
               expect(sec.clearLane).not.toBe(arrival);
               for (const o of sec.obstacles) {
                  expect(level.patterns).toContain(o.kind);
                  // patterns at least 9.5 m apart, within the section
                  expect(o.z - lastEnd).toBeGreaterThanOrEqual(9.5 - 1e-9);
                  lastEnd = obstacleEnd(o);
                  expect(obstacleEnd(o)).toBeLessThanOrEqual(sec.gateZ - 7.5);
                  // standing still on the arrival lane never passes
                  if (o.kind === "pillar" || o.kind === "lava") expect(o.lane).toBe(arrival);
                  if (o.kind === "vine") expect(o.lanes).toEqual(expect.arrayContaining([arrival, sec.clearLane]));
                  if (o.kind === "bridge") expect(o.plankLane).toBe(sec.clearLane);
                  if (o.kind === "gap") expect(o).toMatchObject({ length: GAP_LEN, lanes: [0, 1, 2] });
                  if (o.kind === "log") expect(o.speed).toBe(level.logSpeed);
               }
               if (sec.obstacles.length === 2) expect(sec.obstacles.some((o) => o.kind === "bridge")).toBe(false);
               // a single log's section carries a pillar on the arrival lane 10.2 m on
               if (sec.obstacles[0].kind === "log" && sec.obstacles[0].z === sec.startZ + SINGLE_AT) expect(sec.obstacles[1]).toEqual({ kind: "pillar", z: sec.startZ + SINGLE_AT + LOG_PILLAR_AFTER, lane: arrival });
               // something in every section stops a runner who stays on the arrival lane (a rolling log may miss)
               const forces = (o: Obstacle) =>
                  o.kind === "gap" || o.kind === "bridge" || ((o.kind === "pillar" || o.kind === "lava") && o.lane === arrival) || (o.kind === "vine" && o.lanes.includes(arrival));
               expect(sec.obstacles.some(forces)).toBe(true);
               arrival = sec.clearLane;
            });
            for (const g of run.gems) {
               const sec = run.sections[g.section];
               expect(g.x).toBe(LANE_X[g.lane]);
               expect(g.z).toBeGreaterThan(sec.startZ);
               expect(g.z).toBeLessThan(sec.gateZ);
               // never inside a pillar, a lava vent or off a bridge's planks
               for (const o of sec.obstacles) {
                  if ((o.kind === "pillar" || o.kind === "lava") && o.lane === g.lane) expect(Math.abs(o.z - g.z)).toBeGreaterThan(1.5);
                  if (o.kind === "bridge" && o.plankLane !== g.lane) expect(g.z < o.z - 1.5 || g.z > o.z + o.length + 1.5).toBe(true);
               }
            }
         }
         // two patterns in a section only on the fast levels
         const pairs = Array.from({ length: 50 }, (_, s) => createRun(s + 1, level, id)).some((r) => r.sections.some((sec) => sec.obstacles[0].z === sec.startZ + PAIR_AT[0]));
         expect(pairs).toBe(id >= 4);
      });
   }
});

describe("jungle-bridge-run rules: obstacles", () => {
   it("a jump clears a gap, a slide or a run does not", () => {
      const gap: Obstacle = { kind: "gap", z: 20, length: GAP_LEN, lanes: [0, 1, 2] };
      const onFoot = place(withObstacle(gap), 20 + GAP_EDGE + 0.01);
      expect(hits(onFoot, gap)).toBe(true);
      const sliding = place(withObstacle(gap), 20 + GAP_EDGE + 0.01);
      sliding.slideTimer = 0.3;
      expect(hits(sliding, gap)).toBe(true);
      const jumping = place(withObstacle(gap), 20 + GAP_EDGE + 0.01);
      jumping.y = AIRBORNE_Y + 0.01;
      jumping.jumpTimer = 0.3;
      expect(hits(jumping, gap)).toBe(false);
      // the edges hold a foot
      expect(hits(place(withObstacle(gap), 20 + GAP_EDGE - 0.01), gap)).toBe(false);
      expect(hits(place(withObstacle(gap), 20 + GAP_LEN - GAP_EDGE + 0.01), gap)).toBe(false);
   });
   it("a slide clears a vine, a jump or a run does not", () => {
      const vine: Obstacle = { kind: "vine", z: 20, lanes: [1] };
      const run = place(withObstacle(vine), 20);
      expect(hits(run, vine)).toBe(true);
      run.slideTimer = 0.2;
      expect(hits(run, vine)).toBe(false);
      run.slideTimer = 0;
      run.y = 0.8;
      run.jumpTimer = 0.2;
      expect(hits(run, vine)).toBe(true);
      expect(hits(place(withObstacle(vine), 20, 0), vine)).toBe(false);
   });
   it("a log trips a runner under 0.4 m and rolls between its ends", () => {
      const log: Obstacle = { kind: "log", z: 20, speed: 2.5, minX: -2.4, maxX: 2.4, phase: 0 };
      const run = place(withObstacle(log), 20);
      run.time = 0;
      run.x = logXAt(log, 0);
      expect(hits(run, log)).toBe(true);
      run.y = 0.41;
      expect(hits(run, log)).toBe(false);
      for (let t = 0; t < 10; t += 0.05) {
         expect(logXAt(log, t)).toBeGreaterThanOrEqual(-2.4 - 1e-9);
         expect(logXAt(log, t)).toBeLessThanOrEqual(2.4 + 1e-9);
      }
      expect(Math.abs(logXAt(log, 0.5) - logXAt(log, 0))).toBeCloseTo(1.25, 9);
   });
   it("a pillar blocks its lane whatever the runner does; the next lane passes", () => {
      const pillar: Obstacle = { kind: "pillar", z: 20, lane: 1 };
      const run = place(withObstacle(pillar), 20, 1);
      run.y = 1.2;
      expect(hits(run, pillar)).toBe(true);
      expect(hits(place(withObstacle(pillar), 20, 0), pillar)).toBe(false);
   });
   it("on a bridge only the plank lane holds", () => {
      const bridge: Obstacle = { kind: "bridge", z: 20, length: 8, plankLane: 2 };
      expect(hits(place(withObstacle(bridge), 24, 2), bridge)).toBe(false);
      expect(hits(place(withObstacle(bridge), 24, 1), bridge)).toBe(true);
      expect(hits(place(withObstacle(bridge), 19.9, 1), bridge)).toBe(false);
   });
   it("lava blocks only during its 1.2 s of every 3 s", () => {
      const lava: Obstacle = { kind: "lava", z: 20, lane: 0 };
      const run = place(withObstacle(lava, 5), 20, 0);
      for (let t = 0; t < 9; t += 0.1) {
         run.time = t;
         expect(hits(run, lava)).toBe(t % LAVA_PERIOD < LAVA_ON);
         expect(isLavaActive(t)).toBe(t % LAVA_PERIOD < LAVA_ON);
      }
   });
});

describe("jungle-bridge-run rules: moves and scoring", () => {
   it("a lane change takes 0.18 s, also mid-jump; jump 0.55 s, slide 0.60 s", () => {
      const run = createRun(3, LEVELS[1], 1);
      run.sections.forEach((s) => (s.obstacles = []));
      step(run, { jump: true }, DT);
      expect(run.jumpTimer).toBeCloseTo(JUMP_S - DT, 9);
      step(run, { right: true }, DT);
      expect(run.lane).toBe(2);
      let t = DT;
      while (run.laneTimer > 0) {
         step(run, idle, DT);
         t += DT;
      }
      expect(t).toBeCloseTo(LANE_CHANGE_S + DT / 2, 1);
      expect(run.x).toBe(LANE_X[2]);
      while (run.jumpTimer > 0) step(run, idle, DT);
      expect(run.y).toBe(0);
      step(run, { slide: true }, DT);
      expect(run.slideTimer).toBeCloseTo(SLIDE_S - DT, 9);
      // no second jump in the air
      step(run, { jump: true }, DT);
      const timer = run.jumpTimer;
      step(run, { jump: true }, DT);
      expect(run.jumpTimer).toBeCloseTo(timer - DT, 9);
   });
   it("lanes are in screen order: right moves to a higher lane = a smaller x (the camera looks along +z)", () => {
      expect(LANE_X).toEqual([2, 0, -2]);
      const run = createRun(3, LEVELS[1], 1);
      step(run, { right: true }, 0.5);
      expect(run.x).toBeLessThan(0);
   });
   it("a gem pays 20 once, a section 100, the finish the time bonus (+6 per full second left)", () => {
      const run = createRun(4, LEVELS[1], 1);
      run.sections.forEach((s) => (s.obstacles = []));
      const gem = run.gems[0];
      place(run, gem.z - 0.5, gem.lane);
      const ev = step(run, idle, DT, 60_000);
      expect(ev.gemCollected).toBe(true);
      expect(run.score).toBe(GEM_POINTS);
      place(run, gem.z, gem.lane);
      step(run, idle, DT, 60_000);
      expect(run.score).toBe(GEM_POINTS);
      place(run, run.sections[0].gateZ - 0.01, 1);
      step(run, idle, DT, 60_000);
      expect(run.currentSection).toBe(1);
      expect(run.score).toBe(GEM_POINTS + SECTION_POINTS);
      place(run, finishZ(run.level) - 0.01, 1);
      run.currentSection = run.sections.length - 1;
      const before = run.score;
      const end = step(run, idle, DT, 41_999);
      expect(end.won).toBe(true);
      expect(run.over).toBe("win");
      expect(run.score - before).toBe(SECTION_POINTS + 41 * TIME_BONUS_PER_SECOND);
   });
   it("a hit costs a life and respawns 4 m before the section start on its clear lane after 0.8 s; that section's gems stay taken", () => {
      const run = createRun(9, LEVELS[1], 1);
      run.currentSection = 1;
      const sec = run.sections[1];
      const pillar: Obstacle = { kind: "pillar", z: sec.startZ + 5, lane: 0 };
      sec.obstacles = [pillar];
      run.gems.filter((g) => g.section === 1).forEach((g) => (g.collected = true));
      place(run, pillar.z - 0.65, 0);
      const ev = step(run, idle, DT);
      expect(ev.lifeLost).toBe(true);
      expect(run.lives).toBe(INITIAL_LIVES - 1);
      expect(run.respawning).toBe(true);
      let t = 0;
      while (run.respawning) {
         step(run, { jump: true, left: true }, DT);
         t += DT;
      }
      expect(t).toBeCloseTo(RESPAWN_S, 1);
      expect(run.z).toBe(sec.startZ - RESPAWN_BACK);
      expect(run.lane).toBe(sec.clearLane);
      expect(run.gems.filter((g) => g.section === 1).every((g) => g.collected)).toBe(true);
   });
   it("three hits lose; the store ends with lose and its lives follow the rules", () => {
      const run = createRun(2, LEVELS[1], 1);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 75_000, lives: INITIAL_LIVES });
      store.getState().markReady();
      store.getState().start();
      for (let i = 0; i < 3 && !run.over; i++) {
         run.respawning = false;
         const sec = run.sections[run.currentSection];
         sec.obstacles = [{ kind: "pillar", z: run.z + 0.1, lane: run.lane }];
         syncStore(run, step(run, idle, DT), store);
         expect(store.getState().lives).toBe(INITIAL_LIVES - 1 - i);
      }
      expect(run.over).toBe("lose");
      expect(store.getState().endReason).toBe("lose");
   });
   it("keyboard and touch share one input: `pressed` (keys and swipes) and the jump press, the same timers", () => {
      // the Scene maps pressed.left / right, jumpPressed || pressed.up, pressed.down into one RunnerInput;
      // nothing in the rules knows the device
      const a = createRun(6, LEVELS[2], 2);
      const b = createRun(6, LEVELS[2], 2);
      step(a, { left: true, jump: true }, DT);
      step(b, { left: true, jump: true }, DT);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
   });
});

describe("jungle-bridge-run rules: each level's finish and HUD", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: a clean run passes every gate and wins only at the last one; the Section chip counts to the level's sections`, () => {
         const run = createRun(12, LEVELS[id], id);
         run.sections.forEach((sec) => (sec.obstacles = []));
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[id].durationMs, lives: INITIAL_LIVES });
         store.getState().markReady();
         store.getState().start();
         let gates = 0;
         while (!run.over) {
            const ev = step(run, idle, DT, 30_000);
            syncStore(run, ev, store);
            if (ev.sectionCleared) gates++;
            if (!run.over) expect(run.z).toBeLessThan(finishZ(LEVELS[id]) + 0.2);
         }
         expect(run.over).toBe("win");
         expect(gates).toBe(LEVELS[id].sections - 1);
         expect(run.z).toBeGreaterThanOrEqual(finishZ(LEVELS[id]));
         expect(run.time).toBeCloseTo(finishZ(LEVELS[id]) / LEVELS[id].speed, 1);
         expect(store.getState().stats.section).toBe(LEVELS[id].sections);
         expect(store.getState().endReason).toBe("win");
      });
   }
});
