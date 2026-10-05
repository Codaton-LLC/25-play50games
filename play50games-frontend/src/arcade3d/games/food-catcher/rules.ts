// Food Catcher rules. Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
// Scene draws the seed and calls step() with the frame dt. README.md is the design.
//
// Fall height is computed from the clock (spawn frame elapsed -> now), never by adding
// speed * dt onto a stored y. The spawn schedule is an integer-millisecond clock.

import { foodCatcherMeta } from "./meta";

// ---------- tuning (README constants table) ----------

export const ROUND_MS = 90_000;
export const LIVES = 3;
export const MAX_ALIVE = 16;

export const CHEF = {
   maxSpeed: 9,
   accel: 45,
   decel: 45,
   minX: -3.5,
   maxX: 3.5,
} as const;

/** Catch box: width 1.4 centred on the chef, top y = 1.6, bottom y = 0. */
export const CATCH_BOX = { halfWidth: 0.7, top: 1.6, bottom: 0 } as const;
export const ITEM_RADIUS = 0.35;
export const SPAWN_Y = 6;
export const FALL_DISTANCE = SPAWN_Y - CATCH_BOX.top;
export const SPAWN_X = { min: -3.4, max: 3.4 } as const;

export const GOOD_POINTS = 10;
export const DOUBLE_POINTS = 20;
/** The catch that makes the combo this big, and every catch after it, scores double. */
export const COMBO_DOUBLE_AT = 5;

export const MAX_SCORE = foodCatcherMeta.scoring.maxScore;
export const MAX_POINTS_PER_SEC = foodCatcherMeta.scoring.maxPointsPerSec;

export const GOOD_KINDS = ["apple", "banana", "burger"] as const;
export const BAD_KINDS = ["sock", "tinCan"] as const;
export type ItemKind = (typeof GOOD_KINDS)[number] | (typeof BAD_KINDS)[number];

/** Step table. Bracket is [start, end). Speed and bad chance use the spawn's own timestamp. */
export const STEPS = [
   { start: 0, end: 15_000, gap: 1200, speed: 1.6, badChance: 0.12 },
   { start: 15_000, end: 30_000, gap: 1000, speed: 2, badChance: 0.16 },
   { start: 30_000, end: 45_000, gap: 800, speed: 2.4, badChance: 0.2 },
   { start: 45_000, end: 60_000, gap: 650, speed: 2.9, badChance: 0.24 },
   { start: 60_000, end: 75_000, gap: 550, speed: 3.3, badChance: 0.28 },
   { start: 75_000, end: 90_000, gap: 500, speed: 3.8, badChance: 0.32 },
] as const;

// ---------- schedule ----------

function stepRow(t: number): (typeof STEPS)[number] {
   for (let i = 0; i < STEPS.length; i++) {
      if (t < STEPS[i].end) return STEPS[i];
   }
   return STEPS[STEPS.length - 1];
}

/** Min gap for a wait that starts at t (integer ms). */
export function gapForWaitStart(t: number): number {
   return stepRow(t).gap;
}

export function speedForSpawn(spawnMs: number): number {
   return stepRow(spawnMs).speed;
}

export function badChanceForSpawn(spawnMs: number): number {
   return stepRow(spawnMs).badChance;
}

/**
 * Spawn times on the integer clock. A wait starts at 0 and again after every spawn.
 * The gap is the step that contains the start of the wait. A spawn is kept only when
 * its time is under `roundMs`.
 */
export function spawnTimes(roundMs = ROUND_MS): number[] {
   const times: number[] = [];
   let t = 0;
   for (;;) {
      const next = t + gapForWaitStart(t);
      if (next >= roundMs) break;
      times.push(next);
      t = next;
   }
   return times;
}

/** Item centre y. `bornMs` is the clock on the frame the item appeared (it does not fall that frame). */
export function itemY(bornMs: number, elapsedMs: number, speed: number): number {
   const fallMs = elapsedMs - bornMs;
   if (fallMs <= 0) return SPAWN_Y;
   return SPAWN_Y - (speed * fallMs) / 1000;
}

/** Circle (item centre, ITEM_RADIUS) vs the chef's catch box. Touching counts. */
export function overlapsCatchBox(itemX: number, itemYPos: number, chefX: number): boolean {
   const minX = chefX - CATCH_BOX.halfWidth;
   const maxX = chefX + CATCH_BOX.halfWidth;
   const nearestX = itemX < minX ? minX : itemX > maxX ? maxX : itemX;
   const nearestY = itemYPos < CATCH_BOX.bottom ? CATCH_BOX.bottom : itemYPos > CATCH_BOX.top ? CATCH_BOX.top : itemYPos;
   const dx = itemX - nearestX;
   const dy = itemYPos - nearestY;
   return dx * dx + dy * dy <= ITEM_RADIUS * ITEM_RADIUS;
}

/** Points for a good catch that brings the combo to `comboAfter` (1-based). */
export function catchPoints(comboAfter: number): number {
   return comboAfter >= COMBO_DOUBLE_AT ? DOUBLE_POINTS : GOOD_POINTS;
}

/**
 * Clamp submitted by the shell: min(score, 5000, floor(50 * duration_s)).
 * `floor(50 * durationMs / 1000)` is that floor in integer milliseconds.
 */
export function finalScore(score: number, durationMs: number): { score: number; durationMs: number } {
   const budget = Math.floor((MAX_POINTS_PER_SEC * durationMs) / 1000);
   return { score: Math.min(score, MAX_SCORE, budget), durationMs };
}

export function withinServerLimits(score: number, durationMs: number): boolean {
   if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return false;
   if (durationMs < foodCatcherMeta.scoring.minDurationMs || durationMs > foodCatcherMeta.scoring.maxDurationMs) return false;
   return score * 1000 <= MAX_POINTS_PER_SEC * durationMs;
}

// ---------- rng ----------

/** mulberry32. Returns floats in [0, 1). The seed always comes from the caller. */
export function createRng(seed: number): () => number {
   let a = seed >>> 0;
   return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
}

// ---------- run ----------

export interface SpawnDef {
   time: number;
   speed: number;
   bad: boolean;
   kind: ItemKind;
   x: number;
}

export interface Item {
   active: boolean;
   bad: boolean;
   kind: ItemKind;
   x: number;
   speed: number;
   /** Clock value of the frame the item appeared. y = 6 on that frame. */
   bornMs: number;
   spawnIndex: number;
}

export interface StepEvents {
   /** Good items caught this frame. */
   caught: number;
   /** Good items that crossed the box and were not caught. A dodged bad item is not a miss. */
   missed: number;
   badCaught: number;
   lifeLost: boolean;
   ended: "lose" | "timeup" | null;
}

export interface StepInput {
   /** Touch: world x the chef walks toward, at most maxSpeed * dt, without passing it. */
   targetX?: number | null;
   /** Keyboard: -1 left, 1 right, 0 released. Used only when targetX is not a number. */
   dir?: -1 | 0 | 1;
}

export interface RunOptions {
   /** Skip the bad roll for every spawn. Kind and x are still rolled. */
   forceGood?: boolean;
   /** Alive cap. The schedule still advances when a spawn is refused. */
   maxAlive?: number;
}

export interface RunState {
   seed: number;
   elapsedMs: number;
   chefX: number;
   chefV: number;
   score: number;
   combo: number;
   lives: number;
   ended: "lose" | "timeup" | null;
   nextSpawn: number;
   plan: SpawnDef[];
   items: Item[];
   alive: number;
   maxAlive: number;
   events: StepEvents;
}

export function buildPlan(seed: number, forceGood = false): SpawnDef[] {
   const times = spawnTimes(ROUND_MS);
   const rng = createRng(seed);
   const plan: SpawnDef[] = [];
   for (let i = 0; i < times.length; i++) {
      const time = times[i];
      // The first three spawns skip the bad roll. forceGood skips it for the rest too.
      const bad = i >= 3 && !forceGood && rng() < badChanceForSpawn(time);
      const kind = bad
         ? BAD_KINDS[Math.floor(rng() * BAD_KINDS.length)]
         : GOOD_KINDS[Math.floor(rng() * GOOD_KINDS.length)];
      const x = SPAWN_X.min + rng() * (SPAWN_X.max - SPAWN_X.min);
      plan.push({ time, speed: speedForSpawn(time), bad, kind, x });
   }
   return plan;
}

function makeItem(): Item {
   return { active: false, bad: false, kind: "apple", x: 0, speed: 0, bornMs: 0, spawnIndex: -1 };
}

function makeEvents(): StepEvents {
   return { caught: 0, missed: 0, badCaught: 0, lifeLost: false, ended: null };
}

export function createRun(seed: number, options: RunOptions = {}): RunState {
   const maxAlive = options.maxAlive ?? MAX_ALIVE;
   const items: Item[] = [];
   for (let i = 0; i < maxAlive; i++) items.push(makeItem());
   return {
      seed,
      elapsedMs: 0,
      chefX: 0,
      chefV: 0,
      score: 0,
      combo: 0,
      lives: LIVES,
      ended: null,
      nextSpawn: 0,
      plan: buildPlan(seed, options.forceGood === true),
      items,
      alive: 0,
      maxAlive,
      events: makeEvents(),
   };
}

function clearEvents(events: StepEvents): void {
   events.caught = 0;
   events.missed = 0;
   events.badCaught = 0;
   events.lifeLost = false;
   events.ended = null;
}

function approach(value: number, target: number, rate: number, dt: number): number {
   const delta = target - value;
   const max = rate * dt;
   if (delta > max) return value + max;
   if (delta < -max) return value - max;
   return target;
}

function moveChef(state: RunState, dtMs: number, input: StepInput): void {
   const dt = dtMs / 1000;
   if (!(dt > 0)) return;
   if (typeof input.targetX === "number") {
      const goal = input.targetX < CHEF.minX ? CHEF.minX : input.targetX > CHEF.maxX ? CHEF.maxX : input.targetX;
      const maxStep = CHEF.maxSpeed * dt;
      const dx = goal - state.chefX;
      const step = dx > maxStep ? maxStep : dx < -maxStep ? -maxStep : dx;
      state.chefX += step;
      state.chefV = step / dt;
      return;
   }
   const dir = input.dir ?? 0;
   const desired = dir * CHEF.maxSpeed;
   state.chefV = approach(state.chefV, desired, dir === 0 ? CHEF.decel : CHEF.accel, dt);
   state.chefX += state.chefV * dt;
   if (state.chefX < CHEF.minX) {
      state.chefX = CHEF.minX;
      if (state.chefV < 0) state.chefV = 0;
   } else if (state.chefX > CHEF.maxX) {
      state.chefX = CHEF.maxX;
      if (state.chefV > 0) state.chefV = 0;
   }
}

function takeSlot(state: RunState): Item | null {
   const items = state.items;
   for (let i = 0; i < items.length; i++) {
      if (!items[i].active) return items[i];
   }
   return null;
}

/** Spawn every plan entry whose time has arrived. A full board skips the entry and does not queue it. */
function spawnDue(state: RunState): void {
   const plan = state.plan;
   while (state.nextSpawn < plan.length && plan[state.nextSpawn].time <= state.elapsedMs) {
      const def = plan[state.nextSpawn];
      state.nextSpawn += 1;
      if (state.alive >= state.maxAlive) continue;
      const slot = takeSlot(state);
      if (!slot) continue;
      slot.active = true;
      slot.bad = def.bad;
      slot.kind = def.kind;
      slot.x = def.x;
      slot.speed = def.speed;
      // Appears at y = 6 on this frame. Fall starts on the next one.
      slot.bornMs = state.elapsedMs;
      slot.spawnIndex = state.nextSpawn - 1;
      state.alive += 1;
   }
}

function endRun(state: RunState, reason: "lose" | "timeup"): void {
   if (state.ended) return;
   state.ended = reason;
   state.events.ended = reason;
}

function resolveCross(state: RunState, item: Item, yNow: number): void {
   item.active = false;
   state.alive -= 1;
   const hit = overlapsCatchBox(item.x, yNow, state.chefX);
   if (item.bad) {
      if (!hit) return;
      state.combo = 0;
      state.events.badCaught += 1;
      state.events.lifeLost = true;
      state.lives -= 1;
      if (state.lives <= 0) {
         state.lives = 0;
         endRun(state, "lose");
      }
      return;
   }
   if (!hit) {
      state.combo = 0;
      state.events.missed += 1;
      return;
   }
   state.combo += 1;
   state.score += catchPoints(state.combo);
   state.events.caught += 1;
}

/**
 * Advance one frame. `dtMs` <= 0 is ignored. Returns the run's event object (reused; read it
 * before the next step). After `ended` is set, further steps change nothing.
 */
export function step(state: RunState, dtMs: number, input: StepInput = {}): StepEvents {
   const events = state.events;
   clearEvents(events);
   if (state.ended || !(dtMs > 0)) return events;

   const prev = state.elapsedMs;
   let elapsed = prev + dtMs;
   if (elapsed > ROUND_MS) elapsed = ROUND_MS;
   state.elapsedMs = elapsed;

   moveChef(state, elapsed - prev, input);
   spawnDue(state);

   // Resolve crossings in spawn order. n is at most the slot count (16).
   const items = state.items;
   for (let n = 0; n < items.length; n++) {
      if (state.ended) break;
      let pick = -1;
      let pickIndex = Infinity;
      for (let i = 0; i < items.length; i++) {
         const item = items[i];
         if (!item.active || item.bornMs > prev) continue;
         const yPrev = itemY(item.bornMs, prev, item.speed);
         const yNow = itemY(item.bornMs, state.elapsedMs, item.speed);
         if (!(yPrev > CATCH_BOX.top && yNow <= CATCH_BOX.top)) continue;
         if (item.spawnIndex < pickIndex) {
            pickIndex = item.spawnIndex;
            pick = i;
         }
      }
      if (pick < 0) break;
      const item = items[pick];
      resolveCross(state, item, itemY(item.bornMs, state.elapsedMs, item.speed));
   }

   if (!state.ended && state.elapsedMs >= ROUND_MS) endRun(state, "timeup");
   return events;
}
