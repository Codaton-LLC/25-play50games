// Wizard Potion Lab rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.
// Scene.tsx calls step() from one useRunFrame. Same seed + level + inputs = same run.
//
// A round lab. Shelves stand on a ring, one per ingredient type the recipes use. The cauldron
// is the origin. Carry one item. Use adds it only when it is the head of an open recipe.
import { createRng, inputToWorld, turnTowards } from "@/arcade3d/core/math";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type WizardLevel } from "./levels";

export const TYPES = ["mushroom", "crystal", "berry", "flower", "herb", "bottle"] as const;
export type Ingredient = (typeof TYPES)[number];

export const RECIPE_POINTS = 300;
export const CLEAN_POINTS = 80;
/** Win only: full seconds left on the shell clock. */
export const TIME_BONUS_PER_SECOND = 4;

export const RADIUS = 0.36;
export const MAX_SPEED = 4.4;
export const ACCEL = 22;
export const BRAKE = 28;
export const USE_RANGE = 1.2;
export const STUN_S = 0.6;
export const REACH_S = 0.45;
/** Outer radius of the 0.9 m cauldron (EXPANSION_ASSETS.cauldron). */
export const CAULDRON_BODY = 0.45;
/** Where a player stands to reach the pot: just outside the body. */
export const POT_STAND = CAULDRON_BODY + RADIUS + 0.3;
export const WANDER_LEN = 3;
export const WANDER_PERIOD = 3.6;
export const SHELF_ORBIT = 1.2;
export const SHELF_R = 0.46;
export const TABLE_R = 0.52;
/** How far inside the item the bot (and a fair stand) stops. */
export const STAND_IN = 0.85;

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/** Measured oracle, plus about a second of room. base is the clean ceiling, 380 × recipes. */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: { ...PTS, maxScore: 1260, minDurationMs: 4000, maxDurationMs: 120_000, base: 760, maxPointsPerSec: 64 },
   2: { ...PTS, maxScore: 1710, minDurationMs: 4000, maxDurationMs: 150_000, base: 1140, maxPointsPerSec: 28 },
   3: { ...PTS, maxScore: 2110, minDurationMs: 4000, maxDurationMs: 180_000, base: 1520, maxPointsPerSec: 12 },
   4: { ...PTS, maxScore: 2350, minDurationMs: 4000, maxDurationMs: 180_000, base: 1900, maxPointsPerSec: 8 },
   5: { ...PTS, maxScore: 2760, minDurationMs: 4000, maxDurationMs: 210_000, base: 2280, maxPointsPerSec: 8 },
};

export interface Shelf {
   type: Ingredient;
   /** home on the ring */
   x: number;
   z: number;
   angle: number;
   /** unit tangent, the 3 m wander slides along this */
   tx: number;
   tz: number;
   wander: boolean;
}

export interface Recipe {
   steps: Ingredient[];
   at: number;
   open: boolean;
   done: boolean;
   /** false after a wrong add while this recipe was open */
   clean: boolean;
}

export interface StepEvents {
   score: number;
   lifeLost: boolean;
   won: boolean;
   lost: boolean;
   added: boolean;
   wrong: boolean;
   picked: boolean;
   /** recipe index that just finished, or -1 */
   brewed: number;
}

export interface Run {
   seed: number;
   level: WizardLevel;
   hero: { x: number; z: number; vx: number; vz: number; yaw: number; stun: number };
   shelves: Shelf[];
   recipes: Recipe[];
   carried: Ingredient | null;
   /** last ingredient the cauldron accepted */
   brew: Ingredient | null;
   /** seconds left on the add pose */
   reach: number;
   lives: number;
   score: number;
   done: number;
   over: "win" | "lose" | null;
   time: number;
   table: { x: number; z: number; rotY: number };
   ev: StepEvents;
}

export interface LabInput {
   moveX: number;
   moveY: number;
   actionPressed: boolean;
   /** camera yaw from useFittedView; keyboard and touch both land here */
   yaw: number;
}

export const idleInput = (): LabInput => ({ moveX: 0, moveY: 0, actionPressed: false, yaw: 0 });

const DIR = { x: 0, z: 0 };
const ITEM = { x: 0, z: 0 };

export function timeBonus(timeLeftMs: number): number {
   return TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, timeLeftMs) / 1000);
}

/** Clean objective points. The clock bonus is separate and win-only. */
export function objectiveCeiling(level: WizardLevel): number {
   return (RECIPE_POINTS + CLEAN_POINTS) * level.recipes;
}

/** Offset along the shelf tangent, −1.5..1.5. Zero at t = 0 so the mesh starts on the shelf. */
export function wanderAlong(time: number): number {
   return Math.sin((time * Math.PI * 2) / WANDER_PERIOD) * (WANDER_LEN / 2);
}

/** World XZ of a shelf's ingredient. The pickup radius follows this point. */
export function itemXZ(shelf: Shelf, time: number, out: { x: number; z: number } = ITEM): { x: number; z: number } {
   const along = shelf.wander ? wanderAlong(time) : 0;
   out.x = shelf.x + shelf.tx * along;
   out.z = shelf.z + shelf.tz * along;
   return out;
}

export function shelfFor(run: Run, type: Ingredient): Shelf | null {
   for (const shelf of run.shelves) if (shelf.type === type) return shelf;
   return null;
}

function typeIndex(rng: () => number, prev: number): number {
   const n = TYPES.length;
   if (prev < 0) return Math.floor(rng() * n);
   const pick = Math.floor(rng() * (n - 1));
   return pick >= prev ? pick + 1 : pick;
}

function makeRecipe(rng: () => number, steps: number): Ingredient[] {
   const list: Ingredient[] = [];
   let prev = -1;
   for (let i = 0; i < steps; i++) {
      prev = typeIndex(rng, prev);
      list.push(TYPES[prev]);
   }
   return list;
}

function refreshOpen(run: Run): void {
   const want = run.level.dual ? 2 : 1;
   let count = 0;
   for (const recipe of run.recipes) {
      if (recipe.done) recipe.open = false;
      else if (recipe.open) count += 1;
   }
   for (const recipe of run.recipes) {
      if (count >= want) break;
      if (!recipe.done && !recipe.open) {
         recipe.open = true;
         count += 1;
      }
   }
}

function placeTable(shelves: readonly Shelf[], radius: number): { x: number; z: number; rotY: number } {
   const sorted = [...shelves].sort((a, b) => a.angle - b.angle);
   let bestGap = -1;
   let mid = 0;
   for (let i = 0; i < sorted.length; i++) {
      const a0 = sorted[i].angle;
      const a1 = i + 1 < sorted.length ? sorted[i + 1].angle : sorted[0].angle + Math.PI * 2;
      const gap = a1 - a0;
      if (gap > bestGap) {
         bestGap = gap;
         mid = (a0 + a1) / 2;
      }
   }
   const orbit = radius - 0.72;
   return { x: Math.sin(mid) * orbit, z: Math.cos(mid) * orbit, rotY: mid + Math.PI };
}

export function createRun(seed: number, level: WizardLevel = LEVELS[1]): Run {
   const rng = createRng(seed >>> 0);
   const recipes: Recipe[] = [];
   const used = new Set<Ingredient>();
   for (let i = 0; i < level.recipes; i++) {
      const steps = makeRecipe(rng, level.steps);
      for (const step of steps) used.add(step);
      recipes.push({ steps, at: 0, open: false, done: false, clean: true });
   }
   const spin = rng() * Math.PI * 2;
   const types = TYPES.filter((type) => used.has(type));
   const orbit = level.radius - SHELF_ORBIT;
   const shelves: Shelf[] = types.map((type, index) => {
      const angle = spin + (index / types.length) * Math.PI * 2;
      return {
         type,
         x: Math.sin(angle) * orbit,
         z: Math.cos(angle) * orbit,
         angle,
         tx: Math.cos(angle),
         tz: -Math.sin(angle),
         wander: false,
      };
   });
   if (level.wander && shelves.length > 0) {
      shelves[Math.floor(rng() * shelves.length)].wander = true;
   }
   const run: Run = {
      seed,
      level,
      hero: { x: 0, z: POT_STAND, vx: 0, vz: 0, yaw: Math.PI, stun: 0 },
      shelves,
      recipes,
      carried: null,
      brew: null,
      reach: 0,
      lives: level.lives ?? 0,
      score: 0,
      done: 0,
      over: null,
      time: 0,
      table: placeTable(shelves, level.radius),
      ev: { score: 0, lifeLost: false, won: false, lost: false, added: false, wrong: false, picked: false, brewed: -1 },
   };
   refreshOpen(run);
   return run;
}

function integrate(body: { vx: number; vz: number }, dirX: number, dirZ: number, dt: number): void {
   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }
   let dvx = dirX * MAX_SPEED - body.vx;
   let dvz = dirZ * MAX_SPEED - body.vz;
   const dv = Math.hypot(dvx, dvz);
   const cap = (len > 0.01 ? ACCEL : BRAKE) * dt;
   if (dv > cap && dv > 0) {
      dvx *= cap / dv;
      dvz *= cap / dv;
   }
   body.vx += dvx;
   body.vz += dvz;
}

function pushOut(body: Run["hero"], cx: number, cz: number, minDist: number): void {
   let dx = body.x - cx;
   let dz = body.z - cz;
   let d = Math.hypot(dx, dz);
   if (d >= minDist) return;
   if (d < 1e-6) {
      dx = 1;
      dz = 0;
      d = 1;
   }
   const nx = dx / d;
   const nz = dz / d;
   body.x = cx + nx * minDist;
   body.z = cz + nz * minDist;
   const vn = body.vx * nx + body.vz * nz;
   if (vn < 0) {
      body.vx -= vn * nx;
      body.vz -= vn * nz;
   }
}

function clampWall(hero: Run["hero"], limit: number): void {
   const d = Math.hypot(hero.x, hero.z);
   if (d <= limit || d < 1e-6) return;
   const k = limit / d;
   hero.x *= k;
   hero.z *= k;
   const nx = hero.x / limit;
   const nz = hero.z / limit;
   const vn = hero.vx * nx + hero.vz * nz;
   if (vn > 0) {
      hero.vx -= vn * nx;
      hero.vz -= vn * nz;
   }
}

function resolve(run: Run): void {
   const hero = run.hero;
   const limit = run.level.radius - RADIUS;
   for (let pass = 0; pass < 2; pass++) {
      pushOut(hero, 0, 0, CAULDRON_BODY + RADIUS);
      for (const shelf of run.shelves) pushOut(hero, shelf.x, shelf.z, SHELF_R + RADIUS);
      pushOut(hero, run.table.x, run.table.z, TABLE_R + RADIUS);
      clampWall(hero, limit);
   }
}

function headIndex(run: Run, type: Ingredient): number {
   for (let i = 0; i < run.recipes.length; i++) {
      const recipe = run.recipes[i];
      if (recipe.open && !recipe.done && recipe.steps[recipe.at] === type) return i;
   }
   return -1;
}

function finishRecipe(run: Run, index: number, timeLeftMs: number): void {
   const recipe = run.recipes[index];
   recipe.done = true;
   recipe.open = false;
   const pts = RECIPE_POINTS + (recipe.clean ? CLEAN_POINTS : 0);
   run.score += pts;
   run.ev.score += pts;
   run.ev.brewed = index;
   run.done += 1;
   refreshOpen(run);
   if (run.done !== run.recipes.length) return;
   const bonus = timeBonus(timeLeftMs);
   run.score += bonus;
   run.ev.score += bonus;
   run.over = "win";
   run.ev.won = true;
}

function accept(run: Run, index: number, timeLeftMs: number): void {
   const recipe = run.recipes[index];
   run.brew = recipe.steps[recipe.at];
   recipe.at += 1;
   run.carried = null;
   run.reach = REACH_S;
   run.ev.added = true;
   if (recipe.at >= recipe.steps.length) finishRecipe(run, index, timeLeftMs);
}

function wrongAdd(run: Run): void {
   run.carried = null;
   run.hero.stun = STUN_S;
   run.ev.wrong = true;
   for (const recipe of run.recipes) {
      if (recipe.open && !recipe.done) recipe.clean = false;
   }
   if (!run.level.wrongCostsLife) return;
   run.lives -= 1;
   run.ev.lifeLost = true;
   if (run.lives <= 0) {
      run.over = "lose";
      run.ev.lost = true;
   }
}

function nearestShelf(run: Run): Shelf | null {
   let best: Shelf | null = null;
   let bestD = USE_RANGE;
   for (const shelf of run.shelves) {
      itemXZ(shelf, run.time, ITEM);
      const d = Math.hypot(run.hero.x - ITEM.x, run.hero.z - ITEM.z);
      if (d <= bestD) {
         bestD = d;
         best = shelf;
      }
   }
   return best;
}

function useAction(run: Run, timeLeftMs: number): void {
   if (run.carried) {
      const shelf = shelfFor(run, run.carried);
      const dShelf = shelf ? Math.hypot(run.hero.x - itemXZ(shelf, run.time, ITEM).x, run.hero.z - ITEM.z) : Infinity;
      const dPot = Math.hypot(run.hero.x, run.hero.z);
      if (dShelf <= USE_RANGE && dShelf < dPot) {
         run.carried = null;
         return;
      }
      if (dPot <= USE_RANGE) {
         const hit = headIndex(run, run.carried);
         if (hit < 0) wrongAdd(run);
         else accept(run, hit, timeLeftMs);
      }
      return;
   }
   const shelf = nearestShelf(run);
   if (shelf) {
      run.carried = shelf.type;
      run.ev.picked = true;
   }
}

/**
 * One played frame. `timeLeftMs` is the shell clock. Keyboard and touch share this function:
 * only the stick, `actionPressed` and `yaw` matter, for the same durations.
 */
export function step(run: Run, input: LabInput, dt: number, timeLeftMs = 0): StepEvents {
   const ev = run.ev;
   ev.score = 0;
   ev.lifeLost = false;
   ev.won = false;
   ev.lost = false;
   ev.added = false;
   ev.wrong = false;
   ev.picked = false;
   ev.brewed = -1;
   if (run.over || !(dt > 0)) return ev;
   run.time += dt;
   if (run.reach > 0) run.reach = Math.max(0, run.reach - dt);

   const stunned = run.hero.stun > 0;
   if (stunned) run.hero.stun = Math.max(0, run.hero.stun - dt);
   inputToWorld(stunned ? 0 : input.moveX, stunned ? 0 : input.moveY, input.yaw, DIR);
   integrate(run.hero, DIR.x, DIR.z, dt);
   run.hero.x += run.hero.vx * dt;
   run.hero.z += run.hero.vz * dt;
   resolve(run);
   const speed = Math.hypot(run.hero.vx, run.hero.vz);
   if (speed > 0.25) run.hero.yaw = turnTowards(run.hero.yaw, Math.atan2(run.hero.vx, run.hero.vz), Math.min(1, dt * 12));
   if (!stunned && input.actionPressed) useAction(run, timeLeftMs);
   return ev;
}
