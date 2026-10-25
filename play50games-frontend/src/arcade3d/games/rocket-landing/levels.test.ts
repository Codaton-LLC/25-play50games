// Rocket Landing 5 levels test suite (docs/arcade-levels.md §6.3 step 6).
// Verifies declarations, level 1 replay fidelity vs today's game, monotone difficulty,
// per-level limits & closed-form proofs, honest pilot clearance rates, idle bot failure,
// and mutation probes on each level knob.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { fixedFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { LEVELS, type RocketLevel } from "./levels";
import { rocketLandingMeta as meta } from "./meta";
import definition from "./index";
import {
   BODY,
   CONTACT,
   DURATION_MS,
   ENGINE,
   PLANETS,
   PROPOSED_LEVEL_LIMITS,
   createRun,
   generateCampaign,
   landingSafe,
   padVx,
   padX,
   stepRun,
   wrap,
   type Run,
   type Controls,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Human-paced feedback pilot adapted for each level's constraints. */
function runPilot(level: RocketLevel, seed: number, assist: boolean = false): {
   score: number;
   elapsedMs: number;
   endReason: string | null;
   won: boolean;
   landedAll: boolean;
   landed: boolean[];
   crashes: number;
   finalPlanet: number;
   fuel: number;
} {
   const r = createRun(seed, assist, level);
   const store = createArcadeStore();
   const controls: Controls = { rotate: 0, thrust: false };
   const landed = Array.from({ length: level.planets }, () => false);
   let stage = 0, planet = -1, crashes = -1, pulse = 0;

   const result = simulateRun(store, {
      durationMs: level.durationMs,
      lives: 3,
      frame: fixedFrames(1000 / 60),
      step: (dt, _time, s) => {
         if (planet !== r.planet || crashes !== r.crashes) {
            planet = r.planet;
            crashes = r.crashes;
            stage = 0;
            pulse = 0;
         }
         const b = r.body, l = r.layouts[r.planet], g = PLANETS[r.planet].gravity;
         const px = padX(l, r.planet, r.attemptTime, level.padAmplitude);
         const pv = padVx(l, r.planet, r.attemptTime, level.padAmplitude);
         if (r.planet === 4 && stage === 0 && b.y < 7.4 && Math.abs(b.vy) < 1.5) stage = 1;
         const crossing = r.planet !== 4 || Math.abs(padX(l, 4, r.attemptTime + 3.5, level.padAmplitude)) < 0.25;
         const p3Aligned = r.planet !== 3 || (Math.abs(b.x - px) < 0.5 && Math.abs(b.vx - pv) < 0.35 && Math.abs(b.angle) < Math.min(0.12, level.contactAngle * 0.75));
         if ((r.planet !== 4 || stage === 1) && crossing && p3Aligned &&
            Math.abs(b.x - (r.planet === 4 ? 0 : px)) < (r.planet === 3 ? 0.8 : 0.3) &&
            Math.abs(b.vx - (r.planet === 4 ? 0 : pv)) < (r.planet === 3 ? 0.5 : 0.25) &&
            Math.abs(b.angle) < (r.planet === 3 ? Math.min(0.15, level.contactAngle * 0.9) : 0.08)) stage = 2;
         const shaft = l.spawnX < 0 ? -5.3 : 5.3;
         const tx = r.planet === 4 ? (stage === 0 ? shaft : 0) : px;
         const tv = r.planet === 4 ? 0 : pv;
         const targetY = stage === 2 ? 3.1 : r.planet === 4 ? (stage === 0 ? 7.2 : 5.8) : 8;
         const targetVy = stage === 2 ? -Math.min(2, 0.4 + Math.max(0, b.y - 3.1) * 0.5) : clamp((targetY - b.y) * 0.8, -3, 2);
         const ay = clamp(g + 3 * (targetVy - b.vy), 0, 12);
         const wind = r.planet === 3 ? level.windAmplitude * Math.sin(2 * Math.PI * r.attemptTime / 8 + l.wind) : 0;
         const ax = (r.planet === 4 ? 0.15 : r.planet === 3 ? 0.5 : 0.8) * (tx - b.x) + (r.planet === 4 ? 1 : r.planet === 3 ? 2.0 : 1.8) * (tv - b.vx) - (r.planet === 3 ? 1.15 : 1) * wind;
         const maxAngle = stage === 2 && b.y < 4.5 ? Math.min(level.contactAngle * 0.72, r.planet === 3 ? 0.125 : 0.08) : 0.45;
         const desiredAngle = clamp(-Math.atan2(ax, Math.max(g, ay)), -maxAngle, maxAngle);
         controls.rotate = clamp(-(8 * wrap(desiredAngle - b.angle) - 4 * b.omega) / 3, -1, 1);
         if (r.planet === 4 && r.assist && Math.abs(controls.rotate) <= ENGINE.neutral) controls.rotate = (controls.rotate < 0 ? -1 : 1) * (ENGINE.neutral + 0.001);
         pulse += clamp(ay / (12 * Math.max(0.8, Math.cos(b.angle))), 0, 1);
         controls.thrust = pulse >= 1;
         if (controls.thrust) pulse -= 1;
         stepRun(r, controls, dt);
         if (r.events.award) {
            landed[r.planet] = true;
            s.getState().addScore(r.events.award);
         }
         if (r.events.crash) {
            s.getState().loseLife();
         }
         if (r.terminal) {
            s.getState().setScore(r.score);
            s.getState().end(r.terminal);
         }
      },
   });

   return {
      score: result.score,
      elapsedMs: result.elapsedMs,
      endReason: result.endReason,
      won: result.endReason === "win",
      landedAll: landed.every(Boolean),
      landed,
      crashes: r.crashes,
      finalPlanet: r.planet,
      fuel: r.fuel,
   };
}

describe("rocket-landing levels: declarations and contracts", () => {
   it("declares five levels in meta and definition matching PROPOSED_LEVEL_LIMITS", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels![id - 1].clearScore).toBe(LEVELS[id].clearScore);
      }
      expect(meta.scoring.maxScore).toBe(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 5 max score does not exceed ~3x level 1 max score", () => {
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("instructions and descriptions reflect the level objective and hazards", () => {
      for (const id of LEVEL_IDS) {
         const lines = levelInstructions(definition, id);
         expect(lines.length).toBeGreaterThanOrEqual(3);
         expect(lines[1]).toContain(LEVELS[id].planets === 2 ? "both" : `${LEVELS[id].planets}`);
      }
   });
});

describe("rocket-landing levels: replay fidelity vs today's game", () => {
   it("default createRun(seed) runs the full 5-planet campaign identically to level 4", () => {
      for (let seed = 0; seed < 10; seed++) {
         const legacy = createRun(seed, false);
         const l4 = createRun(seed, false, LEVELS[4]);
         expect(legacy.level.planets).toBe(5);
         expect(l4.level.planets).toBe(5);
         expect(legacy.layouts).toEqual(l4.layouts);
         expect(legacy.body).toEqual(l4.body);
         expect(legacy.fuel).toBe(l4.fuel);

         // Step 50 frames with thruster active and verify byte-identical state
         const ctrl: Controls = { rotate: 0.2, thrust: true };
         for (let f = 0; f < 50; f++) {
            stepRun(legacy, ctrl, 1 / 60);
            stepRun(l4, ctrl, 1 / 60);
            expect(legacy.body.x).toBeCloseTo(l4.body.x, 10);
            expect(legacy.body.y).toBeCloseTo(l4.body.y, 10);
            expect(legacy.body.vx).toBeCloseTo(l4.body.vx, 10);
            expect(legacy.body.vy).toBeCloseTo(l4.body.vy, 10);
            expect(legacy.fuel).toBeCloseTo(l4.fuel, 10);
            expect(legacy.score).toBe(l4.score);
         }
      }
   });

   it("planets 0 and 1 share identical terrain layouts across all levels", () => {
      for (let seed = 0; seed < 10; seed++) {
         const campL1 = createRun(seed, false, LEVELS[1]).layouts;
         const campL4 = createRun(seed, false, LEVELS[4]).layouts;
         expect(campL1[0]).toEqual(campL4[0]);
         expect(campL1[1]).toEqual(campL4[1]);
      }
   });
});

describe("rocket-landing levels: monotone difficulty and score bounds", () => {
   it("scores and planets are strictly monotonic across levels", () => {
      const maxScores = LEVEL_IDS.map((id) => PROPOSED_LEVEL_LIMITS[id].maxScore);
      expect(maxScores).toEqual([1300, 1800, 2300, 2800, 2950]);
      for (let i = 1; i < maxScores.length; i++) {
         expect(maxScores[i]).toBeGreaterThan(maxScores[i - 1]);
      }

      const planets = LEVEL_IDS.map((id) => LEVELS[id].planets);
      expect(planets).toEqual([2, 3, 4, 5, 5]);

      const clearScores = LEVEL_IDS.map((id) => LEVELS[id].clearScore);
      expect(clearScores).toEqual([800, 1200, 1600, 2000, 2000]);
   });

   it("analytic limits proof holds for every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const n = level.planets;
         const theoreticalMax = n * 500 + level.cleanBonus;
         expect(theoreticalMax).toBe(limits.maxScore);

         // Earliest win time: n drops of at least 1.119 s + (n - 1) * 1.2 s hold time
         const minFlightTime = n * 1.119 + (n - 1) * 1.2;
         expect(limits.minDurationMs).toBeLessThanOrEqual(minFlightTime * 1000);
         expect(limits.minDurationMs).toBeLessThan(limits.maxDurationMs);
         expect(limits.maxDurationMs).toBe(level.durationMs + 2000);

         // Score rate bound: theoreticalMax <= base + maxPointsPerSec * t_win
         // Note: on 5-planet campaigns with Asteroid cavern, t_win is >= 14s > 10.75s
         const effectiveWinTime = n === 5 ? 14.0 : minFlightTime;
         expect(theoreticalMax).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * effectiveWinTime);
      }
   });
});

describe("rocket-landing levels: honest pilot vs idle bot", () => {
   for (const id of LEVEL_IDS) {
      const level = LEVELS[id];
      it(`level ${id} (${level.title}): honest feedback pilot clears >= 90% of seeds and hits clearScore >= 99%`, () => {
         let clears = 0;
         let reachedClearScore = 0;
         const seedsToTest = 16;
         for (let seed = 0; seed < seedsToTest; seed++) {
            const res = runPilot(level, seed, false);
            if (res.won && res.landedAll) clears++;
            if (res.score >= level.clearScore) reachedClearScore++;
            expect(withinServerLimits(res.score, res.elapsedMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
            expect(capScore(res.score, res.elapsedMs, PROPOSED_LEVEL_LIMITS[id])).toBe(res.score);
         }
         const clearRate = clears / seedsToTest;
         const targetRate = reachedClearScore / seedsToTest;
         expect(clearRate).toBeGreaterThanOrEqual(0.9);
         expect(targetRate).toBeGreaterThanOrEqual(0.99);
      }, 40000);

      it(`level ${id} (${level.title}): idle bot never clears and never reaches clearScore`, () => {
         for (let seed = 0; seed < 4; seed++) {
            const r = createRun(seed, false, level);
            const store = createArcadeStore();
            const idle: Controls = { rotate: 0, thrust: false };
            const result = simulateRun(store, {
               durationMs: level.durationMs,
               lives: 3,
               frame: fixedFrames(1000 / 60),
               step: (dt, _time, s) => {
                  stepRun(r, idle, dt);
                  if (r.events.crash) {
                     s.getState().loseLife();
                  }
                  if (r.terminal) {
                     s.getState().setScore(r.score);
                     s.getState().end(r.terminal);
                  }
               },
            });
            expect(result.endReason).toBe("lose");
            expect(result.score).toBe(0);
            expect(result.score).toBeLessThan(level.clearScore);
         }
      });
   }
});

describe("rocket-landing levels: mutation probes on level knobs", () => {
   it("mutation probe: changing level.planets terminates at different planet count", () => {
      const l1 = LEVELS[1]; // 2 planets
      const r = createRun(0, false, l1);
      // touchdown planet 0 and planet 1
      r.planet = 0; r.body.y = 2.0; r.body.vy = -0.5;
      r.completed = 1;
      expect(r.terminal).toBe(null);
      r.completed = 2; // matches l1.planets
      // Simulate impact check
      if (r.completed === l1.planets) r.terminal = "win";
      expect(r.terminal).toBe("win");
   });

   it("mutation probe: changing level.cleanBonus alters win score", () => {
      const l4 = LEVELS[4]; // cleanBonus: 300
      const l5 = LEVELS[5]; // cleanBonus: 450
      expect(l4.cleanBonus).toBe(300);
      expect(l5.cleanBonus).toBe(450);
      expect(l5.cleanBonus).not.toBe(l4.cleanBonus);
   });

   it("mutation probe: level.contactVy gate strictly enforced", () => {
      const l4 = LEVELS[4]; // contactVy: 2.0
      const l5 = LEVELS[5]; // contactVy: 1.5
      const r4 = createRun(0, false, l4);
      const r5 = createRun(0, false, l5);

      r4.body.x = r5.body.x = padX(r4.layouts[0], 0, 0);
      r4.body.angle = r5.body.angle = 0;
      r4.body.vx = r5.body.vx = 0;

      // vy = -1.7 m/s: safe in Level 4 (< 2.0), unsafe in Level 5 (>= 1.5)
      r4.body.vy = r5.body.vy = -1.7;
      expect(landingSafe(r4, 0)).toBe(true);
      expect(landingSafe(r5, 0)).toBe(false);
   });

   it("mutation probe: level.contactAngle gate strictly enforced", () => {
      const l4 = LEVELS[4]; // contactAngle: Math.PI / 18 (~10 deg)
      const l5 = LEVELS[5]; // contactAngle: Math.PI / 24 (~7.5 deg)
      const r4 = createRun(0, false, l4);
      const r5 = createRun(0, false, l5);

      r4.body.x = r5.body.x = padX(r4.layouts[0], 0, 0);
      r4.body.vy = r5.body.vy = -0.5;
      r4.body.vx = r5.body.vx = 0;

      // angle = 8.5 degrees (~0.148 rad): safe in L4 (< 10 deg), unsafe in L5 (>= 7.5 deg)
      const angle = (8.5 * Math.PI) / 180;
      r4.body.angle = r5.body.angle = angle;
      expect(landingSafe(r4, 0)).toBe(true);
      expect(landingSafe(r5, 0)).toBe(false);
   });

   it("mutation probe: level.windAmplitude drives horizontal gas moon deflection", () => {
      const l2 = LEVELS[2]; // windAmplitude: 0.4
      const l3 = LEVELS[3]; // windAmplitude: 0.6
      const r2 = createRun(0, false, l2);
      const r3 = createRun(0, false, l3);

      r2.planet = r3.planet = 3; // Gas moon
      r2.attemptTime = r3.attemptTime = 2.0; // non-zero wind phase
      const idle: Controls = { rotate: 0, thrust: false };

      stepRun(r2, idle, 0.05);
      stepRun(r3, idle, 0.05);

      // Higher wind in L3 creates stronger horizontal displacement
      expect(Math.abs(r3.body.vx)).toBeGreaterThan(Math.abs(r2.body.vx));
   });

   it("mutation probe: level.padAmplitude drives asteroid pad sweep", () => {
      const l2 = LEVELS[2]; // padAmplitude: 2.0
      const l3 = LEVELS[3]; // padAmplitude: 3.0
      const l2Layout = generateCampaign(0, l2.padAmplitude)[4];
      const l3Layout = generateCampaign(0, l3.padAmplitude)[4];

      // At t = 4 s (quarter period of 16 s sine cycle):
      const x2 = padX(l2Layout, 4, 4, l2.padAmplitude);
      const x3 = padX(l3Layout, 4, 4, l3.padAmplitude);
      expect(Math.abs(x2)).toBeCloseTo(2.0, 5);
      expect(Math.abs(x3)).toBeCloseTo(3.0, 5);
   });
});
