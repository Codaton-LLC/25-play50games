import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createGrid, findPath, fixedFrames, freeGrid, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { judgeTiming } from "@/arcade3d/core/hud/timingMath";
import { rngNext } from "@/arcade3d/core/math";
import { spaceRepairMeta } from "./meta";
import { createRun, stepRun, BREAKS, CELL, CLOCK, DEBRIS, MODULES, PROPOSED_LIMITS, REPAIR, SCORE, STATION, SUIT, clearance, needle, resolveContacts, stageAt, type Controls, type Run } from "./rules";

const idle = { x: 0, z: 0, repair: false };
describe("space repair contract", () => {
   it("pins the approved schedule, movement and proposed server limits", () => {
      expect(BREAKS.times).toEqual([6, 12, 18, 24, 30, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 83, 86, 89, 92, 95, 98, 101, 104, 107, 110, 113, 116, 119]);
      expect(CLOCK.duration).toBe(120);
      expect(SUIT).toMatchObject({ thrust: 6, brake: 3, speed: 7, radius: 0.45, deadZone: 0.12 });
      expect(PROPOSED_LIMITS).toEqual({ kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" });
      // the proven limits are the game's limits (arcade-games.json via registry.sync.test.ts)
      expect(spaceRepairMeta.scoring).toEqual(PROPOSED_LIMITS);
   });
   it("repeats a seeded run and loses no earlier than 37 2/3 seconds", () => {
      const a = createRun(12, false), b = createRun(12, false);
      for (let i = 0; i < 2400 && !a.terminal; i++) { stepRun(a, idle, 1 / 60); stepRun(b, idle, 1 / 60); }
      expect(a.time).toBeCloseTo(37 + 2 / 3, 7);
      expect(a.terminal).toBe("lose"); expect(a.score).toBe(0);
      expect(a.power).toBe(0); expect(a.body).toEqual(b.body);
      expect(a.modules).toEqual(b.modules);
   });
});

function advance(r: Run, seconds: number, controls = idle): void {
   let frames = 0;
   const maxFrames = Math.ceil(seconds / 0.05) + 1;
   while (seconds > 1e-10 && !r.terminal) {
      if (++frames > maxFrames) throw new Error(`space-repair advance: exceeded ${maxFrames} frames`);
      const dt = Math.min(seconds, 0.05); stepRun(r, controls, dt); seconds -= dt; }
}
function fixture(id = 0, time = 6, coarse = false): Run {
   const r = createRun(1, coarse); advance(r, 6);
   const source = r.modules[0]; source.broken = false;
   const m = r.modules[id]; m.broken = true; m.period = source.period;
   m.zones[0].start = source.zones[0].start; m.zones[0].end = source.zones[0].end;
   m.centre = source.centre; m.issued = 0; r.time = time;
   r.ticket = BREAKS.times.filter((t) => t <= time).length;
   r.body.x = MODULES[id].dx; r.body.z = MODULES[id].dz; r.docked = id;
   return r;
}
function press(r: Run, pos: number): void {
   const m = r.modules[r.docked]; r.needleAge = pos * m.period - 0.001;
   stepRun(r, { x: 0, z: 0, repair: true }, 0.001);
}
describe("seed, station and controller", () => {
   it("validates 1,000 seeded layouts and pins every random draw", () => {
      const grid = createGrid({ cell: 0.25, halfX: 10, halfZ: 10 });
      const free = freeGrid(grid, (x, z) => clearance(x, z) >= 0.45);
      for (const p of MODULES) {
         expect(clearance(p.dx, p.dz)).toBeGreaterThan(0.6);
         expect(findPath(grid, free, grid.node(0, 6), grid.node(p.dx, p.dz)).length).toBeGreaterThan(0);
      }
      for (let seed = 0; seed < 1000; seed++) {
         const a = createRun(seed), b = createRun(seed), rng = { s: (seed >>> 0) || 1 };
         expect(a.direction).toBe(rngNext(rng) < 0.5 ? -1 : 1);
         expect(a.modules).toEqual(b.modules);
         for (const m of a.modules) { expect(m.centre).toBe(0.5 + 0.05 * (2 * rngNext(rng) - 1)); expect(m.centre).toBeGreaterThanOrEqual(0.45); expect(m.centre).toBeLessThan(0.55); }
         for (let j = 0; j < 4; j++) expect(a.debris[j].s).toBeCloseTo(((j / 4 + 0.025 * (2 * rngNext(rng) - 1)) * a.debris[j].path.total + a.debris[j].path.total) % a.debris[j].path.total, 9);
      }
      for (const p of MODULES) {
         const next = MODULES[(p.id + 1) % 8];
         for (let k = 0; k <= 100; k++) expect(clearance(p.dx + (next.dx - p.dx) * k / 100, p.dz + (next.dz - p.dz) * k / 100)).toBeGreaterThan(0.45);
         expect(7.6 * Math.cos(Math.PI / 32) - 6 - 0.6 - 0.45 - 0.25).toBeGreaterThan(0.06);
      }
   });
   it("pins thrust, brake, trapezoidal displacement, diagonals and speed after impulses", () => {
      const r = createRun(1); r.body.x = 0; r.body.z = 8.5;
      stepRun(r, { x: 1, z: 0, repair: false }, 0.05);
      expect(r.body.vx).toBeCloseTo(0.3, 10); expect(r.body.x).toBeCloseTo(0.0075, 10);
      stepRun(r, idle, 0.05); expect(r.body.vx).toBeCloseTo(0.15, 10);
      stepRun(r, idle, 0.05); expect(r.body.vx).toBeCloseTo(0, 10);
      stepRun(r, idle, 0.05); expect(r.body.vx).toBe(0);
      r.body.vx = 7; r.body.vz = 7; stepRun(r, { x: 1, z: 1, repair: false }, 0.05);
      expect(Math.hypot(r.body.vx, r.body.vz)).toBeLessThanOrEqual(7.000000001);
      const q = createRun(1); q.body.z = 8.5;
      stepRun(q, { x: 0.12, z: 0, repair: false }, 0.05); expect(q.body.vx).toBe(0);
   });
   it("depenetrates interior/corners and lets outward thrust escape", () => {
      for (const [x, z] of [[0, 0], [0, 4.2], [8.1, 1], [-9.3, -1], [9.5, 0], [-9.5, 0], [9.7, 0], [-9.7, 0], [0.7, 4.2]]) {
         const r = createRun(1); r.body.x = x; r.body.z = z; r.body.vx = 0.2;
         expect(resolveContacts(r)).toBe(true); expect(clearance(r.body.x, r.body.z)).toBeGreaterThanOrEqual(0.45 - 1e-7);
         const dx = r.body.x - x, dz = r.body.z - z, length = Math.hypot(dx, dz) || 1;
         advance(r, 0.3, { x: dx / length, z: dz / length, repair: false });
         expect(Math.hypot(r.body.x - x, r.body.z - z)).toBeGreaterThan(Math.hypot(dx, dz));
      }
      const r = createRun(1); r.body.x = 9.7; r.body.vx = 2;
      resolveContacts(r); expect(r.body.x).toBe(9.55); expect(r.body.vx).toBe(-1);
   });
   it("does not tunnel through modules and bounds all seeded movement", () => {
      const r = createRun(4), rng = { s: 14 };
      r.body.x = -1.3; r.body.z = 4.2; r.body.vx = 7;
      stepRun(r, { x: 1, z: 0, repair: false }, 0.05);
      expect(r.body.x).toBeLessThan(-1.05); expect(r.wobbleUntil).toBeGreaterThan(0.49);
      let legal = true;
      for (let i = 0; i < 4096 && !r.terminal; i++) {
         stepRun(r, { x: rngNext(rng) * 2 - 1, z: rngNext(rng) * 2 - 1, repair: false }, 0.008);
         legal &&= clearance(r.body.x, r.body.z) >= 0.45 - 1e-6 && Math.hypot(r.body.vx, r.body.vz) <= 7 + 1e-9;
      }
      expect(legal).toBe(true);
   });
   it("docks only neutral and slow, without snapping, and unlatches on thrust", () => {
      const r = fixture(); r.body.x = 0.6; r.body.vx = 0; r.docked = -1;
      stepRun(r, idle, 0.001); expect(r.docked).toBe(0); expect(r.body.x).toBe(0.6);
      stepRun(r, { x: 0.121, z: 0, repair: true }, 0.001); expect(r.docked).toBe(-1); expect(r.score).toBe(0);
      r.body.x = 0.601; r.body.vx = 0; stepRun(r, idle, 0.001); expect(r.docked).toBe(-1);
      r.body.x = 0; r.body.vx = 1.1; stepRun(r, idle, 0.001); expect(r.docked).toBe(-1);
   });
});

describe("repair generations, timing and power", () => {
   it("snapshots stage periods and pins equal arc widths on both touch and keyboard", () => {
      expect(REPAIR.fine).toEqual([60, 45, 35]);
      expect(REPAIR.coarse).toEqual([60, 45, 35]);
      for (const coarse of [false, true]) for (const [time, period, width] of [[6, 1.2, 60], [40, 1, 45], [80, 0.8, 35]]) {
         const r = createRun(1, coarse); r.time = time - 0.001; r.ticket = BREAKS.times.filter((t) => t < time).length;
         stepRun(r, idle, 0.001); const id = ((r.direction * (r.ticket - 1)) % 8 + 8) % 8, m = r.modules[id];
         expect(m.period).toBe(period); expect((m.zones[0].end - m.zones[0].start) * 360).toBeCloseTo(width, 9);
         expect(m.zones[0].start).toBeGreaterThanOrEqual(0.325); expect(m.zones[0].end).toBeLessThanOrEqual(0.675);
      }
   });
   it("pays once per complete 1/2/3-pip generation, never per hit", () => {
      for (const id of [0, 2, 7]) {
         const r = fixture(id), m = r.modules[id];
         for (let j = 0; j < REPAIR.hits[id]; j++) {
            press(r, m.centre);
            expect(r.score).toBe(j === REPAIR.hits[id] - 1 ? 150 : 0);
            expect(r.needleAge).toBe(0);
         }
         expect(r.repairs).toBe(1); expect(r.perfectRepairs).toBe(1); expect(r.events.award).toBe(150);
         stepRun(r, { x: 0, z: 0, repair: true }, 0.001); expect(r.score).toBe(150);
      }
      expect(SCORE).toEqual({ repair: 100, perfect: 50, power: 2 });
   });
   it("pins perfect third and one edge per frame regardless of substeps", () => {
      const r = fixture(7), m = r.modules[7], z = m.zones[0], width = z.end - z.start;
      press(r, z.start + 0.01); expect(m.hits).toBe(1); expect(m.perfect).toBe(false);
      stepRun(r, { x: 0, z: 0, repair: true }, 0.05); expect(m.hits).toBe(1); expect(r.events.miss).toBe(true);
      const a = fixture(), p = a.modules[0]; press(a, p.centre - (p.zones[0].end - p.zones[0].start) * 0.16);
      expect(a.score).toBe(150);
      expect(judgeTiming(m.centre - width / 6 + 1e-8, m.zones, 1 / 3)).toBe("perfect");
      expect(judgeTiming(m.centre - width / 6 - 1e-8, m.zones, 1 / 3)).toBe("good");
      expect(judgeTiming(z.start + 1e-8, m.zones, 1 / 3)).toBe("good");
      expect(judgeTiming(z.start - 1e-8, m.zones, 1 / 3)).toBe("miss");
      expect(judgeTiming(z.end - 1e-8, m.zones, 1 / 3)).toBe("good");
      expect(judgeTiming(z.end + 1e-8, m.zones, 1 / 3)).toBe("miss");
   });
   it("keeps hit progress, lost perfection and the absolute miss lock across redocking", () => {
      const r = fixture(7), m = r.modules[7]; press(r, m.centre); press(r, 0.05);
      const deadline = m.lockUntil; expect(deadline - r.time).toBeCloseTo(0.5, 10);
      expect(m.hits).toBe(1); expect(m.perfect).toBe(false);
      stepRun(r, { x: 1, z: 0, repair: false }, 0.001); expect(r.docked).toBe(-1);
      r.body.vx = 0; r.body.vz = 0; advance(r, 0.498);
      expect(r.docked).toBe(7); expect(m.lockUntil).toBe(deadline); expect(r.needleAge).toBe(0);
      stepRun(r, { x: 0, z: 0, repair: true }, 0.0005); expect(m.hits).toBe(1); expect(r.events.miss).toBe(false);
      stepRun(r, idle, 0.0005); expect(r.time).toBeCloseTo(deadline, 9); expect(r.needleAge).toBeCloseTo(0, 9);
      press(r, m.centre); press(r, m.centre); expect(r.score).toBe(100);
   });
   it("ignores moving/outside/healthy presses and skips already broken tickets without resets", () => {
      const r = fixture(2), m = r.modules[2]; press(r, m.centre); const hits = m.hits;
      r.body.x += 1; r.docked = -1; stepRun(r, { x: 0, z: 0, repair: true }, 0.01);
      expect(m.hits).toBe(hits); expect(r.score).toBe(0);
      const q = createRun(1); advance(q, 6); const p = q.modules[0]; p.hits = 0; p.perfect = false;
      q.time = 48 - 0.001; q.ticket = 8; stepRun(q, idle, 0.001);
      expect(q.ticket).toBe(9); expect(p.generation).toBe(1); expect(p.perfect).toBe(false);
   });
   it("integrates ticket drain exactly and stops drain at the repair instant", () => {
      const r = createRun(1); advance(r, 6); expect(r.power).toBe(100);
      advance(r, 6); expect(r.power).toBeCloseTo(94, 9);
      advance(r, 6); expect(r.power).toBeCloseTo(82, 9);
      const q = fixture(); advance(q, 0.1); const power = q.power;
      press(q, q.modules[0].centre); expect(q.power).toBeCloseTo(power - 0.001, 9);
      const repaired = q.power; advance(q, 0.1); expect(q.power).toBe(repaired);
   });
   it("spawns each of three milestone cells only once and never awards cell points", () => {
      for (const milestone of [4, 12, 20]) {
         const r = fixture(); r.repairs = milestone - 1; r.power = 60; press(r, r.modules[0].centre);
         const c = r.cells[[4, 12, 20].indexOf(milestone)];
         expect(c.active).toBe(true); expect(c.used).toBe(true); expect(c.x).toBeCloseTo(1.3, 9);
         const score = r.score; advance(r, 0.349); expect(r.power).toBeCloseTo(59.999, 9);
         advance(r, 0.001); expect(r.power).toBeCloseTo(84.999, 9); expect(r.score).toBe(score); expect(c.active).toBe(false);
         advance(r, 1); expect(r.power).toBeCloseTo(84.999, 9);
      }
      expect(CELL).toEqual({ milestones: [4, 12, 20], offset: 1.3, delay: 0.35, lifetime: 8, radius: 2, power: 25 });
   });
   it("caps cells at 100, pins pickup radius and expires before an equal-instant pickup", () => {
      for (const [distance, picked] of [[2, true], [2.001, false]] as const) {
         const r = fixture(); const c = r.cells[0]; c.active = true; c.used = true; c.born = r.time - 0.35;
         c.x = r.body.x + distance; c.z = r.body.z; r.power = 90;
         stepRun(r, idle, 0.001); expect(c.active).toBe(!picked); expect(r.power).toBeCloseTo(picked ? 100 : 89.999, 9);
      }
      const r = fixture(), c = r.cells[0]; c.active = true; c.used = true; c.born = r.time - 7.999; c.x = r.body.x; c.z = r.body.z;
      r.power = 60; stepRun(r, idle, 0.001); expect(c.active).toBe(false); expect(r.power).toBeCloseTo(59.999, 9);
   });
   it("zero absorbs before recharge or repair; alarm rearms above 30", () => {
      const r = fixture(); r.power = 0.01; const c = r.cells[0]; c.active = true; c.born = r.time - 0.34; c.x = r.body.x; c.z = r.body.z;
      stepRun(r, { x: 0, z: 0, repair: true }, 0.05);
      expect(r.terminal).toBe("lose"); expect(r.power).toBe(0); expect(r.score).toBe(0); expect(r.time).toBeCloseTo(6.01, 8);
      const a = fixture(); a.power = 25.001; stepRun(a, idle, 0.01); expect(a.events.alarm).toBe(true);
      stepRun(a, idle, 0.01); expect(a.events.alarm).toBe(false);
      a.power = 31; stepRun(a, idle, 0.01); expect(a.lowArmed).toBe(true);
      a.power = 25.001; stepRun(a, idle, 0.01); expect(a.events.alarm).toBe(true);
   });
   it("reconciles fractional-power bonus once, with exact-deadline repair before win", () => {
      const r = fixture(0, 119.99); r.power = 50.51; r.needleAge = r.modules[0].centre * 1.2 - 0.01;
      stepRun(r, { x: 0, z: 0, repair: true }, 0.01);
      expect(r.terminal).toBe("win"); expect(r.repairs).toBe(1); expect(r.bonus).toBe(100); expect(r.score).toBe(250);
      const score = r.score; stepRun(r, { x: 1, z: 1, repair: true }, 1); expect(r.score).toBe(score); expect(r.time).toBe(120);
      const q = fixture(7, 119.99); q.needleAge = q.modules[7].centre * 1.2 - 0.01;
      stepRun(q, { x: 0, z: 0, repair: true }, 0.02); expect(q.repairs).toBe(0); expect(q.bonus).toBe(198); expect(q.time).toBe(120);
      const loss = fixture(0, 119.99); loss.power = 0.01; stepRun(loss, idle, 0.02); expect(loss.terminal).toBe("lose"); expect(loss.bonus).toBe(0);
   });
});

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
function witness(policy: Policy, seed: number, coarse: boolean, frame: () => number) {
   const r = createRun(seed, coarse), controller = bot(policy, seed), store = createArcadeStore();
   let prefixValid = true, earliest = Infinity, greatestGeneration = 0;
   const final = simulateRun(store, { maxFrames: Math.ceil((CLOCK.duration + 3) / 0.004) + 100, frame, step: (dt, _time, api) => {
      stepRun(r, controller.drive(r, dt), dt);
      const s = api.getState(); if (r.events.award) { s.addScore(r.events.award); earliest = Math.min(earliest, r.time); }
      if (r.terminal) { s.setScore(r.score); s.end(r.terminal); }
      const state = api.getState();
      prefixValid &&= state.score <= 4700 && state.score <= 400 + 40 * state.elapsedMs / 1000 + 1e-7 && state.score >= 0;
      for (const m of r.modules) greatestGeneration = Math.max(greatestGeneration, m.generation);
   } });
   expect(prefixValid).toBe(true); expect(greatestGeneration).toBeLessThanOrEqual(4);
   expect(final.score).toBe(r.score); expect(final.elapsedMs).toBeGreaterThanOrEqual(37666 - 1);
   expect(final.elapsedMs).toBeLessThan(120051);
   expect(withinServerLimits(final.score, final.elapsedMs, PROPOSED_LIMITS)).toBe(true);
   expect(capScore(final.score, final.elapsedMs, PROPOSED_LIMITS)).toBe(final.score);
   expect(earliest).toBeGreaterThanOrEqual(6.39 - 1e-8);
   return { r, final, metrics: controller.metrics };
}
describe("scoring proof through the real store", () => {
   it("fails a stalled proof with a clear frame-cap error", () => {
      expect(() => witness("Idle", 1, false, () => 0)).toThrow("simulateRun: still countdown after 30850 frames");
   });
   it("pins analytical movement/work and every ticket-prefix inequality", () => {
      expect(REPAIR.hits).toEqual([1, 1, 2, 1, 1, 2, 1, 3]);
      expect(DEBRIS).toMatchObject({ radius: 7.6, bodyRadius: 0.25, count: 4, speeds: [1, 1.2, 1.4], impulse: 2, cooldown: 1 });
      expect(STATION).toMatchObject({ serviceRadius: 6, dock: 0.6, moduleInradius: 0.65 });
      expect(2 * 6 * Math.sin(Math.PI / 8) - 1.2).toBeCloseTo(3.392201, 5);
      expect(0.8 * (0.45 - 60 / 720)).toBeCloseTo(0.293333333, 8);
      expect(0.8 * (0.45 - 60 / 2160)).toBeCloseTo(0.337777778, 8);
      for (const time of BREAKS.times) {
         const tickets = BREAKS.times.filter((t) => t <= time).length;
         expect(tickets * 150).toBeLessThanOrEqual(400 + 40 * time);
      }
      expect(30 * 150 + 200).toBe(4700); expect(6 * (1 + 2 + 3 + 4 + 5)).toBe(90);
   });
   it("drives 32 oracle seeds at all four schedules and 200 idle/spam seeds on both devices", () => {
      let best = 0, minPower = 100, minScore = 4700, maxScore = 0, fastestLoss = Infinity, slowestWin = 0;
      for (let seed = 1; seed <= 32; seed++) for (const coarse of [false, true]) for (const hz of [30, 60, 144, 0]) {
         const { r, final } = witness("OracleRepair", seed, coarse, hz ? fixedFrames(1000 / hz) : randomFrames(seed));
         expect(r.terminal).toBe("win");
         best = Math.max(best, r.score); minPower = Math.min(minPower, r.power); minScore = Math.min(minScore, r.score); maxScore = Math.max(maxScore, r.score); slowestWin = Math.max(slowestWin, final.elapsedMs);
      }
      // Keep 200 degenerate seeds at 20 Hz, plus eight at all four display
      // schedules. Every frame still drives the real store until the actual loss.
      for (let seed = 1; seed <= 200; seed++) for (const coarse of [false, true]) for (const policy of ["Idle", "BlindSpam20Hz"] as const) {
         for (const hz of seed <= 8 ? [20, 30, 60, 144, 0] : [20]) {
            const { r, final } = witness(policy, seed, coarse, hz ? fixedFrames(1000 / hz) : randomFrames(seed));
            expect(r.terminal).toBe("lose"); expect(r.score).toBe(0); fastestLoss = Math.min(fastestLoss, final.elapsedMs);
         }
      }
      expect(best).toBeGreaterThanOrEqual(4230);
      console.info("Space Repair oracle/idle/spam", { best, minScore, maxScore, minPower, fastestLoss, slowestWin });
   }, 60000);
   it("requires the honest human controller to win with misses, neutral braking and 150–250 ms reactions", () => {
      for (let seed = 1; seed <= 6; seed++) for (const coarse of [false, true]) {
         const { r, metrics } = witness("HumanPacedRepair", seed, coarse, fixedFrames(50));
         console.info("Space Repair human", { seed, coarse, power: r.power, repairs: r.repairs, score: r.score, travel: metrics.travel / metrics.trips, service: metrics.service / metrics.services, topSpeed: metrics.topSpeed });
         expect(r.terminal).toBe("win"); expect(r.power).toBeGreaterThanOrEqual(10); expect(r.repairs).toBeGreaterThanOrEqual(24);
         expect(metrics.topSpeed).toBeLessThanOrEqual(4.300001);
         // Includes the teaching target's long initial wait, so measure completed service after t6.
         expect(metrics.service / metrics.services).toBeGreaterThanOrEqual(3.1);
      }
   }, 60000);
   it("reports greedy and rejects held/camping/spinning exploits, including random frames", () => {
      for (let seed = 1; seed <= 4; seed++) for (const coarse of [false, true]) for (const policy of ["GreedyRepair", "HoldRepair", "CampOneModule", "ConstantThrustSpin"] as const) {
         for (const frame of seed === 1 ? [fixedFrames(50), randomFrames(seed)] : [fixedFrames(50)]) {
            const { r } = witness(policy, seed, coarse, frame);
            if (policy === "GreedyRepair") console.info("Space Repair greedy", { seed, coarse, score: r.score, power: r.power });
            else { expect(r.terminal).toBe("lose"); expect(r.time).toBeLessThan(120); expect(r.score).toBeLessThanOrEqual(600); }
            if (policy === "HoldRepair") expect(r.score).toBe(0);
         }
      }
   }, 60000);
   it("keeps a novice first-minute margin through the real, progressively harder rules", () => {
      for (const coarse of [false, true]) {
         const r = createRun(18, coarse), controller = bot("HumanPacedRepair", 18), store = createArcadeStore();
         store.getState().configure({}); store.getState().markReady(); store.getState().start();
         let frame = 0;
         for (; frame < 1300 && r.time < 60 - 1e-8 && !r.terminal; frame++) {
            advanceRunClock(store, 0.05); const dt = playedFrameDt(store.getState());
            if (dt > 0) {
               stepRun(r, controller.drive(r, dt), dt);
               if (r.events.award) store.getState().addScore(r.events.award);
               if (r.terminal) { store.getState().setScore(r.score); store.getState().end(r.terminal); }
            }
         }
         if (frame === 1300) throw new Error("space-repair novice proof: exceeded 1300 frames before 60 seconds");
         expect(r.time).toBeCloseTo(60, 7); expect(r.power).toBeGreaterThanOrEqual(40); expect(r.terminal).toBeNull();
      }
   });
   it("keeps pause/over immutable, consumes countdown remainder and caps a 300 ms stall", () => {
      const store = createArcadeStore(), r = createRun(1);
      store.getState().configure({}); store.getState().markReady(); store.getState().start();
      for (let i = 0; i < 59; i++) advanceRunClock(store, 0.05);
      advanceRunClock(store, 0.04); expect(playedFrameDt(store.getState())).toBe(0);
      advanceRunClock(store, 0.03); expect(playedFrameDt(store.getState())).toBeCloseTo(0.02, 9);
      stepRun(r, idle, playedFrameDt(store.getState())); expect(r.time).toBeCloseTo(0.02, 9);
      store.getState().pause(); const before = store.getState().elapsedMs;
      advanceRunClock(store, 0.3); expect(playedFrameDt(store.getState())).toBe(0); expect(store.getState().elapsedMs).toBe(before);
      store.getState().resume(); advanceRunClock(store, 0.3); expect(playedFrameDt(store.getState())).toBe(0.05);
      store.getState().end("lose"); advanceRunClock(store, 0.3); expect(playedFrameDt(store.getState())).toBe(0);
      const fresh = createRun(1); expect(fresh.time).toBe(0); expect(fresh.modules.every((m) => !m.broken && m.hits === 0 && m.lockUntil === 0)).toBe(true);
   });
});
