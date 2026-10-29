// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the limit proof per level, and the rules that must hold on every level.
// Bot clear rates are in the last block.
import { describe, expect, it, vi } from "vitest";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { isLevelCleared, definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { simulateRun, fixedFrames } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type DinoLevel } from "./levels";
import type { ValleyMap } from "./maps";
import { cellNear, cellX, cellZ, navGrid, travelTimes, waypoint, type NavGrid } from "./navkit";
import { dinoEggRescueMeta as meta } from "./meta";
import {
   BOULDER_LANES,
   BOULDERS,
   DINO,
   DURATION_MS,
   EGGS,
   MUD,
   PROPOSED_LEVEL_LIMITS,
   boulderIntervalAt,
   createDinoRun,
   maxPointsPerEgg,
   mudFor,
   regularSupply,
   scoreCeiling,
   stepDinoRun,
   type DinoRunState,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const ZERO: StepInput = { moveX: 0, moveY: 0, actionPressed: false, jumpPressed: false };
const INPUT: StepInput = { moveX: 0, moveY: 0, actionPressed: false, jumpPressed: false };

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const openS = (level: DinoLevel, lane: number) => level.durationMs / 1000 - level.unlocks[lane];

function lanesSpawned(level: DinoLevel, untilS: number, seeds = 16): Set<number> {
   const used = new Set<number>();
   const steps = Math.ceil(untilS * 30);
   for (let s = 1; s <= seeds; s++) {
      const run = createDinoRun(s * 17, level);
      for (let i = 0; i < steps; i++) stepDinoRun(run, ZERO, 1 / 30);
      for (let lane = 0; lane < 4; lane++) if (run.laneLastSpawnTime[lane] >= 0) used.add(lane + 1);
   }
   return used;
}

function silence(run: DinoRunState) {
   run.groundEggs.length = 0;
   run.boulders.length = 0;
   run.nextBoulderSpawnTime = 1e9;
   run.nextEggSpawnTick = 999;
}

// The bots walk the valley's grid (navkit.ts): a vent counts as a wall for them, a log too (they
// never need a dash to get round), and the route is the cheapest one with mud and water priced in.
const GRIDS = new Map<ValleyMap, NavGrid>();
function botGrid(map: ValleyMap): NavGrid {
   let g = GRIDS.get(map);
   if (!g) {
      const vents = map.vents.map((v) => ({ kind: "rock" as const, ax: v.x, az: v.z, bx: v.x, bz: v.z, r: v.r + 0.35 }));
      g = navGrid({ ...map, obstacles: [...map.obstacles, ...vents] }, 0.5);
      GRIDS.set(map, g);
   }
   return g;
}
const NAV = new WeakMap<DinoRunState, { cell: number; field: Float64Array }>();

/** The way to (tx, tz): straight when close or in plain sight of nothing, else the next grid waypoint. */
function heading(run: DinoRunState, tx: number, tz: number, out: { x: number; z: number }) {
   const dino = run.dino;
   out.x = tx - dino.x;
   out.z = tz - dino.z;
   if (Math.hypot(out.x, out.z) < 1.2) return;
   const g = botGrid(run.map);
   const goal = cellNear(g, tx, tz, 1.2);
   if (goal < 0) return;
   let nav = NAV.get(run);
   if (!nav) {
      nav = { cell: -1, field: new Float64Array(g.nx * g.nz) };
      NAV.set(run, nav);
   }
   if (nav.cell !== goal) {
      travelTimes(g, goal, DINO.baseSpeed, nav.field);
      nav.cell = goal;
   }
   const w = waypoint(g, nav.field, dino.x, dino.z, 3);
   if (w < 0 || w === goal) return;
   out.x = cellX(g, w) - dino.x;
   out.z = cellZ(g, w) - dino.z;
}
const HEAD = { x: 0, z: 0 };

/** Human stacks and dodges. Oracle also dashes through a close boulder and banks the stack before the clock. */
function steer(run: DinoRunState, profile: "human" | "oracle" | "idle" | "spam"): StepInput {
   const NEST = run.map.nest;
   const dino = run.dino;
   INPUT.moveX = 0;
   INPUT.moveY = 0;
   INPUT.actionPressed = false;
   INPUT.jumpPressed = false;
   if (profile === "idle") return INPUT;
   if (profile === "spam") {
      const ang = run.timeS * 3.1;
      INPUT.moveX = Math.cos(ang);
      INPUT.moveY = Math.sin(ang);
      INPUT.actionPressed = dino.dashCooldown <= 0;
      return INPUT;
   }
   let tx: number = NEST.x;
   let tz: number = NEST.z;
   let best = Infinity;
   const room = dino.carriedEggs.length < run.level.maxStack;
   const timeLeft = run.level.durationMs / 1000 - run.timeS;
   const nestDist = Math.hypot(NEST.x - dino.x, NEST.z - dino.z);
   const carry = dino.carriedEggs.length;
   const homeSpeed = carry > 0 ? DINO.baseSpeed * run.level.stackMultipliers[carry] : DINO.baseSpeed;
   const bank = carry > 0 && timeLeft < nestDist / homeSpeed + 0.8;
   if (!bank) {
      for (let i = 0; i < run.groundEggs.length; i++) {
         const egg = run.groundEggs[i];
         if (!egg.active) continue;
         if (egg.isGolden && dino.carriedGolden) continue;
         if (!egg.isGolden && !room) continue;
         const d = Math.hypot(egg.x - dino.x, egg.z - dino.z);
         if (!egg.isGolden) {
            const back = Math.hypot(egg.x - NEST.x, egg.z - NEST.z);
            const after = Math.min(run.level.maxStack, carry + 1);
            const backSpeed = DINO.baseSpeed * run.level.stackMultipliers[after];
            if (d / DINO.baseSpeed + back / backSpeed + 0.7 > timeLeft) continue;
         }
         // a golden egg outranks a regular one that is not much closer
         const rank = egg.isGolden ? d - (profile === "oracle" ? 6 : 3) : d;
         if (rank < best) {
            best = rank;
            tx = egg.x;
            tz = egg.z;
         }
      }
   }
   heading(run, tx, tz, HEAD);
   let dx = HEAD.x;
   let dz = HEAD.z;
   const goalDist = Math.hypot(tx - dino.x, tz - dino.z);
   let threat = 0;
   let dashThreat = false;
   for (let i = 0; i < run.boulders.length; i++) {
      const boulder = run.boulders[i];
      if (!boulder.active) continue;
      const bx = boulder.x - dino.x;
      const bz = boulder.z - dino.z;
      const bd = Math.hypot(bx, bz);
      const closing = bx * boulder.dirX + bz * boulder.dirZ;
      if (bd < 2.1 && closing > 0) {
         threat = Math.max(threat, 2.1 - bd);
         if (bd < 1.7) dashThreat = true;
         // sidestep only when a dash cannot slip through: the oracle stays on its line otherwise
         if (profile === "human" || dino.dashCooldown > 0) {
            const side = bx * boulder.dirZ - bz * boulder.dirX >= 0 ? 1 : -1;
            dx += -boulder.dirZ * side * 1.6;
            dz += boulder.dirX * side * 1.6;
         }
      }
   }
   const len = Math.hypot(dx, dz);
   INPUT.moveX = len > 0.12 ? dx / len : 0;
   INPUT.moveY = len > 0.12 ? dz / len : 0;
   const dashReach = profile === "oracle" ? 2.4 : 4.5;
   INPUT.actionPressed = dino.dashCooldown <= 0 && dino.stunTimer <= 0 && (goalDist > dashReach || dashThreat || threat > 0.9);
   return INPUT;
}

function play(seed: number, id: LevelId, profile: "human" | "oracle" | "idle" | "spam", hz: number) {
   const level = LEVELS[id];
   const run = createDinoRun(seed, level);
   const clock = level.durationMs / 1000;
   const dt = 1 / hz;
   while (run.timeS < clock - 1e-9) stepDinoRun(run, steer(run, profile), Math.min(dt, clock - run.timeS));
   return run;
}

describe("dino-egg-rescue levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's game: same clock, supply, lanes, mud, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect(l1.durationMs).toBe(DURATION_MS);
      expect(l1.unlocks).toEqual([0, 0, 30, 60]);
      expect(l1.speeds).toEqual([3.6, 4.2, 4.8, 5.2]);
      expect(l1.spawnRampS).toBe(90);
      expect(l1.mudPatches).toBe(MUD.patches.length);
      expect(l1.goldenSpawnTimes).toEqual([...EGGS.goldenSpawnTimes]);
      expect([l1.initialSupply, l1.totalSpawnTicks, l1.maxStack]).toEqual([EGGS.initialSupply, EGGS.totalSpawnTicks, EGGS.maxStack]);
      expect(l1.stackMultipliers).toEqual([...EGGS.stackMultipliers]);
      expect(l1.deliveryPoints).toEqual([...EGGS.points.regular]);
      const run = createDinoRun(42, l1);
      expect(run.lanes).toEqual([...BOULDER_LANES]);
      expect(run.mud).toBe(MUD.patches);
      expect(createDinoRun(42).dino).toEqual(run.dino);
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: 1200 });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "eggs", label: "Eggs Saved" }]);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
   });

   it("levels 2-5 have their own light, fog and sky, and override the clock, the chip max and the instructions", () => {
      const looks = new Set<string>();
      for (const id of LEVEL_IDS) {
         const env = levelEnvironment(definition, id);
         looks.add(JSON.stringify([env?.lighting, env?.background, env?.fog]));
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelRunConfig(definition, id).resultDelayMs).toBe(1200);
      }
      expect(looks.size).toBe(5);
      expect(definition.environment!.lighting).toBe("sunset");
      for (const id of LEVEL_IDS.slice(1)) {
         expect(levelHudStats(definition, id)![0].max).toBe(regularSupply(LEVELS[id]) + LEVELS[id].goldenSpawnTimes.length);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(definition.instructions.length);
      }
   });
});

describe("dino-egg-rescue levels: difficulty", () => {
   it("is monotone: open time, speed, supply and stack never fall, and each level adds pressure (mud is each valley's own)", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         for (let lane = 0; lane < 4; lane++) {
            expect(openS(b, lane)).toBeGreaterThanOrEqual(openS(a, lane));
            expect(b.speeds[lane]).toBeGreaterThanOrEqual(a.speeds[lane]);
         }
         expect(b.spawnRampS).toBeLessThanOrEqual(a.spawnRampS);
         expect(regularSupply(b)).toBeGreaterThanOrEqual(regularSupply(a));
         expect(b.maxStack).toBeGreaterThanOrEqual(a.maxStack);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(scoreCeiling(b)).toBeGreaterThanOrEqual(scoreCeiling(a));
         const added =
            b.spawnRampS < a.spawnRampS ||
            b.maxStack > a.maxStack ||
            regularSupply(b) > regularSupply(a) ||
            b.speeds.some((speed, lane) => speed > a.speeds[lane]) ||
            b.unlocks.some((unlock, lane) => unlock < a.unlocks[lane]);
         expect(added).toBe(true);
      }
      expect(LEVELS[5].maxStack).toBe(4);
      expect(LEVELS[5].stackMultipliers[4]).toBe(0.5);
      expect(LEVELS[5].deliveryPoints[4]).toBe(600);
   });

   it("lane unlocks are enforced: a locked lane never rolls, an open one does", () => {
      expect([...lanesSpawned(LEVELS[1], 10)].sort((a, b) => a - b)).toEqual([1, 2]);
      expect(lanesSpawned(LEVELS[1], 20).has(4)).toBe(false);
      expect(lanesSpawned(LEVELS[4], 10).has(4)).toBe(false);
      expect(lanesSpawned(LEVELS[4], 10).has(3)).toBe(true);
      expect(lanesSpawned(LEVELS[4], 22).has(4)).toBe(true);
      expect(lanesSpawned(LEVELS[2], 10).has(2)).toBe(false);
      expect(lanesSpawned(LEVELS[2], 20).has(2)).toBe(true);
   });

   const pushFor = (id: LevelId, x: number, z: number, input: StepInput, steps: number) => {
      const run = createDinoRun(1, LEVELS[id]);
      silence(run);
      run.dino.x = x;
      run.dino.z = z;
      let top = 0;
      for (let i = 0; i < steps; i++) {
         const x0 = run.dino.x;
         const z0 = run.dino.z;
         stepDinoRun(run, input, 1 / 60);
         top = Math.max(top, Math.hypot(run.dino.x - x0, run.dino.z - z0) * 60);
      }
      return { run, top };
   };

   it("every valley's mud halves the speed (level 1: today's three pits)", () => {
      expect(mudFor(LEVELS[1])).toBe(MUD.patches);
      for (const id of LEVEL_IDS) {
         const m = LEVELS[id].map.mud[0];
         const { top } = pushFor(id, m.x, m.z, { moveX: 0, moveY: 0.3, actionPressed: false, jumpPressed: false }, 20);
         expect(top, `L${id}`).toBeLessThan(DINO.baseSpeed * 0.3 * MUD.speedMultiplier + 0.05);
      }
   });

   it("Fern Forest: a fallen log stops a walk, a dash hops it", () => {
      const log = LEVELS[2].map.obstacles.find((o) => o.kind === "log" && o.az === o.bz)!;
      const mx = (log.ax + log.bx) / 2;
      const mz = (log.az + log.bz) / 2;
      const walk = pushFor(2, mx, mz + 1.4, { moveX: 0, moveY: -1, actionPressed: false, jumpPressed: false }, 60);
      expect(walk.run.dino.z).toBeGreaterThan(mz);
      const dash = pushFor(2, mx, mz + 1.4, { moveX: 0, moveY: -1, actionPressed: true, jumpPressed: false }, 60);
      expect(dash.run.dino.z).toBeLessThan(mz - 0.8);
   });

   it("Riverbank: wading is slow and the current drags the dino east; a bridge crosses dry", () => {
      const map = LEVELS[3].map;
      const w = map.water[0];
      const mid = (w.z0 + w.z1) / 2;
      const still: StepInput = { moveX: 0, moveY: 0, actionPressed: false, jumpPressed: false };
      const drift = pushFor(3, -6, mid, still, 60);
      expect(drift.run.dino.x - -6).toBeCloseTo(w.flowX, 1);
      const wade = pushFor(3, -6, mid, { moveX: 0, moveY: -1, actionPressed: false, jumpPressed: false }, 30);
      expect(wade.top).toBeLessThan(Math.hypot(DINO.baseSpeed * 0.56, w.flowX) + 0.1);
      const b = map.bridges[0];
      const bridge = pushFor(3, (b.x0 + b.x1) / 2, mid, still, 60);
      expect(bridge.run.dino.x).toBeCloseTo((b.x0 + b.x1) / 2, 6);
      const cross = pushFor(3, (b.x0 + b.x1) / 2, mid, { moveX: 0, moveY: -1, actionPressed: false, jumpPressed: false }, 30);
      expect(cross.top).toBeGreaterThan(DINO.baseSpeed - 0.1);
   });

   it("Volcanic Pass and the Sanctuary: an erupting vent hits like a boulder (stun, scatter); a glowing one does not, a dash rides it out", () => {
      for (const id of [4, 5] as const) {
         const v = LEVELS[id].map.vents[0];
         const run = createDinoRun(1, LEVELS[id]);
         silence(run);
         run.dino.x = v.x;
         run.dino.z = v.z;
         run.dino.carriedEggs = [1, 2];
         let warned = false;
         let hitAt = -1;
         const still: StepInput = { moveX: 0, moveY: 0, actionPressed: false, jumpPressed: false };
         for (let i = 0; i < 60 * v.periodS && hitAt < 0; i++) {
            const ev = stepDinoRun(run, still, 1 / 60);
            if (run.ventStates[0] === 1) {
               warned = true;
               expect(run.dino.stunTimer).toBe(0);
            }
            if (ev.ventHit) {
               expect(ev.boulderHit).toBe(true);
               expect(run.ventStates[0]).toBe(2);
               hitAt = run.timeS;
            }
         }
         expect(warned).toBe(true);
         expect(hitAt).toBeGreaterThan(0);
         expect(run.dino.stunTimer).toBeGreaterThan(0);
         expect(run.dino.carriedEggs).toHaveLength(0);
         expect(run.groundEggs.filter((e) => e.active)).toHaveLength(2);
         // a dash through the eruption is safe
         const dash = createDinoRun(1, LEVELS[id]);
         silence(dash);
         dash.dino.x = v.x;
         dash.dino.z = v.z;
         dash.timeS = hitAt - 1 / 60;
         dash.dino.dashTimer = 0.4;
         const ev = stepDinoRun(dash, still, 1 / 60);
         expect(ev.ventHit).toBe(false);
      }
   });

   it("level 4's golden egg is already out at 22 s; level 1's is not", () => {
      const hatched = (id: LevelId, seconds: number) => {
         const run = createDinoRun(2, LEVELS[id]);
         for (let i = 0; i < seconds * 30; i++) stepDinoRun(run, ZERO, 1 / 30);
         return run.goldenSpawnIndex;
      };
      expect(hatched(1, 22)).toBe(0);
      expect(hatched(4, 22)).toBe(1);
      expect(hatched(4, 62)).toBe(3);
   });

   it("level 5 starts with 6 eggs, carries 4 and pays 600 for them", () => {
      const run = createDinoRun(4, LEVELS[5]);
      expect(run.groundEggs.length).toBe(6);
      silence(run);
      run.dino.x = -10;
      run.dino.z = 0;
      for (let i = 0; i < 5; i++) run.groundEggs.push({ id: 100 + i, x: -10, z: 0.04 * i, isGolden: false, active: true });
      stepDinoRun(run, ZERO, 1 / 60);
      expect(run.dino.carriedEggs.length).toBe(4);
      expect(run.groundEggs.filter((egg) => egg.active && !egg.isGolden).length).toBe(1);
      run.dino.x = run.map.nest.x;
      run.dino.z = run.map.nest.z;
      stepDinoRun(run, ZERO, 1 / 60);
      expect(run.score).toBe(600);
   });

   it("the ground cap is the level's: level 5 keeps spawning while fewer than 6 eggs lie out, level 1 stops at 4", () => {
      expect(LEVELS[1].maxGroundEggs).toBe(EGGS.maxGroundEggs);
      for (const id of LEVEL_IDS) expect(LEVELS[id].maxGroundEggs).toBeGreaterThanOrEqual(LEVELS[id].initialSupply);
      const ticksSpawned = (id: LevelId, onGround: number) => {
         const run = createDinoRun(9, LEVELS[id]);
         silence(run);
         run.nextEggSpawnTick = 1;
         run.dino.x = run.map.nest.x;
         run.dino.z = run.map.nest.z;
         for (let i = 0; i < onGround; i++) run.groundEggs.push({ id: 200 + i, x: -12, z: -8 + i, isGolden: false, active: true });
         while (run.timeS < 3.05) stepDinoRun(run, ZERO, 1 / 60);
         return run.groundEggs.filter((egg) => egg.active && !egg.isGolden).length - onGround;
      };
      // five eggs out: level 5 (cap 6) adds the tick's egg, level 1 (cap 4) skips it
      expect(ticksSpawned(5, 5)).toBe(1);
      expect(ticksSpawned(1, 5)).toBe(0);
      expect(ticksSpawned(1, 3)).toBe(1);
      expect(ticksSpawned(5, 6)).toBe(0);
   });

   it("the boulder gap follows the level's ramp, not a hardcoded 90 s", () => {
      expect(boulderIntervalAt(60, 90)).toBeCloseTo(1.8, 8);
      expect(boulderIntervalAt(60, 60)).toBeCloseTo(1.2, 8);
      expect(boulderIntervalAt(0, 90)).toBe(BOULDERS.spawnIntervalStartS);
      for (const id of [1, 2] as const) {
         const run = createDinoRun(1, LEVELS[id]);
         let prev = run.nextBoulderSpawnTime;
         let checks = 0;
         while (run.timeS < 12) {
            stepDinoRun(run, ZERO, 1 / 60);
            if (run.nextBoulderSpawnTime !== prev) {
               expect(run.nextBoulderSpawnTime - prev).toBeCloseTo(boulderIntervalAt(run.timeS, LEVELS[id].spawnRampS), 5);
               prev = run.nextBoulderSpawnTime;
               checks++;
            }
         }
         expect(checks).toBeGreaterThan(2);
      }
   });

   it("a full stack still clears a lane inside the headway, on the fastest rocks", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const slow = DINO.baseSpeed * level.stackMultipliers[level.maxStack];
         const pass = (BOULDERS.radius * 2 + DINO.radius * 2) / Math.min(...level.speeds);
         const cross = (BOULDERS.radius * 2 + DINO.radius * 2) / slow;
         expect(cross + pass).toBeLessThanOrEqual(BOULDERS.headwayS);
      }
   });
});

describe("dino-egg-rescue levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B fits maxScore and base + pps t across the duration window`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const ceiling = scoreCeiling(level);
      expect(ceiling).toBeLessThanOrEqual(limits.maxScore);
      expect(limits.maxScore).toBeLessThanOrEqual(Math.ceil(ceiling * 1.05));
      expect(limits.minDurationMs).toBeLessThanOrEqual(level.durationMs - 2000);
      expect(limits.minDurationMs).toBeGreaterThan(level.durationMs - 3000);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(level.durationMs + 2000);
      expect(limits.maxDurationMs).toBeLessThan(level.durationMs + 3000);
      const minS = limits.minDurationMs / 1000;
      expect(ceiling).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * minS);
      expect(limits.maxScore).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * minS);
      expect(fitsLimits(ceiling, level.durationMs, limits)).toBe(true);
      expect(fitsLimits(limits.maxScore, limits.minDurationMs, limits)).toBe(true);
      expect(fitsLimits(limits.maxScore + 1, level.durationMs, limits)).toBe(false);
   });
});

describe("dino-egg-rescue levels: the same timing on touch and keyboard", () => {
   for (const id of LEVEL_IDS) it(`L${id}: Space and the Dash button play out the same`, () => {
      const key = createDinoRun(37, LEVELS[id]);
      const touch = createDinoRun(37, LEVELS[id]);
      const keyboard: StepInput = { moveX: 0.2, moveY: -0.7, actionPressed: true, jumpPressed: false };
      const pad: StepInput = { moveX: 0.2, moveY: -0.7, actionPressed: false, jumpPressed: true };
      for (let i = 0; i < 180; i++) {
         stepDinoRun(key, keyboard, 1 / 60);
         stepDinoRun(touch, pad, 1 / 60);
      }
      expect(touch.dino).toEqual(key.dino);
      expect(touch.score).toBe(key.score);
      expect(touch.boulders.map((boulder) => boulder.laneId)).toEqual(key.boulders.map((boulder) => boulder.laneId));
   });
});

const HZ = [30, 60, 144];
const SWEEP = { human: 200, oracle: 30, idle: 4, spam: 4 } as const;

describe("dino-egg-rescue levels: bots", () => {
   for (const id of LEVEL_IDS) {
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const levelMeta = meta.levels![id - 1];

      it(`L${id}: human clears, idle never does, every run fits the limits`, () => {
         const stats: Record<string, { clears: number; best: number; worst: number; runs: number }> = {};
         for (const profile of ["human", "oracle", "idle", "spam"] as const) {
            let clears = 0;
            let best = 0;
            let worst = Infinity;
            const runs = SWEEP[profile];
            for (let seed = 1; seed <= runs; seed++) {
               const run = play(seed, id, profile, HZ[seed % 3]);
               const ms = LEVELS[id].durationMs;
               expect(run.score).toBeLessThanOrEqual(scoreCeiling(LEVELS[id]));
               expect(fitsLimits(run.score, ms, limits)).toBe(true);
               expect(capToLimits(run.score, ms, limits)).toBe(run.score);
               if (isLevelCleared("timeup", run.score, levelMeta)) clears++;
               if (run.score > best) best = run.score;
               if (run.score < worst) worst = run.score;
            }
            stats[profile] = { clears, best, worst, runs };
         }
         console.info("dino-egg-rescue levels", id, JSON.stringify(stats));
         // clearScore is reachable on >= 99 % of honest seeds (gate rule)
         expect(stats.human.clears).toBeGreaterThanOrEqual(0.99 * SWEEP.human);
         expect(Math.max(stats.human.best, stats.oracle.best)).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         expect(stats.idle.clears).toBe(0);
         expect(stats.idle.best).toBe(0);
         expect(stats.spam.clears).toBe(0);
      }, 180000);

      it(`L${id}: the store run at 30/60/144 Hz stays inside the limits and capScore is a no-op`, () => {
         for (const profile of ["oracle", "human", "idle"] as const) for (const hz of HZ) {
            const store = createArcadeStore();
            const run = createDinoRun(id * 20 + hz, LEVELS[id]);
            const final = simulateRun(store, {
               durationMs: LEVELS[id].durationMs,
               frame: fixedFrames(1000 / hz),
               step(dt, _time, s) {
                  stepDinoRun(run, steer(run, profile), dt);
                  s.getState().setScore(run.score);
               },
            });
            expect(final.endReason).toBe("timeup");
            expect(final.elapsedMs).toBe(LEVELS[id].durationMs);
            expect(fitsLimits(final.score, final.elapsedMs, limits)).toBe(true);
            expect(capToLimits(final.score, final.elapsedMs, limits)).toBe(final.score);
            if (profile === "idle") expect(final.score).toBe(0);
         }
      }, 180000);
   }
});

// Gate review: knobs the declarations and bots did not pin (call sites mutation-probed).
describe("dino-egg-rescue levels: the simulation reads every level knob", () => {
   it("boulders roll at the level's lane speed", () => {
      for (const id of LEVEL_IDS) {
         const run = createDinoRun(5, LEVELS[id]);
         const seen = new Set<number>();
         for (let i = 0; i < 30 * 60 && seen.size < 4; i++) {
            stepDinoRun(run, ZERO, 1 / 30);
            for (const boulder of run.boulders) {
               if (!boulder.active) continue;
               expect(boulder.speed, `L${id} lane ${boulder.laneId}`).toBeCloseTo(LEVELS[id].speeds[boulder.laneId - 1], 9);
               seen.add(boulder.laneId);
            }
         }
         expect(seen.size).toBeGreaterThan(0);
      }
   });

   it("egg ids stay unique when the start pile is bigger than level 1's", () => {
      const run = createDinoRun(3, LEVELS[5]);
      // every egg ever laid, by id: an id must never be reused for a different egg
      const laid = new Map<number, string>();
      const record = () => {
         for (const egg of run.groundEggs) {
            const where = `${egg.x},${egg.z}`;
            expect(laid.get(egg.id) ?? where, `egg id ${egg.id}`).toBe(where);
            laid.set(egg.id, where);
         }
      };
      record();
      for (let i = 0; i < 30 * 20; i++) {
         run.groundEggs.forEach((egg, k) => { if (k < 3) egg.active = false; });
         stepDinoRun(run, ZERO, 1 / 30);
         record();
      }
      expect(laid.size).toBeGreaterThan(LEVELS[5].initialSupply + 3);
   });

   it("the ceiling reads the level's delivery table and golden schedule", () => {
      const knobs: DinoLevel = { ...LEVELS[1], deliveryPoints: [0, 100, 240, 450, 1000], goldenSpawnTimes: [20] };
      expect(maxPointsPerEgg(knobs)).toBe(250);
      expect(scoreCeiling(knobs)).toBe(regularSupply(knobs) * 250 + EGGS.points.golden);
   });
});
