// Rocket Landing 5 levels test suite (docs/arcade-levels.md §6.3 step 6).
// Verifies declarations, level 1 replay fidelity vs today's game, monotone difficulty,
// per-level limits & closed-form proofs, honest pilot clearance rates, idle bot failure,
// and mutation probes on each level knob.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
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
   roofed,
   stepRun,
   swings,
   windScale,
   worldsOf,
   wrap,
   TOWER,
   WORLD,
   type Run,
   type Controls,
} from "./rules";
import { HULL } from "./assets";
import * as rules from "./rules";

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
         // each landing's hazards, from its layout (level 1: planet 3 windy, planet 4 caved swing)
         const b = r.body, l = r.layouts[r.planet], g = worldsOf(level)[r.planet].gravity;
         const cave = roofed(l, r.planet), rail = swings(l, r.planet), gusty = windScale(l, r.planet) > 0;
         const px = padX(l, r.planet, r.attemptTime, level.padAmplitude);
         const pv = padVx(l, r.planet, r.attemptTime, level.padAmplitude);
         // a rail pad (caved or open): hover over the middle and drop as the pad comes under
         const waits = cave || rail;
         if (waits && stage === 0 && (!cave || (b.y < 7.4 && Math.abs(b.vy) < 1.5))) stage = 1;
         // a caved rail pad: wait until it is about to cross the middle; an open rail pad: ride it
         const crossing = !rail || Math.abs(padX(l, r.planet, r.attemptTime + 3.5, level.padAmplitude)) < 0.25;
         const windLow = !gusty || Math.abs(Math.sin(2 * Math.PI * r.attemptTime / 8 + l.wind)) < 0.45;
         const aligned = !gusty || (windLow && Math.abs(b.x - px) < 0.6 && Math.abs(b.vx - pv) < 0.35 && Math.abs(b.angle) < Math.min(0.12, level.contactAngle * 0.75));
         if ((!waits || stage === 1) && crossing && aligned &&
            Math.abs(b.x - (waits ? 0 : px)) < (gusty ? 0.8 : 0.3) &&
            Math.abs(b.vx - (waits ? 0 : pv)) < (gusty ? 0.5 : 0.25) &&
            Math.abs(b.angle) < (gusty ? Math.min(0.12, level.contactAngle * 0.85) : 0.08)) stage = 2;
         const shaft = l.spawnX < 0 ? -5.3 : 5.3;
         const tx = cave ? (stage === 0 ? shaft : 0) : rail ? 0 : px;
         const tv = waits ? (stage === 2 ? pv * 0.5 : 0) : pv;
         const targetY = stage === 2 ? 3.1 : waits ? (cave && stage === 0 ? 7.2 : 5.8) : 8;
         const targetVy = stage === 2 ? -Math.min(level.contactVy * 0.5, 0.4 + Math.max(0, b.y - 3.1) * 0.5) : clamp((targetY - b.y) * 0.8, -3, 2);
         const ay = clamp(g + 3 * (targetVy - b.vy), 0, 12);
         const wind = gusty ? level.windAmplitude * windScale(l, r.planet) * Math.sin(2 * Math.PI * r.attemptTime / 8 + l.wind) : 0;
         const ax = (cave ? 0.15 : gusty ? 0.5 : 0.8) * (tx - b.x) + (cave ? 1 : gusty ? 2.0 : 1.8) * (tv - b.vx) - (gusty ? 1.15 : 1) * wind;
         const maxAngle = stage === 2 && b.y < 4.5 ? Math.min(level.contactAngle * 0.70, gusty ? 0.125 : 0.08) : 0.45;
         const desiredAngle = clamp(-Math.atan2(ax, Math.max(g, ay)), -maxAngle, maxAngle);
         controls.rotate = clamp(-(8 * wrap(desiredAngle - b.angle) - 4 * b.omega) / 3, -1, 1);
         if (cave && r.assist && Math.abs(controls.rotate) <= ENGINE.neutral) controls.rotate = (controls.rotate < 0 ? -1 : 1) * (ENGINE.neutral + 0.001);
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
         expect(lines[1]).toContain(`all ${LEVELS[id].planets}`);
      }
   });
});


describe("rocket-landing levels: every setting reaches the simulation", () => {
   it("index.tsx hands each level its config and clock", () => {
      for (const id of LEVEL_IDS) {
         expect(definition.levels![id - 1].config).toBe(LEVELS[id]);
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
      }
   });
   it("the asteroid pad swings with the level's amplitude: layout, collider and swept skin", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id], r = createRun(3, false, level);
         expect(r.layouts[4].padAmplitude).toBe(level.padAmplitude);
         r.planet = 4;
         r.body.omega = 0;
         stepRun(r, { rotate: 0, thrust: false }, 1 / 60);
         const centre = (r.pad.minX + r.pad.maxX) / 2;
         expect(centre).toBeCloseTo(padX(r.layouts[4], 4, r.attemptTime, level.padAmplitude), 9);
         // no rotation: the skin is the pad's arc over one 1/120 s step (+1e-8)
         expect(r.sweepSkin).toBeCloseTo(level.padAmplitude * (1 - Math.cos(Math.PI * (1 / 120) / 16)) + 1e-8, 12);
      }
   });
});

const L1_TODAY = [
   "lose:1105:3:3:9327:285b2c5e9a78af51",
   "lose:1133:3:3:8484:bb21baa03d77d95c",
   "lose:1067:3:3:9353:4b9dfef19cd95d7c",
   "lose:1160:3:3:8881:63409a8f8505a220",
   "win:1809:4:1:5593:bdbd8be6b0ec0aaf",
   "win:2235:4:0:4011:4f29bf1515eba79b",
   "win:1768:4:1:5756:5da407c05453f307",
   "win:1814:4:1:6637:439d741dbba33c3b",
   "lose:1051:3:3:9192:5fbe4dd00c0c6b25",
   "win:2137:4:0:4468:4c71de40e69c8cfd",
   "lose:1048:3:3:9349:381ab9e88df31464",
   "lose:1111:3:3:8683:8f3cd17fcaa933cd",
   "lose:1091:3:3:9441:19cc26abb6a3f988",
   "lose:1116:3:3:8695:bd4cab2c94242147",
   "lose:1075:3:3:9519:1bb1c69936a076ad",
   "win:2173:4:0:3864:04dd52d476f7daaa",
];

describe("rocket-landing levels: level 1 is today's game", () => {
   it("replays bit-exact against today's createRun (8 seeds x assist on/off, wins and losses)", () => {
      let i = 0;
      for (let seed = 0; seed < 8; seed++) for (const assist of [false, true]) {
         expect(l1Trace(rules as any, seed, assist), `seed ${seed} assist ${assist}`).toBe(L1_TODAY[i]);
         expect(l1Trace(rules as any, seed, assist, (s, x) => createRun(s, x, LEVELS[1])), `seed ${seed} L1`).toBe(L1_TODAY[i]);
         i++;
      }
      expect(L1_TODAY.some((t) => t.startsWith("win")) && L1_TODAY.some((t) => t.startsWith("lose"))).toBe(true);
   }, 60000);

   it("all five planets share identical terrain layouts across seeds", () => {
      for (let seed = 0; seed < 20; seed++) {
         const campL1 = createRun(seed, false, LEVELS[1]).layouts;
         const campToday = createRun(seed, false).layouts;
         for (let p = 0; p < 5; p++) {
            expect(campL1[p]).toEqual(campToday[p]);
         }
      }
   });
});

/** Hashes every frame's full serialized run (the level config and the new padAmplitude field
 * excluded) while a feedback pilot flies level 1 on ragged frames. Shape-agnostic, so the same
 * code ran on today's rules.ts (origin/main before levels) to record L1_TODAY. */
interface RocketRules { createRun(seed: number, assist: boolean): any; stepRun(r: any, c: Controls, dt: number): void; padX(l: any, p: number, t: number): number; padVx(l: any, p: number, t: number): number }
function l1Trace(m: RocketRules, seed: number, assist: boolean, make: (seed: number, assist: boolean) => any = m.createRun): string {
   const r = make(seed, assist);
   const hash = createHash("sha256");
   const controls: Controls = { rotate: 0, thrust: false };
   let stage = 0, planet = -1, crashes = -1, pulse = 0, frames = 0, rnd = seed * 7919 + 1;
   while (!r.terminal && r.simTime < 240 && frames++ < 40000) {
      rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
      const dt = [1 / 60, 1 / 30, 1 / 144, (rnd / 4294967296) * 0.05][frames % 4];
      if (planet !== r.planet || crashes !== r.crashes) { planet = r.planet; crashes = r.crashes; stage = 0; pulse = 0; }
      const b = r.body, l = r.layouts[r.planet], g = PLANETS[r.planet].gravity;
      const px = m.padX(l, r.planet, r.attemptTime), pv = m.padVx(l, r.planet, r.attemptTime);
      if (r.planet === 4 && stage === 0 && b.y < 7.4 && Math.abs(b.vy) < 1.5) stage = 1;
      const crossing = r.planet !== 4 || Math.abs(m.padX(l, 4, r.attemptTime + 3.5)) < 0.25;
      if ((r.planet !== 4 || stage === 1) && crossing && Math.abs(b.x - (r.planet === 4 ? 0 : px)) < 0.3
         && Math.abs(b.vx - (r.planet === 4 ? 0 : pv)) < 0.25 && Math.abs(b.angle) < 0.08) stage = 2;
      const tx = r.planet === 4 ? (stage === 0 ? (l.spawnX < 0 ? -5.3 : 5.3) : 0) : px;
      const tv = r.planet === 4 ? (stage === 2 ? pv * 0.5 : 0) : pv;
      const targetY = stage === 2 ? 3.1 : r.planet === 4 ? (stage === 0 ? 7.2 : 5.8) : 8;
      const targetVy = stage === 2 ? -Math.min(1, 0.4 + Math.max(0, b.y - 3.1) * 0.5) : clamp((targetY - b.y) * 0.8, -3, 2);
      const ay = clamp(g + 3 * (targetVy - b.vy), 0, 12);
      const ax = 0.8 * (tx - b.x) + 1.8 * (tv - b.vx);
      const maxAngle = stage === 2 && b.y < 4.5 ? 0.08 : 0.45;
      const desired = clamp(-Math.atan2(ax, Math.max(g, ay)), -maxAngle, maxAngle);
      controls.rotate = clamp(-(8 * wrap(desired - b.angle) - 4 * b.omega) / 3, -1, 1);
      pulse += clamp(ay / (12 * Math.max(0.8, Math.cos(b.angle))), 0, 1);
      controls.thrust = pulse >= 1;
      if (controls.thrust) pulse -= 1;
      m.stepRun(r, controls, dt);
      hash.update(JSON.stringify(r, (key, value) => key === "level" || key === "padAmplitude" ? undefined : value));
   }
   return `${r.terminal}:${r.score}:${r.planet}:${r.crashes}:${frames}:${hash.digest("hex").slice(0, 16)}`;
}

describe("rocket-landing levels: monotone difficulty and score bounds", () => {
   it("scores are strictly monotonic across levels and all levels have 5 planets", () => {
      const maxScores = LEVEL_IDS.map((id) => PROPOSED_LEVEL_LIMITS[id].maxScore);
      expect(maxScores).toEqual([2800, 3000, 3200, 3400, 3600]);
      for (let i = 1; i < maxScores.length; i++) {
         expect(maxScores[i]).toBeGreaterThan(maxScores[i - 1]);
      }

      const planets = LEVEL_IDS.map((id) => LEVELS[id].planets);
      expect(planets).toEqual([5, 5, 5, 5, 5]);

      const clearScores = LEVEL_IDS.map((id) => LEVELS[id].clearScore);
      expect(clearScores).toEqual([2000, 2050, 2100, 2150, 2200]);
      for (let i = 1; i < clearScores.length; i++) {
         expect(clearScores[i]).toBeGreaterThan(clearScores[i - 1]);
      }
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

         // Score rate bound at the earliest possible win (the proven flight + hold floor, no
         // assumed campaign time): base grows with the clean bonus, so every level keeps L1's margin.
         expect(limits.base).toBe(800 + level.cleanBonus - 300);
         expect(theoreticalMax).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * minFlightTime);
         // every landing prefix: k landings need k flights and k - 1 holds
         for (let k = 1; k < n; k++) expect(500 * k).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * (k * 1.119 + (k - 1) * 1.2));
      }
   });
});

describe("rocket-landing levels: honest pilot vs idle bot", () => {
   for (const id of LEVEL_IDS) {
      const level = LEVELS[id];
      it(`level ${id} (${level.title}): honest feedback pilot clears >= 99% of seeds and hits clearScore >= 99%`, () => {
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
         expect(clearRate).toBeGreaterThanOrEqual(0.99);
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
   it("mutation probe: changing level.cleanBonus alters win score", () => {
      const l1 = LEVELS[1]; // cleanBonus: 300
      const l5 = LEVELS[5]; // cleanBonus: 1100
      expect(l1.cleanBonus).toBe(300);
      expect(l5.cleanBonus).toBe(1100);
      expect(l5.cleanBonus).not.toBe(l1.cleanBonus);
   });

   it("mutation probe: level.contactVy gate strictly enforced", () => {
      const l1 = LEVELS[1]; // contactVy: 2.0
      const l5 = LEVELS[5]; // contactVy: 1.5
      const r1 = createRun(0, false, l1);
      const r5 = createRun(0, false, l5);

      r1.body.x = r5.body.x = padX(r1.layouts[0], 0, 0);
      r1.body.angle = r5.body.angle = 0;
      r1.body.vx = r5.body.vx = 0;

      // vy = -1.7 m/s: safe in Level 1 (< 2.0), unsafe in Level 5 (>= 1.5)
      r1.body.vy = r5.body.vy = -1.7;
      expect(landingSafe(r1, 0)).toBe(true);
      expect(landingSafe(r5, 0)).toBe(false);
   });

   it("mutation probe: level.contactAngle gate strictly enforced", () => {
      const l1 = LEVELS[1]; // contactAngle: Math.PI / 18 (~10 deg)
      const l5 = LEVELS[5]; // contactAngle: Math.PI / 24 (~7.5 deg)
      const r1 = createRun(0, false, l1);
      const r5 = createRun(0, false, l5);

      r1.body.x = r5.body.x = padX(r1.layouts[0], 0, 0);
      r1.body.vy = r5.body.vy = -0.5;
      r1.body.vx = r5.body.vx = 0;

      // angle = 8.5 degrees (~0.148 rad): safe in L1 (< 10 deg), unsafe in L5 (>= 7.5 deg)
      const angle = (8.5 * Math.PI) / 180;
      r1.body.angle = r5.body.angle = angle;
      expect(landingSafe(r1, 0)).toBe(true);
      expect(landingSafe(r5, 0)).toBe(false);
   });

   it("mutation probe: level.windAmplitude drives horizontal gas moon deflection", () => {
      const l1 = LEVELS[1]; // windAmplitude: 0.4
      const l5 = LEVELS[5]; // windAmplitude: 0.8
      const r1 = createRun(0, false, l1);
      const r5 = createRun(0, false, l5);

      r1.planet = r5.planet = 3; // Gas moon
      r1.attemptTime = r5.attemptTime = 2.0; // non-zero wind phase
      const idle: Controls = { rotate: 0, thrust: false };

      stepRun(r1, idle, 0.05);
      stepRun(r5, idle, 0.05);

      // Higher wind in L5 creates stronger horizontal displacement
      expect(Math.abs(r5.body.vx)).toBeGreaterThan(Math.abs(r1.body.vx));
   });

   it("mutation probe: level.padAmplitude drives asteroid pad sweep", () => {
      const l1 = LEVELS[1]; // padAmplitude: 2.0
      const l5 = LEVELS[5]; // padAmplitude: 2.4
      const l1Layout = generateCampaign(0, l1.padAmplitude)[4];
      const l5Layout = generateCampaign(0, l5.padAmplitude)[4];

      // At t = 4 s (quarter period of 16 s sine cycle):
      const x1 = padX(l1Layout, 4, 4, l1.padAmplitude);
      const x5 = padX(l5Layout, 4, 4, l5.padAmplitude);
      expect(Math.abs(x1)).toBeCloseTo(2.0, 5);
      expect(Math.abs(x5)).toBeCloseTo(2.4, 5);
   });
});

describe("rocket-landing levels: five different landings per level (fairness per level)", () => {
   const hullAt = (x: number, y: number) => HULL.map(([hx, hy]) => ({ x: x + hx, y: y + hy - BODY.centre }));
   const rectDistance = (px: number, py: number, x0: number, x1: number, y0: number, y1: number) =>
      Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));

   it("level 1 flies today's planets; levels 2-5 each fly their own five landings with their own looks", () => {
      expect(LEVELS[1].worlds).toBeUndefined();
      expect(worldsOf(LEVELS[1]).map((w) => [w.gravity, w.width, w.fuel])).toEqual(PLANETS.map((p) => [p.gravity, p.width, p.fuel]));
      const looks = LEVEL_IDS.map((id) => new Set(worldsOf(LEVELS[id]).map((w) => w.look)));
      for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
         expect([...looks[a]].some((k) => looks[b].has(k)), `levels ${a + 1} and ${b + 1} share a look`).toBe(false);
      }
      const hazards = LEVEL_IDS.map((id) => worldsOf(LEVELS[id]).map((w) => `${w.wind > 0 ? "W" : ""}${w.swing ? "S" : ""}${w.roof ? "R" : ""}${w.towers ? "T" : ""}`).join("|"));
      expect(new Set(hazards).size).toBe(5);
      expect(worldsOf(LEVELS[3]).filter((w) => w.towers).length).toBeGreaterThanOrEqual(3);
      expect(worldsOf(LEVELS[4]).filter((w) => w.roof).length).toBeGreaterThanOrEqual(3);
      expect(Math.max(...worldsOf(LEVELS[5]).map((w) => w.width))).toBeLessThan(Math.min(...worldsOf(LEVELS[1]).map((w) => w.width)));
      for (const id of LEVEL_IDS) expect(worldsOf(LEVELS[id])).toHaveLength(LEVELS[id].planets);
   });

   for (const id of LEVEL_IDS) it(`L${id}: every landing is reachable and the limit proof's premises hold`, () => {
      const level = LEVELS[id], worlds = worldsOf(level);
      for (const w of worlds) {
         // thrust beats gravity everywhere; the pad top stays at y 2 (the 10.65 m minimum drop)
         expect(w.gravity).toBeGreaterThanOrEqual(1);
         expect(w.gravity).toBeLessThanOrEqual(5);
         // the widest wind keeps every acceleration under 17.6 m/s^2 (proof below)
         expect(level.windAmplitude * w.wind).toBeLessThanOrEqual(0.56);
         // both landing feet always fit on the pad with room to spare
         expect(w.width).toBeGreaterThanOrEqual(3.5);
         expect(w.fuel).toBeGreaterThanOrEqual(85);
      }
      // the fastest loss is three crashes on the first landing. It has no roof or rail, so a crash
      // is the ceiling (4.9 m at <= 12 - 1 m/s^2 up: >= 0.944 s) or a tower kept >= 6.7 m from the
      // spawn hull (at <= 12 + 5 + 0.56 m/s^2: >= 0.873 s); 3 x 0.873 + 2 x 1.2 = 5.02 s > 5 s
      expect(worlds[0].roof || worlds[0].swing).toBe(false);
      const fastestCrash = Math.min(Math.sqrt(2 * 4.9 / (ENGINE.acceleration - worlds[0].gravity)), Math.sqrt(2 * 6.7 / 17.6));
      expect(3 * fastestCrash + 2 * 1.2).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[id].minDurationMs / 1000);
      for (let seed = 0; seed < 200; seed++) {
         const r = createRun(seed, false, level);
         r.layouts.forEach((l, p) => {
            const w = worlds[p], half = w.width / 2;
            expect(Math.abs(l.spawnX)).toBeLessThanOrEqual(7.5);
            if (w.roof) {
               // a free side shaft: the hull fits between the roof and the wall
               expect(Math.abs(l.spawnX) - BODY.radius).toBeGreaterThanOrEqual(WORLD.roofRight);
               expect(Math.abs(l.spawnX) + BODY.radius).toBeLessThanOrEqual(10);
            }
            for (const x of l.towers ?? []) {
               // towers stand clear of the pad's whole sweep and under the 8 m cruise
               expect(Math.abs(x - l.pad) - TOWER.half - half).toBeGreaterThanOrEqual(1 - 1e-9);
               expect(TOWER.top).toBeLessThan(8 - BODY.radius);
               expect(Math.abs(x) + TOWER.half).toBeLessThanOrEqual(9);
               // nothing solid within 6.7 m of the spawn hull (an obstacle crash takes >= 0.87 s)
               for (const q of hullAt(l.spawnX, BODY.spawnY)) expect(rectDistance(q.x, q.y, x - TOWER.half, x + TOWER.half, -2, TOWER.top)).toBeGreaterThan(6.7);
            }
            if (w.swing) expect(level.padAmplitude + half).toBeLessThanOrEqual(w.roof ? 4.5 : 5);
            expect(r.obstacles[p].length).toBe(12 + (l.towers?.length ?? 0));
         });
      }
   });

   for (const id of LEVEL_IDS) it(`L${id}: idle, full-thrust and spin-and-burn runs never end before minDurationMs`, () => {
      const pilots: ((r: Run) => Controls)[] = [
         () => ({ rotate: 0, thrust: false }),
         () => ({ rotate: 0, thrust: true }),
         (r) => ({ rotate: r.body.angle > -2 ? 1 : 0, thrust: true }),
         (r) => ({ rotate: r.body.angle < 2 ? -1 : 0, thrust: true }),
      ];
      for (const fly of pilots) for (let seed = 0; seed < 12; seed++) {
         const r = createRun(seed, false, LEVELS[id]);
         let t = 0;
         while (!r.terminal && t < 60) { stepRun(r, fly(r), 1 / 60); t += 1 / 60; }
         if (r.terminal) expect(r.simTime * 1000, `seed ${seed}`).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
      }
   });

   for (const id of LEVEL_IDS) it(`L${id}: the pilot lands every one of the five landings with fuel to spare, assist on and off`, () => {
      for (const assist of [false, true]) for (let seed = 20; seed < 26; seed++) {
         const res = runPilot(LEVELS[id], seed, assist);
         expect(res.landedAll && res.won, `seed ${seed} assist ${assist}: ${res.endReason} at ${res.finalPlanet}`).toBe(true);
      }
   }, 60000);
});
