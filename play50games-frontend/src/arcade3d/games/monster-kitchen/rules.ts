// Monster Kitchen rules: the seeded ingredient wheel, the toss, the two serving windows with their
// picky monsters, patience, the burp, the drift and the score. Pure and deterministic: no three.js,
// React, DOM, Math.random or Date.now. Scene.tsx feeds it input, dt and the play time every frame;
// rules.test.ts drives it directly and through the real store. Same seed = same kitchen.
//
// Units: metres and seconds; x right (the wheel is at -x), z towards the camera (the counter front is
// +z), y up. The server limits in meta.ts rest on the numbers below (toss cadence, the serve
// windows, patience): README.md "Server limits and why they hold" has the proof, rules.test.ts checks it.
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { rngNext } from "@/arcade3d/core/math";
import { monsterKitchenMeta } from "./meta";

// ---------- tuning ----------

export const DURATION_MS = 90_000;

/** The lazy Susan on the counter. `front` is the ring position facing the camera (+z). */
export const WHEEL = {
   x: -2.0,
   y: 0.9,
   z: 0,
   discR: 0.95,
   ringR: 0.75,
   slots: 8,
   /** visual easing per slot (s); the rules apply a rotation at once (the limit model grants it) */
   rotateS: 0.18,
   /** ring position at the front centre; the tappable front arc is front-1 .. front+1 (5..7) */
   front: 6,
} as const;

/** The 8 ingredient kinds on the wheel (the last two are procedural in the Scene). */
export const INGREDIENTS = {
   kinds: ["apple", "banana", "burger", "sock", "tinCan", "fish", "eyeball", "slime"] as const,
   /** a tossed slot stays empty this long, then refills with a new seeded kind (s) */
   refillS: 0.9,
} as const;

/** One ingredient in flight at a time; it resolves at landing; a wrong landing burps. */
export const TOSS = {
   flightS: 0.55,
   /** a burp locks the tosses this long (s, from the landing) */
   burpLockS: 1.2,
   /** the fixed parabola's peak over the straight line (m) and where it lands (above the rim) */
   arcH: 0.7,
   mouthX: 0,
   mouthY: 1.62,
   mouthZ: -0.1,
} as const;

/** The monster queue: at most one ordering monster per window; a third waits dimmed behind. */
export const ORDERS = {
   /** the first order appears this long after the run starts (s) */
   firstAtS: 0.5,
   /** the second window opens at this time (s): its first monster walks in, its order is at +walkInS */
   windowBAtS: 70,
   /** patience drain pauses this long after the order appears (reading time; penalties still apply) */
   graceS: 1.5,
   /** on completion the monster eats, dances and tips this long (s), then the next walks in */
   eatS: 2.0,
   /** the next monster's walk-in (s); its order appears at the end of it */
   walkInS: 0.8,
   /** the order length band's maximum by the monster's arrival time t (s): 3 below 25, 4 at 25-50, 5 from 50 on */
   lenAt: (t: number) => (t < 25 ? 3 : t < 50 ? 4 : 5) as 3 | 4 | 5,
   /** the seeded pick inside the 3-4 / 4-5 bands: len = lo + (r < p ? 1 : 0) */
   lenPick: (t: number, r: number) => {
      if (t < 25) return 3;
      if (t < 50) return 3 + (r < 0.5 ? 1 : 0);
      return 4 + (r < 0.5 ? 1 : 0);
   },
} as const;

/** Patience: max 10; drains by type; a wrong toss costs 3; at 0 the monster leaves after 0.4 s. */
export const PATIENCE = {
   max: 10,
   penalty: 3,
   /** drain per second by type (the fastest, grumpy, sets the min-duration proof) */
   drains: { jolly: 1.0, greedy: 1.15, grumpy: 1.3 } as Record<MonsterType, number>,
   angryLeaveS: 0.4,
} as const;

/** From 50 s the wheel drifts on its own: every 6 s one slot, direction seeded. */
export const DRIFT = { fromS: 50, everyS: 6 } as const;

/** orderPoints = round(100 * FACTOR[len]) + round(5 * patienceLeft): 100 / 140 / 190 plus a tip <= 50. */
export const SCORING = {
   FACTOR: { 3: 1.0, 4: 1.4, 5: 1.9 } as const,
   perPatience: 5,
} as const;

// ---------- types ----------

export type IngredientKind = (typeof INGREDIENTS.kinds)[number];
export type MonsterType = "jolly" | "greedy" | "grumpy";
export type OrderPhase = "ordering" | "served" | "angry";

export interface Order {
   id: number;
   /** 0 = the left hatch slot (x -0.8), 1 = the right one (x +0.8) */
   window: 0 | 1;
   type: MonsterType;
   /** what the bubble asks, in order (repeats allowed) */
   kinds: IngredientKind[];
   /** how many of `kinds` are already in the pot */
   progress: number;
   /** play time the order appeared: the patience clock and the toss-eligibility cut */
   appearedAt: number;
   /** 0..PATIENCE.max */
   patience: number;
   phase: OrderPhase;
   /** when the current phase started (s): completion for "served", patience 0 for "angry") */
   phaseAt: number;
}

export interface Window {
   /** the monster at the hatch (null during the walk-in); always a dimmed one waits behind */
   order: Order | null;
   /** when the next order appears (Infinity while one is active or the window is closed) */
   arriveAt: number;
}

export interface Slot {
   kind: IngredientKind | null;
   /** a tossed slot refills at this play time */
   emptyUntil: number;
}

export interface Flight {
   kind: IngredientKind;
   /** the wheel slot it left (for the arc and the refill) */
   slot: number;
   launchAt: number;
   landAt: number;
   /** where it left from (the wheel may have turned since) */
   fromX: number;
   fromY: number;
   fromZ: number;
}

export interface Completed {
   window: number;
   type: MonsterType;
   len: number;
   base: number;
   tip: number;
   points: number;
}

export interface RunEvents {
   /** net slots the wheel turned this frame (any source) */
   rotated: number;
   /** the rotation came from a tap on an off-arc ingredient */
   tapRotated: boolean;
   /** the rotation came from the drift */
   drifted: boolean;
   /** a launch happened */
   tossed: boolean;
   /** a launch was ignored: a flight is up or the burp lock holds */
   tossBlocked: boolean;
   /** a tap hit an empty slot: a dull wobble */
   wobble: boolean;
   /** a landing advanced an eligible order */
   advanced: boolean;
   landed: "right" | "wrong" | null;
   completed: Completed | null;
   /** a wrong landing: the tosses locked and the earliest order restarted */
   burped: boolean;
   /** bitmask of the windows whose order appeared this frame */
   appeared: number;
   /** bitmask of the windows whose monster left angry this frame (Scene: loseLife) */
   angryLeft: number;
   /** bitmask of the windows whose served monster just walked off (the next walks in) */
   serveDone: number;
}

export interface StepInput {
   /** net rotation request this frame: -1 left, +1 right, 0 none */
   rotate: number;
   /** the wheel slot a canvas tap picked (Scene raycast), or null */
   tapSlot: number | null;
   /** Space / Enter: toss the centre front slot (ring position WHEEL.front) */
   tossCentre: boolean;
}

export interface RunState {
   seed: number;
   /** the seeded stream (rngNext): the layout, refills, drift, orders */
   rng: { s: number };
   /** the wheel index, 0..7 */
   rotation: number;
   slots: Slot[];
   windows: [Window, Window];
   flight: Flight | null;
   /** tosses ignored until this play time (the burp lock) */
   burpUntil: number;
   /** the next drift event at this play time */
   driftNextAt: number;
   nextOrderId: number;
   completions: number;
   /** play time of the last step (s) */
   time: number;
   events: RunEvents;
}

// ---------- the wheel ----------

/** The ring position (0..7) of slot k at `rotation`: 0 at +z, growing towards +x. */
export const ringPos = (slot: number, rotation: number) => ((slot + rotation) % WHEEL.slots + WHEEL.slots) % WHEEL.slots;

/** Is the slot in the tappable front arc (ring positions front-1 .. front+1)? */
export const isFront = (slot: number, rotation: number) => {
   const d = Math.abs(ringPos(slot, rotation) - WHEEL.front);
   return d === 1 || d === 0;
};

/** Where slot k stands on the ring (world, m). `front` faces +z. Writes into `out`. */
export function slotPosition(slot: number, rotation: number, out: { x: number; y: number; z: number }): void {
   const a = ((ringPos(slot, rotation) - WHEEL.front) * Math.PI) / 4;
   out.x = WHEEL.x + WHEEL.ringR * Math.sin(a);
   out.y = WHEEL.y;
   out.z = WHEEL.z + WHEEL.ringR * Math.cos(a);
}

/** The centre front slot: ring position WHEEL.front. */
export const centreSlot = (rotation: number) => ((WHEEL.front - rotation) % WHEEL.slots + WHEEL.slots) % WHEEL.slots;

/** The fixed toss parabola at fraction k (0..1) from the launch point to the cauldron mouth. */
export function tossArcPos(flight: Flight, k: number, out: { x: number; y: number; z: number }): void {
   const t = k < 0 ? 0 : k > 1 ? 1 : k;
   const lift = 4 * TOSS.arcH * t * (1 - t);
   out.x = flight.fromX + (TOSS.mouthX - flight.fromX) * t;
   out.y = flight.fromY + (TOSS.mouthY - flight.fromY) * t + lift;
   out.z = flight.fromZ + (TOSS.mouthZ - flight.fromZ) * t;
}

// ---------- the run ----------

const KIND_COUNT = INGREDIENTS.kinds.length;

const pickKind = (rng: { s: number }): IngredientKind => INGREDIENTS.kinds[Math.floor(rngNext(rng) * KIND_COUNT) % KIND_COUNT];

/**
 * The refill kind. A refill restocks a kind that is absent from the wheel (uniform among them,
 * seeded), so a needed ingredient always comes back within one refill and an order can never
 * soft-lock on a missing kind with every slot full; with a full wheel it draws a fresh seeded
 * kind. Alloc-free; deterministic from the run's stream.
 */
function pickRefillKind(run: RunState): IngredientKind {
   let pick: IngredientKind | null = null;
   let n = 0;
   for (const k of INGREDIENTS.kinds) {
      if (run.slots.some((s) => s.kind === k)) continue;
      n += 1;
      if (Math.floor(rngNext(run.rng) * n) === 0) pick = k; // reservoir sample: uniform over the absent
   }
   return pick ?? pickKind(run.rng);
}

export function createRun(seed: number): RunState {
   const rng = { s: seed };
   // one of each kind on the wheel, shuffled
   const layout = [...INGREDIENTS.kinds];
   for (let i = layout.length - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      [layout[i], layout[j]] = [layout[j], layout[i]];
   }
   return {
      seed,
      rng,
      rotation: 0,
      slots: layout.map((kind) => ({ kind, emptyUntil: 0 })),
      windows: [
         { order: null, arriveAt: ORDERS.firstAtS },
         { order: null, arriveAt: ORDERS.windowBAtS + ORDERS.walkInS },
      ],
      flight: null,
      burpUntil: 0,
      driftNextAt: DRIFT.fromS,
      nextOrderId: 1,
      completions: 0,
      time: 0,
      events: freshEvents(),
   };
}

function freshEvents(): RunEvents {
   return {
      rotated: 0,
      tapRotated: false,
      drifted: false,
      tossed: false,
      tossBlocked: false,
      wobble: false,
      advanced: false,
      landed: null,
      completed: null,
      burped: false,
      appeared: 0,
      angryLeft: 0,
      serveDone: 0,
   };
}

const normalize = (r: number) => ((r % WHEEL.slots) + WHEEL.slots) % WHEEL.slots;

/** The monster types cycle by a seeded roll (each a third). */
function pickType(rng: { s: number }): MonsterType {
   const r = rngNext(rng);
   return r < 1 / 3 ? "jolly" : r < 2 / 3 ? "greedy" : "grumpy";
}

function spawnOrder(run: RunState, w: 0 | 1, at: number): void {
   const t = pickType(run.rng);
   const len = ORDERS.lenPick(at, rngNext(run.rng));
   const kinds: IngredientKind[] = [];
   for (let i = 0; i < len; i++) kinds.push(pickKind(run.rng));
   run.windows[w].order = {
      id: run.nextOrderId++,
      window: w,
      type: t,
      kinds,
      progress: 0,
      appearedAt: at,
      patience: PATIENCE.max,
      phase: "ordering",
      phaseAt: at,
   };
   run.windows[w].arriveAt = Infinity;
   run.events.appeared |= 1 << w;
}

/** orderPoints: round(100 * FACTOR[len]) + round(5 * patienceLeft). The single score source. */
export function orderPoints(len: number, patienceLeft: number): { base: number; tip: number; points: number } {
   const base = Math.round(100 * SCORING.FACTOR[len as keyof typeof SCORING.FACTOR]);
   const tip = Math.round(SCORING.perPatience * Math.max(0, Math.min(PATIENCE.max, patienceLeft)));
   return { base, tip, points: base + tip };
}

/** The earliest-arrived ordering order, or null. */
function earliestOrdering(run: RunState): Order | null {
   let best: Order | null = null;
   for (const w of run.windows) {
      const o = w.order;
      if (!o || o.phase !== "ordering") continue;
      if (!best || o.appearedAt < best.appearedAt || (o.appearedAt === best.appearedAt && o.id < best.id)) best = o;
   }
   return best;
}

/** Launch a toss from `slot` at the current play time. Returns false when it cannot fly. */
function launch(run: RunState, slot: number): boolean {
   const s = run.slots[slot];
   const time = run.time;
   if (run.flight || time < run.burpUntil - 1e-9) {
      run.events.tossBlocked = true;
      return false;
   }
   if (s.kind === null) return false; // the caller turns this into a wobble
   const at = { x: 0, y: 0, z: 0 };
   slotPosition(slot, run.rotation, at);
   run.flight = { kind: s.kind, slot, launchAt: time, landAt: time + TOSS.flightS, fromX: at.x, fromY: at.y + 0.12, fromZ: at.z };
   s.kind = null;
   s.emptyUntil = time + INGREDIENTS.refillS;
   run.events.tossed = true;
   return true;
}

/** Resolve a landing: advance the earliest eligible order needing the kind, else burp. */
function land(run: RunState): void {
   const flight = run.flight;
   if (!flight) return;
   run.flight = null;
   const time = run.time;
   let target: Order | null = null;
   for (const w of run.windows) {
      const o = w.order;
      if (!o || o.phase !== "ordering" || o.kinds[o.progress] !== flight.kind) continue;
      if (flight.launchAt < o.appearedAt - 1e-9) continue; // launched before it appeared: never counts
      if (!target || o.appearedAt < target.appearedAt || (o.appearedAt === target.appearedAt && o.id < target.id)) target = o;
   }
   if (target) {
      target.progress += 1;
      run.events.advanced = true;
      run.events.landed = "right";
      if (target.progress >= target.kinds.length) {
         const { base, tip, points } = orderPoints(target.kinds.length, target.patience);
         target.phase = "served";
         target.phaseAt = time;
         run.windows[target.window].arriveAt = time + ORDERS.eatS + ORDERS.walkInS;
         run.completions += 1;
         run.events.completed = { window: target.window, type: target.type, len: target.kinds.length, base, tip, points };
      }
      return;
   }
   // the burp: the tosses lock and the earliest-arrived ordering order restarts at a -3 patience
   run.burpUntil = time + TOSS.burpLockS;
   run.events.landed = "wrong";
   run.events.burped = true;
   const victim = earliestOrdering(run);
   if (victim) {
      victim.progress = 0;
      victim.patience = Math.max(0, victim.patience - PATIENCE.penalty);
   }
}

/**
 * One play step. `time` is the run's play time (s) after this step. Allocates nothing; the step's
 * events are in run.events. Fixed order (deterministic whatever the frame rate): inputs, spawns,
 * drift, refills, the landing, the patience drain, the phase changes.
 */
export function stepRun(run: RunState, input: StepInput, dt: number, time: number): void {
   const ev = run.events;
   ev.rotated = 0;
   ev.tapRotated = false;
   ev.drifted = false;
   ev.tossed = false;
   ev.tossBlocked = false;
   ev.wobble = false;
   ev.advanced = false;
   ev.landed = null;
   ev.completed = null;
   ev.burped = false;
   ev.appeared = 0;
   ev.angryLeft = 0;
   ev.serveDone = 0;
   run.time = time;
   if (!(dt > 0)) return;

   // inputs
   if (input.rotate !== 0) {
      run.rotation = normalize(run.rotation + input.rotate);
      ev.rotated = input.rotate;
   }
   if (input.tossCentre) launch(run, centreSlot(run.rotation));
   if (input.tapSlot !== null) {
      const slot = input.tapSlot;
      if (run.slots[slot].kind === null) {
         ev.wobble = true; // an empty slot only wobbles
      } else if (isFront(slot, run.rotation)) {
         launch(run, slot);
      } else {
         // rotate the tapped ingredient to the front centre, the short way round
         const delta = normalize(WHEEL.front - ringPos(slot, run.rotation));
         const turn = delta > WHEEL.slots / 2 ? delta - WHEEL.slots : delta;
         run.rotation = normalize(run.rotation + turn);
         ev.rotated = turn;
         ev.tapRotated = true;
      }
   }

   // spawns: the order appears when the walk-in ends
   for (let w = 0; w < 2; w++) {
      const win = run.windows[w];
      if (!win.order && time >= win.arriveAt - 1e-9) spawnOrder(run, w as 0 | 1, win.arriveAt);
   }

   // the drift: one slot each DRIFT.everyS from DRIFT.fromS, the direction seeded
   while (time >= run.driftNextAt - 1e-9) {
      const dir = rngNext(run.rng) < 0.5 ? 1 : -1;
      run.rotation = normalize(run.rotation + dir);
      run.driftNextAt += DRIFT.everyS;
      ev.rotated = dir;
      ev.drifted = true;
   }

   // refills
   for (const s of run.slots) if (s.kind === null && time >= s.emptyUntil - 1e-9) s.kind = pickRefillKind(run);

   // the landing
   if (run.flight && time >= run.flight.landAt - 1e-9) land(run);

   // patience: drains after the grace, during flights too; a penalty can cut into the grace
   for (const w of run.windows) {
      const o = w.order;
      if (!o || o.phase !== "ordering") continue;
      if (o.patience > 0 && time > o.appearedAt + ORDERS.graceS) {
         o.patience = Math.max(0, o.patience - PATIENCE.drains[o.type] * dt);
      }
      if (o.patience <= 0 && o.phase === "ordering") {
         o.phase = "angry";
         o.phaseAt = time;
         w.arriveAt = time + PATIENCE.angryLeaveS + ORDERS.walkInS;
      }
   }

   // the served monster walks off; the angry one storms off (Scene drops the life)
   for (let w = 0; w < 2; w++) {
      const win = run.windows[w];
      const o = win.order;
      if (!o) continue;
      if (o.phase === "served" && time >= o.phaseAt + ORDERS.eatS - 1e-9) {
         win.order = null;
         ev.serveDone |= 1 << w;
      } else if (o.phase === "angry" && time >= o.phaseAt + PATIENCE.angryLeaveS - 1e-9) {
         win.order = null;
         ev.angryLeft |= 1 << w;
      }
   }
}

// ---------- the scoring-limit proof helpers (constants only: no gameplay) ----------

/**
 * The fastest legal serve cycle (s): the walk-in, then the quickest possible cook (every toss in
 * flight exactly TOSS.flightS, one in flight at a time), then the eating. A completion cannot come
 * sooner after the previous one in the same window, whatever the play.
 */
export const SERVE_CYCLE_MIN_S = ORDERS.walkInS + 3 * TOSS.flightS + ORDERS.eatS;

/** The most one completion can ever pay (a 5-item order with a full patience bar). */
export const MAX_PAY = Math.round(100 * SCORING.FACTOR[5]) + SCORING.perPatience * PATIENCE.max;

/** The most the earliest order can pay by its arrival time t: 150 below 25 s, 190 at 25-50, 240 from 50. */
export function maxPayAt(t: number): number {
   return Math.round(100 * SCORING.FACTOR[ORDERS.lenAt(t) as 3 | 4 | 5]) + SCORING.perPatience * PATIENCE.max;
}

// ---------- the server limits ----------

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, monsterKitchenMeta.scoring);
}

/** Safety net only: the README proof shows real runs never reach it; rules.test.ts keeps it a no-op. */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, monsterKitchenMeta.scoring);
}
