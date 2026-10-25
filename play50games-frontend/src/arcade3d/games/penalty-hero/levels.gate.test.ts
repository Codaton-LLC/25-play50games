// Gate pins (2026-10-25 review): each test kills a mutation the level suite let through.
import { describe, expect, it, vi } from "vitest";
import { LEVELS } from "./levels";
import definition from "./index";
import { RETICLE_AMPLITUDE, RETICLE_BAND, WIDE_X, WIND_PERIOD_S, ZONES, ZONE_CENTRE_X, createRun, isAccurate, levelReticleOffset, step, targetDrift, type RunState } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

/** Shoot `zone` once the ring is in the band; returns the keeper's dive index (or -1 on a timeout). */
function shoot(run: RunState, zone: number): number {
   for (let i = 0; i < 4000 && run.phase === "aim"; i++) {
      if (isAccurate(levelReticleOffset(run.aimMs, run.reticlePhase, run.config), run.config.reticleBand)) {
         step(run, 5, { zoneId: ZONES[zone] });
         if (run.phase !== "aim") break;
      } else step(run, 5);
   }
   const keeper = run.keeperIndex;
   for (let i = 0; i < 4000 && run.phase !== "aim" && !run.ended; i++) step(run, 20);
   return keeper;
}

describe("penalty-hero keeper read", () => {
   it("a level's read sends the keeper to the shot's zone (read 1 = every dive)", () => {
      const run = createRun(11, { ...LEVELS[5], keeperRead: 1 });
      for (let k = 0; k < 6; k++) expect(shoot(run, k)).toBe(k);
   });

   it("level 5's read makes the keeper guess the shot more often than level 1's draw alone", () => {
      const rate = (id: 1 | 5) => {
         let hits = 0, shots = 0;
         for (let seed = 0; seed < 60; seed++) {
            const run = createRun(seed, LEVELS[id]);
            for (let k = 0; k < 8; k++) { if (shoot(run, (seed + k) % 6) === (seed + k) % 6) hits++; shots++; }
         }
         return hits / shots;
      };
      const l1 = rate(1), l5 = rate(5);
      expect(l5 - l1).toBeGreaterThan(0.05);
   });
});

describe("penalty-hero level knobs reach the shot", () => {
   const lockAt = (id: 1 | 2 | 3 | 4 | 5, aimMs: number, zone = 4) => {
      const run = createRun(23, LEVELS[id]);
      step(run, aimMs);
      step(run, 1, { zoneId: ZONES[zone] });
      return run;
   };

   it("an accurate shot flies to the level's drifting target, not the zone centre", () => {
      for (let ms = 0; ms < 4000; ms += 10) {
         const run = createRun(23, LEVELS[2]);
         step(run, ms);
         if (!isAccurate(levelReticleOffset(run.aimMs + 1, run.reticlePhase, run.config), run.config.reticleBand)) continue;
         step(run, 1, { zoneId: ZONES[3] });
         const drift = targetDrift(run.aimMs, 3, 0, run.config);
         if (Math.abs(drift) < 0.05) continue;
         expect(run.targetX).toBeCloseTo(ZONE_CENTRE_X[0] + drift, 9);
         return;
      }
      throw new Error("no accurate drifted shot found");
   });

   it("the level's band judges the shot: an offset inside level 1's band but outside level 5's goes wide", () => {
      for (let ms = 0; ms < 6000; ms += 5) {
         const probe = createRun(23, LEVELS[5]);
         const off = Math.abs(levelReticleOffset(ms + 1, probe.reticlePhase, probe.config));
         if (off <= LEVELS[5].reticleBand + 0.01 || off >= RETICLE_BAND - 0.01) continue;
         const run = lockAt(5, ms);
         expect(run.targetX).toBe(Math.sign(run.reticle) * WIDE_X);
         return;
      }
      throw new Error("no offset between the bands found");
   });

   it("the ring follows the level's period and gust", () => {
      const phase = 0.7;
      for (const ms of [130, 610, 1777]) {
         const s = ms / 1000;
         const base = (period: number) => RETICLE_AMPLITUDE * Math.sin((2 * Math.PI * s) / period + phase);
         expect(levelReticleOffset(ms, phase, LEVELS[3])).toBeCloseTo(base(LEVELS[3].reticlePeriodS), 12);
         expect(levelReticleOffset(ms, phase, LEVELS[4])).toBeCloseTo(
            base(LEVELS[4].reticlePeriodS) + LEVELS[4].wind * Math.sin((2 * Math.PI * s) / WIND_PERIOD_S + phase * 1.3), 12);
      }
      expect(levelReticleOffset(610, phase, LEVELS[3])).not.toBeCloseTo(levelReticleOffset(610, phase, LEVELS[1]), 3);
   });

   it("a tap after the level's aim time is a timeout, not a shot", () => {
      const run = createRun(23, LEVELS[4]);
      step(run, LEVELS[4].aimTimeoutMs - 5);
      step(run, 20, { zoneId: ZONES[0] });
      expect(run.keeperIndex).toBe(-1);
   });

   it("the submitted score is capped by the picked level's limits", () => {
      const final = definition.finalScore!({ score: 3500, elapsedMs: 30_000, levelId: 5 } as never);
      expect(final.score).toBe(3500);
      expect(definition.finalScore!({ score: 3500, elapsedMs: 30_000, levelId: 1 } as never).score).toBe(1450);
   });
});

describe("penalty-hero striker on a longer level", () => {
   it("stays at the ball only after the level's last shot (shot 12 on level 2, not shot 10)", async () => {
      const { createStrikerFrame, strikerFrame } = await import("./strikerMotion");
      const holdOf = (shotsDone: number) => {
         const run = createRun(3, LEVELS[2]);
         run.shotsDone = shotsDone;
         run.phase = "hold";
         run.phaseMs = 10;
         run.pending.kind = "shot";
         return strikerFrame(run, createStrikerFrame()).stay;
      };
      expect(holdOf(9)).toBe(false);
      expect(holdOf(11)).toBe(true);
   });
});
