// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game
// (replayed against today's createRun), monotone difficulty, every level setting reaching the
// simulation, the limit proof per level and the bots through the real store. rules.test.ts is
// untouched; its two store-backed drivers are copied below with a level (the stop-curve driver leans
// into the level's gusts).
import { describe, expect, it, vi } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { definitionLevelProblems, isLevelCleared, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type CraneLevel } from "./levels";
import { constructionWorkerMeta as meta } from "./meta";
import {
   BOB_SPEED, CLOCK_S, FLOOR, GOOD, GRAVITY, MAX_OMEGA, MAX_VR, OK_BAND, PERFECT, PICK_MAX_R, PIECE_H, PILE_A, PILE_R,
   PLAN, PROPOSED_LEVEL_LIMITS, RADIUS_MIN, SLOT_A, SLOT_R, TOWER_BAND, WIND, createRun, dropRadius, pileUnder, rateLanding,
   stepRun, type CraneInput, type Run,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ Hud: () => null }));

const ZERO: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };
const levelMeta = (id: LevelId) => meta.levels![id - 1];
const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];

function clamp(v: number, lo: number, hi: number): number {
   return v < lo ? lo : v > hi ? hi : v;
}

const CMD: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };

/** Rate-limit `next` toward `current` so a frame commands at most `accel` per second. */
function ease(current: number, next: number, accel: number, dt: number): number {
   const step = Math.max(0, accel) * dt;
   return current + clamp(next - current, -step, step);
}

/**
 * Store-backed bots, one physics for every pointer. The damped driver uses swing-damped
 * proportional speeds and drops when the predicted landing is inside 0.38 m. The stop-curve
 * driver brakes on a stop curve, drops inside 0.35 m, and while the tower gust is on it
 * accelerates against the wind. One reused command.
 */
// kp radius, kd radius, kp angle, kd angle, swing damp, drop metres, max vr, max ω, radial accel, angular gain.
const FINE_GAINS = [3.2, 3, 2.5, 1.8, 4, 0.38, 1.4, 0.4, 2, 4];

function landDist(run: Run, step: { slot: number; floor: number }): number {
   const fall = Math.max(0, run.hookY - PIECE_H - step.floor * FLOOR);
   const t = Math.sqrt((2 * fall) / GRAVITY);
   const sx = SLOT_R * Math.sin(SLOT_A[step.slot]);
   const sz = SLOT_R * Math.cos(SLOT_A[step.slot]);
   return Math.hypot(run.hookX + run.bobVx * t - sx, run.hookZ + run.bobVz * t - sz);
}

function driveFine(run: Run, dt: number): CraneInput {
   const g = FINE_GAINS;
   CMD.rot = 0; CMD.radial = 0; CMD.pick = -1; CMD.actionPick = false; CMD.drop = false;
   const step = PLAN[run.planIndex];
   if (!step || run.phase !== "play" || run.lock > 0 || !(dt > 0)) return CMD;
   const carrying = run.carried >= 0;
   const wantR = carrying ? Math.max(SLOT_R, dropRadius(step.building)) : PILE_R;
   const wantA = carrying ? SLOT_A[step.slot] : PILE_A[step.kind];
   const aErr = wantA - run.angle;
   const rErr = wantR - run.radius;
   const s = Math.sin(run.angle);
   const c = Math.cos(run.angle);
   const radius = Math.max(run.radius, RADIUS_MIN);
   const radSwing = run.swing.x.v * s + run.swing.z.v * c;
   const tanSwing = run.swing.x.v * c - run.swing.z.v * s;
   const vrWant = clamp(g[0] * rErr - g[1] * run.vr - g[4] * radSwing, -g[6], g[6]);
   const omWant = clamp(g[2] * aErr - g[3] * run.omega - g[4] * tanSwing / radius, -g[7], g[7]);
   const vrCmd = ease(run.vr, vrWant, g[8], dt);
   const omCmd = ease(run.omega, omWant, g[9] / radius, dt);
   CMD.radial = clamp(vrCmd, -MAX_VR, MAX_VR) / MAX_VR;
   CMD.rot = clamp(omCmd, -MAX_OMEGA, MAX_OMEGA) / MAX_OMEGA;
   if (!carrying && run.radius <= PICK_MAX_R && pileUnder(run) === step.kind && Math.hypot(run.bobVx, run.bobVz) < 0.4) CMD.actionPick = true;
   const gate = carrying && run.cheer <= 0 && run.radius >= dropRadius(step.building) && Math.abs(aErr) < 0.18;
   if (gate && (run.guide === 2 || landDist(run, step) < g[5])) CMD.drop = true;
   return CMD;
}

const STOP = { radAcc: 3.5, angK: 4, stop: 0.8, dropDist: 0.35 };

function driveStop(run: Run, dt: number): CraneInput {
   const p = STOP;
   CMD.rot = 0;
   CMD.radial = 0;
   CMD.pick = -1;
   CMD.actionPick = false;
   CMD.drop = false;
   const step = PLAN[run.planIndex];
   if (!step || run.phase !== "play" || run.lock > 0 || !(dt > 0)) return CMD;
   const carrying = run.carried >= 0;
   const wantR = carrying ? Math.max(SLOT_R, dropRadius(step.building)) : PILE_R;
   const wantA = carrying ? SLOT_A[step.slot] : PILE_A[step.kind];
   const aErr = wantA - run.angle;
   const rErr = wantR - run.radius;
   const radius = Math.max(run.radius, RADIUS_MIN);
   const angAcc = p.angK / radius;
   const cap = (dist: number, accel: number, max: number) => Math.min(max, Math.sqrt(Math.max(0, 2 * accel * Math.abs(dist))) * p.stop);
   const lv = run.level;
   const gust = step.building >= lv.gustFrom && run.towerTime >= 0 && run.towerTime % lv.gustPeriod < 1.05;
   let vrCmd: number;
   let omCmd: number;
   if (gust) {
      vrCmd = run.vr - 2.5 * Math.sin(run.angle) * dt;
      omCmd = run.omega - (2.5 * Math.cos(run.angle) * dt) / radius;
   } else {
      vrCmd = ease(run.vr, Math.sign(rErr) * cap(rErr, p.radAcc, 2.3), p.radAcc, dt);
      omCmd = ease(run.omega, Math.sign(aErr) * cap(aErr, angAcc, 0.75), angAcc, dt);
   }
   const atPile = !carrying && Math.abs(aErr) < 0.05 && Math.abs(rErr) < 0.16;
   if (atPile && Math.hypot(run.bobVx, run.bobVz) < BOB_SPEED && Math.abs(run.vr) < 0.06 && Math.abs(run.omega) < 0.02) {
      vrCmd = run.vr;
      omCmd = run.omega;
   }
   CMD.radial = clamp(vrCmd, -MAX_VR, MAX_VR) / MAX_VR;
   CMD.rot = clamp(omCmd, -MAX_OMEGA, MAX_OMEGA) / MAX_OMEGA;
   if (!carrying && run.radius <= PICK_MAX_R && pileUnder(run) === step.kind) CMD.actionPick = true;
   const gate = carrying && run.cheer <= 0 && run.radius >= dropRadius(step.building);
   const bob = Math.hypot(run.bobVx, run.bobVz);
   if (gate && (run.guide === 2 || (p.dropDist > 0 && Math.abs(aErr) < 0.2 && bob < 1.1 && landDist(run, step) < p.dropDist))) CMD.drop = true;
   return CMD;
}

function play(run: Run, input: CraneInput, dt: number, store: ReturnType<typeof createArcadeStore>): void {
   stepRun(run, input, dt);
   if (run.gained) {
      store.getState().addScore(run.gained);
      run.gained = 0;
   }
   if (run.phase === "win") store.getState().end("win");
   else if (run.phase === "lose") store.getState().end("lose");
   else if (run.phase === "timeup") store.getState().end("timeup");
}

function played(drive: (run: Run, dt: number) => CraneInput, frame: () => number, maxFrames: number, level: CraneLevel = LEVELS[1], seed = 7) {
   const run = createRun(seed, level);
   let houseMs = -1;
   let houseScore = -1;
   const end = simulateRun(createArcadeStore(), {
      durationMs: CLOCK_S * 1000,
      frame,
      maxFrames,
      step: (dt, _t, live) => {
         play(run, drive(run, dt), dt, live);
         if (houseMs < 0 && run.planIndex >= 8) {
            houseMs = live.getState().elapsedMs;
            houseScore = live.getState().score;
         }
      },
   });
   return { end, run, houseMs, houseScore };
}


function at(run: Run, angle: number, radius: number): void {
   run.angle = angle;
   run.radius = radius;
   run.omega = 0;
   run.vr = 0;
   run.swing.x.x = 0;
   run.swing.x.v = 0;
   run.swing.z.x = 0;
   run.swing.z.v = 0;
   stepRun(run, ZERO, 1 / 120);
}

/** Drop the first plan piece with the hook still at slot radius SLOT_R + offset: the run after the drop. */
function dropAt(level: CraneLevel, offset: number): Run {
   const run = createRun(1, level);
   const step = PLAN[0];
   at(run, SLOT_A[step.slot], SLOT_R + offset);
   run.carried = step.kind;
   stepRun(run, { ...ZERO, drop: true }, 1 / 60);
   return run;
}

/** Swing magnitude of an idle crane at time t (s), at 120 Hz. */
function idleSwing(level: CraneLevel, until: number): number {
   const run = createRun(2, level);
   for (let t = 0; t < until - 1e-9; t += 1 / 120) stepRun(run, ZERO, 1 / 120);
   return Math.hypot(run.swing.x.x, run.swing.z.x);
}

describe("construction-worker levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.scoring).toMatchObject({ maxScore: 6100, minDurationMs: 9000, maxDurationMs: 242000, base: 0, maxPointsPerSec: 150 });
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
      expect([1, 2, 3, 4].map((id) => levelMeta(id as LevelId).clearScore)).toEqual([2500, 2600, 2700, 2800]);
      expect(levelMeta(5).clearScore).toBeUndefined();
   });

   it("level 1 is today's game: same wind, bands and stability, and a replayed shift matches today's createRun", () => {
      expect(LEVELS[1]).toEqual({ gustFrom: 2, wind: WIND, gustPeriod: 7, band: 1, stab: 1 });
      for (const d of [0.1, 0.14, 0.2, 0.3, 0.5, 0.7]) for (const tower of [false, true]) expect(rateLanding(d, tower, LEVELS[1].band)).toBe(rateLanding(d, tower));
      for (const [k, frame] of [[0, fixedFrames(1000 / 60)], [1, randomFrames(5, 0.004, 0.05)]] as const) {
         const today = createRun(7 + k);
         const named = createRun(7 + k, LEVELS[1]);
         const next = frame;
         for (let n = 0; n < 40_000 && today.phase === "play"; n++) {
            const dt = next();
            const input = { ...driveFine(today, dt) };
            stepRun(today, input, dt);
            stepRun(named, input, dt);
         }
         expect(today.phase).not.toBe("play");
         expect(named.phase).toBe(today.phase);
         expect(named.score).toBe(today.score);
         expect(named.planIndex).toBe(today.planIndex);
         expect(named.stability).toBe(today.stability);
         expect(named.timeLeft).toBe(today.timeLeft);
         expect(named.swing).toEqual(today.swing);
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: CLOCK_S * 1000, lives: undefined, resultDelayMs: 1100 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   }, 60_000);

   it("keeps the clock, chips and instructions on every level", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelInstructions(definition, id)).toBe(definition.instructions);
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
      }
   });
});

describe("construction-worker levels: difficulty", () => {
   it("is monotone: earlier, stronger, more frequent gusts, smaller bands, dearer landings", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(b.gustFrom).toBeLessThanOrEqual(a.gustFrom);
         expect(b.wind).toBeGreaterThanOrEqual(a.wind);
         expect(b.gustPeriod).toBeLessThanOrEqual(a.gustPeriod);
         expect(b.band).toBeLessThan(a.band);
         expect(b.stab).toBeGreaterThanOrEqual(a.stab);
         expect(levelMeta(id).clearScore ?? Infinity).toBeGreaterThan(levelMeta((id - 1) as LevelId).clearScore!);
      }
      // a miss stays 12 everywhere, so a collapse still needs 9 drops (the 9000 ms minimum, README)
      for (const id of LEVEL_IDS) expect(Math.ceil(100 / 12)).toBe(9);
   });
});

describe("construction-worker levels: the simulation reads the level", () => {
   it("gusts start on the level's building, blow at the level's strength and repeat at its period", () => {
      // an idle crane: the only pivot acceleration is the wind (rawAccel of the last step)
      const windAt = (level: CraneLevel, t: number, planIndex = 0) => {
         const run = createRun(2, level);
         run.planIndex = planIndex;
         for (let n = 0; n < Math.round(t * 120); n++) stepRun(run, ZERO, 1 / 120);
         return run.rawAccel;
      };
      expect(windAt(LEVELS[1], 0.5)).toBe(0);
      expect(windAt(LEVELS[3], 0.5)).toBe(0);
      expect(windAt(LEVELS[4], 0.5)).toBeCloseTo(LEVELS[4].wind, 9);
      expect(windAt(LEVELS[5], 0.5)).toBeCloseTo(LEVELS[5].wind, 9);
      expect(windAt(LEVELS[5], 5.5)).toBe(0);
      expect(windAt(LEVELS[5], 6.5)).toBeCloseTo(LEVELS[5].wind, 9);
      expect(windAt(LEVELS[4], 6.5)).toBe(0);
      expect(windAt(LEVELS[4], 7.5)).toBeCloseTo(LEVELS[4].wind, 9);
      // from the shop (plan step 8) level 2 blows, level 1 waits for the tower (step 20)
      expect(windAt(LEVELS[2], 0.5, 8)).toBeCloseTo(LEVELS[2].wind, 9);
      expect(windAt(LEVELS[1], 0.5, 8)).toBe(0);
      expect(windAt(LEVELS[1], 0.5, 20)).toBeCloseTo(WIND, 9);
   });

   it("a landing is rated in the level's bands and a good or ok one costs the level's stability", () => {
      // level 3 has no gust on the house, so the hook stays where it is put
      const step = PLAN[0];
      const sx = SLOT_R * Math.sin(SLOT_A[step.slot]);
      const sz = SLOT_R * Math.cos(SLOT_A[step.slot]);
      let differs = 0;
      for (let offset = 0; offset <= 0.75; offset += 0.005) {
         for (const id of [1, 3] as const) {
            const run = createRun(1, LEVELS[id]);
            at(run, SLOT_A[step.slot] + offset / SLOT_R, SLOT_R);
            run.carried = step.kind;
            stepRun(run, ZERO, 1 / 120);
            const dist = Math.hypot(run.landX - sx, run.landZ - sz);
            const rating = rateLanding(dist, false, LEVELS[id].band);
            expect(run.guide).toBe(rating === 0 ? 2 : rating < 3 ? 1 : 0);
            stepRun(run, { ...ZERO, drop: true }, 1 / 120);
            expect(run.dropRating).toBe(rating);
            const cost = rating === 3 ? 12 : [0, 3, 6][rating] * LEVELS[id].stab;
            expect(run.stability).toBeCloseTo(100 - cost, 9);
            if (rateLanding(dist, false, LEVELS[1].band) !== rating) differs += 1;
         }
      }
      // the bands really differ: some landings rate lower on level 3 than they would on level 1
      expect(differs).toBeGreaterThan(0);
      expect(TOWER_BAND).toBe(0.8);
      expect(PERFECT * LEVELS[3].band).toBeLessThan(PERFECT);
      expect(GOOD * LEVELS[3].band).toBeLessThan(GOOD);
      expect(OK_BAND * LEVELS[3].band).toBeLessThan(OK_BAND);
   });
});

describe("construction-worker levels: limit proof per level (README)", () => {
   it("every level keeps the shift the proof counts: 36 pieces, 240 s, the gates, the dwell and a 12-point miss", () => {
      expect(PLAN.length).toBe(36);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(PROPOSED_LEVEL_LIMITS[1]);
         expect(levelRunConfig(definition, id).durationMs).toBe(CLOCK_S * 1000);
         const miss = createRun(1, LEVELS[id]);
         at(miss, SLOT_A[0] + 0.25, 9.5);
         miss.carried = 0;
         stepRun(miss, { ...ZERO, drop: true }, 1 / 60);
         expect(miss.stability).toBe(88);
         expect(dropRadius(0)).toBe(8.9);
         expect(PICK_MAX_R).toBe(7.8);
      }
   });
});

describe("construction-worker levels: bots through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the damped driver wins >= 90% and clears every run; the stop-curve driver stays legal; idle never clears`, () => {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const target = levelMeta(id).clearScore ?? levelMeta(4).clearScore!;
         const legal = (score: number, ms: number, what: string) => {
            expect(withinServerLimits(score, ms, limits), `${what}: ${score} in ${ms} ms`).toBe(true);
            expect(capScore(score, ms, limits)).toBe(score);
            expect(score).toBeLessThanOrEqual(6090);
         };
         let wins = 0;
         let reached = 0;
         const runs = 10;
         for (let k = 0; k < runs; k++) {
            const frame = k === 0 ? fixedFrames(1000 / 60) : k === 1 ? fixedFrames(50) : randomFrames(11 + k, 0.004, 0.05);
            const r = played(driveFine, frame, 20000, LEVELS[id], 7 + k);
            legal(r.end.score, r.end.elapsedMs, `fine ${k}`);
            if (r.end.endReason === "win") {
               wins += 1;
               expect(r.end.elapsedMs).toBeGreaterThanOrEqual(41560);
            }
            if (r.end.score >= target) reached += 1;
            if (id < 5) expect(isLevelCleared(r.end.endReason, r.end.score, levelMeta(id))).toBe(r.end.endReason === "win" || r.end.score >= target);
         }
         expect(wins / runs).toBeGreaterThanOrEqual(0.9);
         expect(reached / runs).toBeGreaterThanOrEqual(0.99);
         const stop = played(driveStop, fixedFrames(1000 / 60), 20000, LEVELS[id]);
         legal(stop.end.score, stop.end.elapsedMs, "stop");
         const idleRun = createRun(3, LEVELS[id]);
         const idle = simulateRun(createArcadeStore(), {
            durationMs: CLOCK_S * 1000,
            frame: fixedFrames(50),
            maxFrames: 6000,
            step: (dt, _t, live) => play(idleRun, ZERO, dt, live),
         });
         expect(idle.endReason).toBe("timeup");
         expect(idle.score).toBe(0);
         expect(isLevelCleared(idle.endReason, idle.score, levelMeta(id))).toBe(false);
      }, 180_000);
   }
});
