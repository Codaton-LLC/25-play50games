// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game
// (replayed against today's createRun), monotone difficulty, every level setting reaching the
// simulation, the limit proof per level and the bots through the real store. rules.test.ts (level 1's
// own proof and bots) is untouched.
import { describe, expect, it, vi } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { createGrid, findPath, freeGrid, followPath, nearestFree, steer, simulateRun, fixedFrames, randomFrames, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import type { ScoringRules } from "@/arcade3d/types";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type GhostLevel } from "./levels";
import { ghostVacuumMeta as meta } from "./meta";
import { GHOST, LIGHT, PROPOSED_LEVEL_LIMITS, ROOMS, ROOM_HABITS, SCHEDULE, SOLIDS, active, createRun, exposureTime, faded, roomFurniture, runScore, solidsFor, stepRun, type Run, type StepInput } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const levelMeta = (id: LevelId) => meta.levels![id - 1];
const input = (): StepInput => ({ dirX: 0, dirZ: 0, held: false, aim: true, aimYaw: 0, coarse: false });

function advance(run: Run, i: StepInput, duration: number, frame = 1 / 120): void {
   const end = run.elapsed + duration;
   while (run.elapsed < end - 1e-10 && !run.ended) { const dt = Math.min(frame, end - run.elapsed); stepRun(run, i, dt, run.elapsed + dt); }
}

/** rules.test.ts's lit-ghost fixture, on a given level: ghost 0 in the kitchen, the hunter 2 m south facing it. */
function fixture(level: GhostLevel, kind: "normal" | "gold" | "big" = "normal") {
   const run = createRun(7, level), i = input(), g = run.ghosts[0];
   for (const other of run.ghosts) other.mode = "caught";
   Object.assign(g, { room: 2, x: 8, z: -7, baseX: 8, baseZ: -7, mode: "wandering", kind, vx: 0, vz: 0 });
   Object.assign(run.hunter, { x: 8, z: -9, yaw: 0 });
   return { run, i, g };
}

const grid = createGrid({ cell: 0.25, halfX: 14, halfZ: 10 });
/** The hunter's free centres on a level (its own furniture included). */
const FREE = new Map<GhostLevel, Uint8Array>();
function freeFor(level: GhostLevel): Uint8Array {
   let f = FREE.get(level);
   if (!f) {
      const solids = solidsFor(level);
      f = freeGrid(grid, (x, z) => Math.abs(x) <= 13.5 && Math.abs(z) <= 9.5 && solids.every((b) => distanceToBoxXZ(x, z, b) >= 0.401));
      FREE.set(level, f);
   }
   return f;
}

type Brain = "honest" | "spam" | "idle";

/** The rules.test.ts honest bot (path-following, lights and vacuums the nearest ghost), on a level. */
function playLevel(seed: number, level: GhostLevel, limits: ScoringRules, brain: Brain, coarse = seed % 6 >= 3) {
   const run = createRun(seed, level);
   const i: StepInput = { dirX: 0, dirZ: 0, held: false, aim: !coarse, aimYaw: 0, coarse };
   const rng = createRng(seed + 904);
   const frame = seed % 3 === 0 ? fixedFrames(1000 / 60) : seed % 3 === 1 ? fixedFrames(50) : randomFrames(seed + 80);
   let target = -1, path: PathFollower | null = null, planned = -1, prefixOk = true;
   const free = freeFor(level);
   const final = simulateRun(createArcadeStore(), { durationMs: 120000, resultDelayMs: 1600, frame,
      step: (dt, time, store) => {
         if (brain === "spam") { i.dirX = rng() * 2 - 1; i.dirZ = rng() * 2 - 1; i.held = rng() > 0.25; i.aimYaw = rng() * Math.PI * 2; }
         else if (brain === "honest") {
            if (target < 0 || !active(run.ghosts[target])) {
               target = -1; let nearest = Infinity;
               for (const g of run.ghosts) if (active(g)) { const d = Math.hypot(g.x - run.hunter.x, g.z - run.hunter.z); if (d < nearest) { nearest = d; target = g.id; } }
               path = null;
            }
            i.dirX = 0; i.dirZ = 0; i.held = true;
            if (target >= 0) {
               const g = run.ghosts[target], h = run.hunter, r = ROOMS[g.room];
               const x = g.mode === "hidden" ? r.x - r.side * 1.5 : g.mode === "pulling" ? g.baseX : g.x, z = g.mode === "hidden" ? r.z : g.mode === "pulling" ? g.baseZ : g.z;
               const d = Math.hypot(x - h.x, z - h.z);
               i.aimYaw = Math.atan2(x - h.x, z - h.z);
               if (g.mode !== "pulling" && (g.mode === "hidden" ? d > 0.7 : d > 2.5)) {
                  if (!path || (time - planned > 0.8 && Math.hypot(path.goalX - x, path.goalZ - z) > 0.75)) { path = followPath(grid, free, h.x, h.z, x, z); planned = time; }
                  steer(grid, path, h.x, h.z, i, 0.2);
               } else if (coarse) { i.dirX = Math.sin(i.aimYaw) * 0.02; i.dirZ = Math.cos(i.aimYaw) * 0.02; }
            }
         }
         stepRun(run, i, dt, time);
         const s = store.getState(); if (run.events.points) s.addScore(run.events.points);
         if (run.events.win) { s.setScore(run.score); s.end("win"); }
         const now = store.getState();
         prefixOk &&= now.score <= limits.base! + limits.maxPointsPerSec! * now.elapsedMs / 1000 + 1e-9;
      },
   });
   const ok = withinServerLimits(final.score, final.elapsedMs, limits) && capScore(final.score, final.elapsedMs, limits) === final.score;
   return { final, prefixOk, ok, run };
}

/** Comparable state of a run (no closures). */
const snapshot = (run: Run) => JSON.stringify({ g: run.ghosts, h: run.hunter, s: run.score, c: run.caught, e: run.elapsed, x: run.extras, w: run.won });

describe("ghost-vacuum levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.scoring).toMatchObject({ maxScore: 2630, minDurationMs: 91000, maxDurationMs: 122000, base: 1720, maxPointsPerSec: 10 });
      for (const id of LEVEL_IDS) {
         // the sum board: a harder level never offers fewer points than level 1; level 5 stays under 3x
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
      expect([1, 2, 3, 4].map((id) => levelMeta(id as LevelId).clearScore)).toEqual([1500, 1600, 1700, 1800]);
      expect(levelMeta(5).clearScore).toBeUndefined();
   });

   it("level 1 is today's game: same ghosts, timings, and a replayed run matches today's createRun", () => {
      expect(LEVELS[1]).toEqual({ gold: [5, 8, 11], big: [9, 10], speed: 1, exposure: LIGHT.exposure, bigExposure: LIGHT.bigExposure, stun: LIGHT.stun, earlyCap: 3, capAt: 40, lateAt: 60, rooms: ["living", "living", "living", "living"] });
      expect(solidsFor(LEVELS[1])).toBe(SOLIDS);
      for (let seed = 0; seed < 12; seed++) {
         const today = createRun(seed);
         const named = createRun(seed, LEVELS[1]);
         expect(snapshot(named)).toBe(snapshot(today));
         const rng = createRng(seed + 31);
         const i = input();
         let t = 0;
         while (t < 120 && !today.ended) {
            if (rng() < 0.05) { i.dirX = rng() * 2 - 1; i.dirZ = rng() * 2 - 1; i.held = rng() < 0.7; i.aimYaw = rng() * Math.PI * 2; }
            const dt = 1 / 30;
            t += dt;
            stepRun(today, i, dt, t);
            stepRun(named, i, dt, t);
         }
         expect(snapshot(named)).toBe(snapshot(today));
      }
      for (let seed = 0; seed < 6; seed++) {
         const a = playLevel(seed, LEVELS[1], PROPOSED_LEVEL_LIMITS[1], "honest");
         expect(a.final.endReason).toBe("win");
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: 120000, lives: undefined, resultDelayMs: 1600 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   });

   it("keeps the same clock and chips on every level; levels 2-5 add their room's habit to the instructions and have their own light", () => {
      const looks = new Set<string>();
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
         if (id > 1) expect(levelInstructions(definition, id).length).toBe(definition.instructions.length + 1);
         const env = levelEnvironment(definition, id);
         looks.add(JSON.stringify([env?.lighting, env?.background, env?.fog]));
      }
      expect(looks.size).toBe(5);
   });
});

describe("ghost-vacuum levels: difficulty", () => {
   it("is monotone: more gold and big ghosts, faster, slower to stun, shorter stuns, earlier pressure", () => {
      for (const id of LEVEL_IDS) {
         const l = LEVELS[id];
         expect(l.gold).toContain(11);
         expect(l.gold.filter((g) => l.big.includes(g))).toEqual([]);
         expect(l.bigExposure).toBeCloseTo(2 * l.exposure, 12);
      }
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id), b = LEVELS[id];
         expect(b.gold.length).toBeGreaterThan(a.gold.length);
         for (const g of a.gold) expect(b.gold).toContain(g);
         for (const g of a.big) expect(b.big).toContain(g);
         expect(b.speed).toBeGreaterThan(a.speed);
         expect(b.exposure).toBeGreaterThanOrEqual(a.exposure);
         expect(b.stun).toBeLessThan(a.stun);
         expect(b.earlyCap).toBeGreaterThanOrEqual(a.earlyCap);
         expect(b.capAt).toBeLessThan(a.capAt);
         expect(b.lateAt).toBeLessThan(a.lateAt);
         expect(levelMeta(id).clearScore ?? Infinity).toBeGreaterThan(levelMeta((id - 1) as LevelId).clearScore!);
      }
   });
});

describe("ghost-vacuum levels: the simulation reads the level", () => {
   it("gold and big ghosts are the level's", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, LEVELS[id]);
         expect(run.ghosts.filter((g) => g.kind === "gold").map((g) => g.id)).toEqual([...LEVELS[id].gold]);
         expect(run.ghosts.filter((g) => g.kind === "big").map((g) => g.id)).toEqual([...LEVELS[id].big]);
      }
   });

   it("a lit ghost stuns after the level's exposure and stays stunned for the level's stun", () => {
      for (const id of [1, 5] as const) {
         for (const kind of ["normal", "big"] as const) {
            const { run, i, g } = fixture(LEVELS[id], kind);
            const need = exposureTime(g, LEVELS[id]);
            expect(need).toBe(kind === "big" ? LEVELS[id].bigExposure : LEVELS[id].exposure);
            advance(run, i, need - 0.01);
            expect(g.mode, `L${id} ${kind} early`).not.toBe("stunned");
            advance(run, i, 0.02);
            expect(g.mode, `L${id} ${kind} stunned`).toBe("stunned");
            run.hunter.yaw = Math.PI; i.aimYaw = Math.PI; // light off: let the stun run out
            advance(run, i, LEVELS[id].stun - 0.03);
            expect(g.mode, `L${id} ${kind} still`).toBe("stunned");
            advance(run, i, 0.05);
            expect(g.mode, `L${id} ${kind} recovered`).not.toBe("stunned");
         }
      }
   });

   it("the active cap and its switch time are the level's", () => {
      const activeAt = (id: LevelId, t: number) => {
         const run = createRun(1, LEVELS[id]), i = input();
         run.hunter.x = 0; run.hunter.z = 9;
         advance(run, i, t, 1 / 20);
         return run.ghosts.filter(active).length;
      };
      expect(activeAt(1, 21)).toBe(3);
      expect(activeAt(3, 21)).toBe(4);
      expect(activeAt(1, 36)).toBe(3);
      expect(activeAt(2, 36)).toBe(6);
      expect(activeAt(4, 26)).toBe(5);
      expect(activeAt(3, 26)).toBe(4);
   });

   it("ghosts move at the level's speed, and ordinary ghosts speed up at the level's lateAt", () => {
      const fastest = (id: LevelId, from: number, to: number) => {
         const run = createRun(5, LEVELS[id]), i = input();
         run.hunter.x = 0; run.hunter.z = 9; // in the hall, the light on the south wall
         for (const g of run.ghosts) { g.mode = "wandering"; g.admittedAt = 0; }
         let top = 0;
         while (run.elapsed < to) {
            stepRun(run, i, 1 / 60, run.elapsed + 1 / 60);
            if (run.elapsed < from) continue;
            for (const g of run.ghosts) if (g.kind === "normal" && (g.mode === "wandering" || g.mode === "fleeing") && !g.lit && !g.returnStage) top = Math.max(top, Math.hypot(g.vx, g.vz));
         }
         return top;
      };
      const l1 = fastest(1, 5, 25);
      const l5 = fastest(5, 5, 25);
      expect(l1).toBeLessThanOrEqual(GHOST.wander + 1e-9);
      expect(l5).toBeLessThanOrEqual(GHOST.wander * LEVELS[5].speed + 1e-9);
      expect(l5).toBeGreaterThan(GHOST.wander * 1.02);
      // level 5's late speed-up from 30 s
      expect(fastest(5, 31, 50)).toBeGreaterThan(GHOST.wander * LEVELS[5].speed * 1.02);
      expect(fastest(1, 31, 50)).toBeLessThanOrEqual(GHOST.wander + 1e-9);
   });
});

describe("ghost-vacuum levels: rooms, furniture and habits", () => {
   it("every level dresses its rooms its own way: levels 2-4 one kind each, level 5 all four", () => {
      expect(new Set(LEVELS[2].rooms)).toEqual(new Set(["library"]));
      expect(new Set(LEVELS[3].rooms)).toEqual(new Set(["kitchen"]));
      expect(new Set(LEVELS[4].rooms)).toEqual(new Set(["attic"]));
      expect(new Set(LEVELS[5].rooms)).toEqual(new Set(["living", "library", "kitchen", "attic"]));
      for (const id of [2, 3, 4, 5] as const) expect(solidsFor(LEVELS[id]).length).toBeGreaterThan(SOLIDS.length);
   });

   for (const id of LEVEL_IDS) it(`L${id}: furniture keeps clear of the doorways, the desks and the pop spots; the whole mansion stays reachable`, () => {
      const level = LEVELS[id], free = freeFor(level);
      for (let i = 0; i < 4; i++) {
         const r = ROOMS[i];
         for (const f of roomFurniture(i, level.rooms[i])) {
            // inside the room, off the doorway, off the desk and chair, not on a pop spot
            expect(Math.abs(f.box.min.x) >= 3.1 && Math.abs(f.box.max.x) >= 3.1 && Math.abs(f.box.min.x) <= 13.9 && Math.abs(f.box.max.x) <= 13.9, f.kind).toBe(true);
            expect(distanceToBoxXZ(r.doorX, r.doorZ, f.box), `${f.kind} / door`).toBeGreaterThan(1.6);
            expect(distanceToBoxXZ(r.x, r.z, f.box), `${f.kind} / desk`).toBeGreaterThan(1.2);
            for (const k of [0, -1, 1]) expect(distanceToBoxXZ(r.x - r.side * 2, r.z + k, f.box), `${f.kind} / pop`).toBeGreaterThan(0.5);
         }
      }
      // every free cell connects to the start, and every desk's reveal ring has a free cell on it
      const start = nearestFree(grid, free, 0, 8);
      let unreached = 0, cells = 0;
      const reach = new Uint8Array(grid.size);
      const queue = [start];
      reach[start] = 1;
      while (queue.length) {
         const n = queue.pop()!;
         const xi = Math.floor(n / grid.nz), zi = n % grid.nz;
         for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = xi + dx, b = zi + dz;
            if (a < 0 || b < 0 || a >= grid.nx || b >= grid.nz) continue;
            const m = a * grid.nz + b;
            if (free[m] && !reach[m]) { reach[m] = 1; queue.push(m); }
         }
      }
      for (let n = 0; n < grid.size; n++) if (free[n]) { cells++; if (!reach[n]) unreached++; }
      expect(cells).toBeGreaterThan(4000);
      expect(unreached).toBe(0);
      for (const r of ROOMS) {
         const near = nearestFree(grid, free, r.x - r.side * 1.5, r.z, 1);
         expect(near).toBeGreaterThanOrEqual(0);
         expect(Math.hypot(grid.x(near) - r.x, grid.z(near) - r.z)).toBeLessThanOrEqual(GHOST.reveal);
         expect(findPath(grid, free, start, near).length).toBeGreaterThan(0);
      }
   });

   it("library: a faded ghost cannot be lit, and a lit one fades out of the light now and then", () => {
      const { run, i, g } = fixture(LEVELS[2]);
      let fadedSteps = 0, litWhileFaded = 0;
      for (let k = 0; k < 600; k++) {
         advance(run, i, 1 / 60);
         if (g.mode === "stunned") { g.mode = "wandering"; g.exposure = 0; }
         if (faded(run, g)) { fadedSteps++; if (g.lit) litWhileFaded++; }
      }
      expect(fadedSteps).toBeGreaterThan(60);
      expect(litWhileFaded).toBe(0);
      // level 1 never fades
      const one = fixture(LEVELS[1]);
      for (let k = 0; k < 600; k++) { advance(one.run, one.i, 1 / 60); expect(faded(one.run, one.g)).toBe(false); }
   });

   it("kitchen: a lit ghost skids away faster than the same ghost in the living room", () => {
      const top = (level: GhostLevel) => {
         const { run, i, g } = fixture({ ...level, exposure: 99, bigExposure: 99 });
         let best = 0;
         for (let k = 0; k < 120; k++) { advance(run, i, 1 / 60); if (g.lit) best = Math.max(best, Math.hypot(g.vx, g.vz)); }
         return best;
      };
      const living = top({ ...LEVELS[3], rooms: ["living", "living", "living", "living"] });
      const kitchen = top(LEVELS[3]);
      expect(kitchen).toBeGreaterThan(living * 1.2);
      expect(kitchen).toBeLessThanOrEqual(GHOST.flee * LEVELS[3].speed * ROOM_HABITS.kitchenFlee + 1e-9);
   });

   it("attic: a ghost left alone creeps back into its trunk and pops out again when the hunter comes", () => {
      const { run, i, g } = fixture(LEVELS[4]);
      run.hunter.x = 0; run.hunter.z = 9; run.hunter.yaw = Math.PI; i.aimYaw = Math.PI; // far away, light off
      advance(run, i, ROOM_HABITS.atticQuiet + 0.5);
      expect(g.mode).toBe("hidden");
      expect([g.x, g.z]).toEqual([g.homeX, g.homeZ]);
      const r = ROOMS[g.room];
      run.hunter.x = r.x - r.side * 1.5; run.hunter.z = r.z;
      advance(run, i, 0.05);
      expect(g.mode).toBe("wandering");
      // the living room never re-hides
      const one = fixture(LEVELS[1]);
      one.run.hunter.x = 0; one.run.hunter.z = 9; one.run.hunter.yaw = Math.PI; one.i.aimYaw = Math.PI;
      advance(one.run, one.i, 10);
      expect(one.g.mode).not.toBe("hidden");
   });
});

describe("ghost-vacuum levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: every capture prefix and every legal win fits base + pps t`, () => {
      const l = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id], gold = l.gold.length;
      const earliest = 90 + l.exposure + 1;
      expect(limits.maxScore).toBe(runScore(12, gold, 11, true, earliest));
      expect(limits.base).toBe(limits.maxScore - 910);
      expect(limits.minDurationMs).toBeLessThanOrEqual(earliest * 1000);
      for (let t = 0; t <= 120; t += 0.01) {
         const released = SCHEDULE.filter((at) => at <= t).length;
         const goldIn = l.gold.filter((g) => SCHEDULE[g] <= t).length;
         const bound = 100 * released + 200 * goldIn + 50 * Math.max(0, released - 1);
         expect(capScore(bound, t * 1000, limits)).toBe(bound);
      }
      for (let t = earliest; t < 120; t += 0.05) expect(withinServerLimits(runScore(12, gold, 11, true, t), t * 1000, limits)).toBe(true);
      expect(withinServerLimits(runScore(12, gold, 11, false, 120), 120000, limits)).toBe(true);
   });
});

describe("ghost-vacuum levels: bots through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the honest bot wins >= 90% and reaches the target on every seed; spam and idle stay legal; idle never clears`, () => {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const target = levelMeta(id).clearScore ?? levelMeta(4).clearScore!;
         const earliest = (90 + LEVELS[id].exposure + 1) * 1000;
         let wins = 0, reached = 0;
         const seeds = 30;
         for (let seed = 0; seed < seeds; seed++) {
            const r = playLevel(seed, LEVELS[id], limits, "honest");
            expect(r.ok && r.prefixOk, `seed ${seed}`).toBe(true);
            if (r.final.endReason === "win") { wins += 1; expect(r.final.elapsedMs).toBeGreaterThanOrEqual(earliest - 1e-6); }
            if (r.final.score >= target) reached += 1;
            if (id < 5) expect(isLevelCleared(r.final.endReason, r.final.score, levelMeta(id))).toBe(r.final.endReason === "win" || r.final.score >= target);
         }
         expect(wins / seeds).toBeGreaterThanOrEqual(0.9);
         expect(reached / seeds).toBeGreaterThanOrEqual(0.99);
         for (let seed = 0; seed < 6; seed++) {
            const spam = playLevel(seed, LEVELS[id], limits, "spam");
            expect(spam.ok && spam.prefixOk, `spam ${seed}`).toBe(true);
         }
         for (const seed of [1, 2]) {
            const idle = playLevel(seed, LEVELS[id], limits, "idle");
            expect(idle.final.endReason).toBe("timeup");
            expect(idle.final.score).toBe(0);
            expect(isLevelCleared(idle.final.endReason, idle.final.score, levelMeta(id))).toBe(false);
         }
      }, 180_000);
   }
});
