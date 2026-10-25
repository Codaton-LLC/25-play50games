import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { definitionLevelProblems, isLevelCleared, levelHudStats } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { rngNext } from "@/arcade3d/core/math";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { spaceRepairMeta as meta } from "./meta";
import { createRun, stepRun, MODULES, PROPOSED_LEVEL_LIMITS, BREAKS, REPAIR, CLOCK, DEBRIS, type Controls, type Run } from "./rules";
import * as today from "./today.rules.fixture";
import definition from "./index";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

type Policy = "OracleRepair" | "HumanPacedRepair" | "GreedyRepair" | "Idle" | "BlindSpam20Hz" | "HoldRepair" | "CampOneModule" | "ConstantThrustSpin";
function bot(policy: Policy, seed: number) {
   const rng = { s: seed || 1 }, controls: Controls = { x: 0, z: 0, repair: false };
   let target = -1, ticket = -2, reactUntil = 0, settleUntil = 0, settled = -2, missed = -2, waitUntil = 0, bucket = -1, frames = 0;
   const metrics = { trips: 0, travel: 0, services: 0, service: 0, topSpeed: 0 };
   let tripAt = 0, serviceAt = 0;
   const drive = (r: Run, dt: number): Controls => {
      controls.x = 0; controls.z = 0; controls.repair = false; frames++;
      metrics.topSpeed = Math.max(metrics.topSpeed, Math.hypot(r.body.vx, r.body.vz));
      if (policy === "Idle") return controls;
      if (policy === "HoldRepair") { controls.repair = frames === 1; return controls; }
      if (policy === "ConstantThrustSpin") { controls.x = Math.cos(r.time * 2); controls.z = Math.sin(r.time * 2); return controls; }
      if (policy === "BlindSpam20Hz") { const b = Math.floor((r.time + dt) * 20); controls.repair = b !== bucket; bucket = b; return controls; }
      if (r.events.award) {
         if (serviceAt > 0) { metrics.services++; metrics.service += r.time - serviceAt; }
         serviceAt = 0;
         if ((r.repairs === 4 || r.repairs === 12 || r.repairs === 20)) waitUntil = r.time + 0.35;
      }
      if (r.time < waitUntil) return controls;
      if (target < 0 || !r.modules[target].broken) {
         target = -1;
         for (let i = 0; i < 8; i++) {
            if (!r.modules[i].broken || policy === "CampOneModule" && i !== 0) continue;
            if (target < 0 || (policy === "GreedyRepair" ? Math.hypot(r.body.x - MODULES[i].dx, r.body.z - MODULES[i].dz) < Math.hypot(r.body.x - MODULES[target].dx, r.body.z - MODULES[target].dz) : r.modules[i].issued < r.modules[target].issued)) target = i;
         }
      }
      if (target < 0) return controls;
      const m = r.modules[target], human = policy === "HumanPacedRepair";
      if (ticket !== m.issued) {
         ticket = m.issued; reactUntil = r.time + (human ? 0.15 + rngNext(rng) * 0.1 : 0);
         tripAt = r.time; serviceAt = r.time;
      }
      if (r.time < reactUntil) return controls;
      if (r.docked !== target) {
         const p = MODULES[target], dx = p.dx - r.body.x, dz = p.dz - r.body.z, d = Math.hypot(dx, dz);
         const speed = Math.hypot(r.body.vx, r.body.vz), toward = d ? (dx * r.body.vx + dz * r.body.vz) / d : 0;
         const top = human ? 4.3 : policy === "GreedyRepair" ? 3.3 : 7;
         if (d > 0.06 && speed < top - 6 * dt && !(toward > 0 && speed * speed / 6 >= d - 0.05)) {
            controls.x = dx / d; controls.z = dz / d;
         }
         return controls;
      }
      if (settled !== ticket) {
         settled = ticket; settleUntil = r.time + (human ? 0.3 : 0);
         if (tripAt > 6.1 && target !== 0) { metrics.trips++; metrics.travel += r.time - tripAt; }
      }
      if (r.time < settleUntil || r.time < m.lockUntil) return controls;
      const next = ((r.needleAge + dt) / m.period) % 1, width = m.zones[0].end - m.zones[0].start;
      if (human && r.repairs % 4 === 3 && missed !== ticket) {
         if (next < m.zones[0].start || next > m.zones[0].end) { controls.repair = true; missed = ticket; }
         return controls;
      }
      const aim = human ? m.zones[0].start + width * 0.1 : m.centre - width / 6 + 0.002;
      controls.repair = next >= aim && next <= (human ? m.zones[0].end - width * 0.05 : m.centre + width / 6 - 0.001);
      // At 30 Hz a late fine-pointer perfect window can fall between two samples.
      // Take a legal good hit rather than waiting forever at a resonant frame rate.
      if (!human && next >= m.zones[0].start && next <= m.zones[0].end && next < aim && next + dt / m.period > m.centre + width / 6 - 0.001) controls.repair = true;
      if (!human && next > m.centre + width / 6 && next <= m.zones[0].end) controls.repair = true;
      return controls;
   };
   return { drive, metrics };
}

function replayState(r: Run | today.Run): string {
   // Exclude only the newly captured config and callback identity.
   return JSON.stringify(r, (key, value) => key === "level" || key === "integrate" ? undefined : value);
}

describe("space-repair five level declarations", () => {
   it("matches meta, definition, limits and HUD; all eight modules stay present", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         const run = createRun(1, LEVELS[id]);
         expect(run.level).toBe(LEVELS[id]); expect(run.modules).toHaveLength(8);
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(levelHudStats(definition, id)).toEqual([]);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(meta.scoring.maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * meta.scoring.maxScore);
   });
   it("keeps today's complete L1 config, including equal device arcs", () => {
      expect(LEVELS[1]).toEqual({ times: BREAKS.times, duration: CLOCK.duration, speeds: DEBRIS.speeds, periods: REPAIR.periods, arcs: REPAIR.fine, lock: REPAIR.lock });
      expect(REPAIR.fine).toEqual(REPAIR.coarse);
   });
   it("replays Level 1 against today's original engine frame for frame", () => {
      for (const seed of [0, 1, 12, 42, 0xffffffff]) for (const coarse of [false, true]) {
         for (const policy of ["HumanPacedRepair", "OracleRepair", "BlindSpam20Hz"] as const) {
            const old = today.createRun(seed, coarse), next = createRun(seed, LEVELS[1], coarse);
            const driver = bot(policy, seed), oldHash = createHash("sha256"), newHash = createHash("sha256");
            for (let frame = 0; frame < 2500 && !old.terminal; frame++) {
               const controls = driver.drive(next, 0.05);
               today.stepRun(old, controls, 0.05); stepRun(next, controls, 0.05);
               oldHash.update(replayState(old)); newHash.update(replayState(next));
            }
            expect(old.terminal).not.toBeNull(); expect(newHash.digest("hex")).toBe(oldHash.digest("hex"));
         }
      }
   }, 60000);
   it("increases pressure without reducing points or adding unsafe service discs", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4], b = LEVELS[id];
         expect(b.times).toEqual(a.times); expect(b.duration).toBe(a.duration);
         expect(b.lock).toBeGreaterThan(a.lock);
         for (let stage = 0; stage < 3; stage++) {
            expect(b.speeds[stage]).toBeGreaterThan(a.speeds[stage]);
            expect(b.arcs[stage]).toBeLessThan(a.arcs[stage]);
            expect(b.periods[stage]).toBe(a.periods[stage]);
         }
      }
      expect(7.6 * Math.cos(Math.PI / 32) - 6 - 0.6 - 0.45 - 0.25).toBeGreaterThan(0.06);
   });
   it("derives each ticket envelope, end bound and bonus ceiling independently", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id];
         for (const time of level.times) expect(level.times.filter((t) => t <= time).length * 150).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * time);
         expect(level.times.length * 150 + 200).toBe(limits.maxScore);
         // Before 36 s even six outstanding tickets drain only 90; then six drain 10 in 5/3 s.
         expect(level.times.slice(0, 6)).toEqual([6, 12, 18, 24, 30, 36]);
         expect(limits.minDurationMs).toBeLessThan((36 + 10 / 6) * 1000);
         expect(limits.maxDurationMs).toBeGreaterThan(level.duration * 1000 + 50);
      }
   });
   it("uses the selected periods, equal arcs, speeds and miss lock on both devices", () => {
      for (const id of LEVEL_IDS) for (const coarse of [false, true]) for (const t of [6, 40, 80]) {
         const r = createRun(1, LEVELS[id], coarse), stage = Math.floor(t / 40);
         r.time = t - 0.001; r.ticket = r.level.times.filter((x) => x < t).length;
         const before = r.debris[0].s;
         stepRun(r, { x: 0, z: 0, repair: false }, 0.001);
         const m = r.modules.find((m) => m.broken)!;
         expect(m.period).toBe(r.level.periods[stage]);
         expect((m.zones[0].end - m.zones[0].start) * 360).toBeCloseTo(r.level.arcs[stage], 9);
         expect(r.debris[0].s - before).toBeCloseTo(r.level.speeds[Math.floor((t - 0.001) / 40)] * 0.001, 8);
         const target = r.modules.indexOf(m); r.body.x = MODULES[target].dx; r.body.z = MODULES[target].dz;
         r.docked = target; r.needleAge = 0;
         stepRun(r, { x: 0, z: 0, repair: true }, 0.001);
         expect(r.events.miss).toBe(true); expect(m.lockUntil - r.time).toBeCloseTo(r.level.lock, 9);
      }
   });
});

for (const id of LEVEL_IDS) describe(`space-repair L${id} store proof`, () => {
   it("proves 200 seeds per policy on both devices, plus 30/60/144 Hz and random schedules", () => {
      const limits = PROPOSED_LEVEL_LIMITS[id], levelMeta = meta.levels![id - 1];
      const results: Record<string, { runs: number; clears: number; wins: number; best: number; minRepairs: number }> = {};
      for (const policy of ["OracleRepair", "HumanPacedRepair", "GreedyRepair", "Idle", "BlindSpam20Hz"] as const) {
         const result = results[policy] = { runs: 0, clears: 0, wins: 0, best: 0, minRepairs: 30 };
         for (let seed = 1; seed <= 200; seed++) for (const coarse of [false, true]) {
            const schedules = seed <= 8 ? [30, 60, 144, 0] : [policy === "OracleRepair" ? 60 : 20];
            for (const hz of schedules) {
               const r = createRun(seed, LEVELS[id], coarse), driver = bot(policy, seed), store = createArcadeStore();
               let valid = true;
               const final = simulateRun(store, { maxFrames: 31000, frame: hz ? fixedFrames(1000 / hz) : randomFrames(seed), step: (dt, _time, api) => {
                  stepRun(r, driver.drive(r, dt), dt);
                  const state = api.getState();
                  if (r.events.award) state.addScore(r.events.award);
                  if (r.terminal) { state.setScore(r.score); state.end(r.terminal); }
                  valid &&= state.score <= limits.maxScore && state.score <= limits.base! + limits.maxPointsPerSec! * state.elapsedMs / 1000 + 1e-7;
               } });
               expect(valid).toBe(true); expect(r.terminal).not.toBeNull();
               expect(final.score).toBe(r.score);
               expect(withinServerLimits(final.score, final.elapsedMs, limits)).toBe(true);
               expect(capScore(final.score, final.elapsedMs, limits)).toBe(final.score);
               result.runs++; result.best = Math.max(result.best, r.score); result.minRepairs = Math.min(result.minRepairs, r.repairs);
               if (r.terminal === "win") result.wins++;
               if (isLevelCleared(r.terminal, r.score, levelMeta)) result.clears++;
            }
         }
         if (policy === "OracleRepair") { expect(result.wins).toBe(result.runs); expect(result.best).toBeGreaterThanOrEqual(limits.maxScore * 0.9); }
         if (policy === "HumanPacedRepair") { expect(result.clears / result.runs).toBeGreaterThanOrEqual(0.99); expect(result.wins / result.runs).toBeGreaterThanOrEqual(0.9); expect(result.minRepairs).toBeGreaterThanOrEqual(24); }
         if (policy === "Idle" || policy === "BlindSpam20Hz") expect(result.clears).toBe(0);
      }
      console.info(`SPACE_LEVEL_${id}`, JSON.stringify(results));
   }, 300000);
});
