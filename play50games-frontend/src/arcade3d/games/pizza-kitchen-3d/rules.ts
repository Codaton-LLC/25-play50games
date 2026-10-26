// Pizza Kitchen 3D rules (docs/menu1-new/specs-41-50.md §45). Pure and deterministic with a seed:
// no React, no three.js. The Scene calls createRun once per run and frame() from one useRunFrame.
import { judgeTiming } from "@/arcade3d/core/hud/timingMath";
import { createRng } from "@/arcade3d/core/math";
import type { ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import type { StoreApi } from "zustand/vanilla";
import type { PizzaLevel } from "./levels";

export const TOPPINGS = ["pepperoni", "mushroom", "olive", "tomato", "onion"] as const;
export type Topping = (typeof TOPPINGS)[number];
export type Ingredient = "sauce" | "cheese" | Topping;

export const TUNING = {
   radius: 0.36,
   speed: 4.2,
   accel: 22,
   brake: 28,
   /** a Use reaches a station within this distance of its front spot */
   reach: 1.2,
   /** between two Uses (both devices) */
   useCooldown: 0.22,
   /** the reach pose after a Use (visual) */
   reachShow: 0.28,
   wrongStun: 0.5,
   /** a take-out within this many seconds of the golden window's start is a perfect bake */
   perfectS: 1.5,
   spacing: 1.6,
   counterZ: -1.6,
   /** the walkable floor in front of the counter */
   minZ: -0.64,
   /** the working strip in front of the counter (2 m deep): the camera frames it, no empty floor */
   maxZ: 1.4,
   served: 150,
   perfect: 50,
   fresh: 30,
   winPerSecond: 4,
   resultDelayMs: 900,
} as const;

export interface Ticket {
   id: number;
   ingredients: Ingredient[];
   openedAt: number;
   state: "waiting" | "open" | "served" | "expired";
}
export interface Pizza {
   ticket: number;
   added: number;
   perfect: boolean;
   boxed: boolean;
}
export interface Oven {
   pizza: Pizza;
   startedAt: number;
}
export interface Station {
   id: string;
   x: number;
   z: number;
   label: string;
}
export type KitchenEvent = "serve" | "spoil" | "burnt" | "expire" | "ovenIn" | "takeOut" | "add" | "dough" | "box";

export interface Run {
   level: PizzaLevel;
   stations: Station[];
   tickets: Ticket[];
   ovens: (Oven | null)[];
   prep: Pizza | null;
   carried: Pizza | null;
   player: { x: number; y: number; z: number; vx: number; vz: number };
   time: number;
   score: number;
   /** points of the last serve (floating score) */
   lastPoints: number;
   served: number;
   expired: number;
   stunUntil: number;
   nextUse: number;
   reachUntil: number;
   end: "win" | "lose" | "timeup" | null;
   message: string;
   /** this frame's events, cleared in place */
   events: KitchenEvent[];
   /** what the store last got (-1 = never) */
   synced: { score: number; served: number };
}

const layouts = new WeakMap<PizzaLevel, Station[]>();

/** The counter line along the back: dough, sauce, cheese, the toppings in play, the ovens, the box (L5), the hatch. */
export function stations(l: PizzaLevel): Station[] {
   const cached = layouts.get(l);
   if (cached) return cached;
   const ids = ["dough", "sauce", "cheese", ...TOPPINGS.slice(0, l.toppingTypes), ...Array.from({ length: l.ovens }, (_, i) => `oven${i}`), ...(l.boxStep ? ["box"] : []), "serve"];
   const result = ids.map((id, i) => ({
      id,
      x: (i - (ids.length - 1) / 2) * TUNING.spacing,
      z: TUNING.counterZ,
      label: id.startsWith("oven") ? `Oven ${Number(id.slice(4)) + 1}` : id === "serve" ? "Hatch" : id[0].toUpperCase() + id.slice(1),
   }));
   layouts.set(l, result);
   return result;
}

/** Half width of the walkable floor. */
export const kitchenHalf = (l: PizzaLevel) => stations(l).length * (TUNING.spacing / 2) + 0.4;

export function createRun(seed: number, level: PizzaLevel): Run {
   const rng = createRng(seed);
   const tickets: Ticket[] = Array.from({ length: level.orders }, (_, id) => {
      const pool: Topping[] = [...TOPPINGS.slice(0, level.toppingTypes)];
      const count = pool.length ? Math.floor(rng() * (level.maxToppings + 1)) : 0;
      const ingredients: Ingredient[] = ["sauce", "cheese"];
      for (let i = 0; i < count; i++) ingredients.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      const open = id < level.parallel;
      return { id, ingredients, openedAt: 0, state: open ? "open" : "waiting" };
   });
   const list = stations(level);
   return {
      level,
      stations: list,
      tickets,
      ovens: Array.from({ length: level.ovens }, () => null),
      prep: null,
      carried: null,
      player: { x: list[0].x, y: 0, z: 0.2, vx: 0, vz: 0 },
      time: 0,
      score: 0,
      lastPoints: 0,
      served: 0,
      expired: 0,
      stunUntil: 0,
      nextUse: 0,
      reachUntil: 0,
      end: null,
      message: "Use the dough",
      events: [],
      synced: { score: -1, served: -1 },
   };
}

export function bakeZones(l: PizzaLevel) {
   return [{ start: l.bakeS / (l.bakeS + l.goldenS), end: 1 }];
}

export function bakeGrade(age: number, l: PizzaLevel): "raw" | "perfect" | "good" | "burnt" {
   if (age + 1e-9 < l.bakeS) return "raw";
   if (age + 1e-9 >= l.bakeS + l.goldenS) return "burnt";
   const grade = judgeTiming(Math.max(l.bakeS, age) / (l.bakeS + l.goldenS), bakeZones(l), 0);
   return grade === "miss" ? "raw" : age + 1e-9 < l.bakeS + TUNING.perfectS ? "perfect" : "good";
}

const isOpenOrWaiting = (t: Ticket) => t.state === "open" || t.state === "waiting";

/** Win / lose checks, then open waiting tickets up to `parallel`. */
function refresh(r: Run): void {
   // L4-L5: one expired ticket is allowed (quota = orders - 1); a second cannot meet the quota any more
   if (r.level.patienceS > 0 && r.expired >= 2) {
      r.end = "lose";
      return;
   }
   let left = 0;
   let open = 0;
   for (const t of r.tickets) {
      if (isOpenOrWaiting(t)) left++;
      if (t.state === "open") open++;
   }
   if (left === 0) {
      r.end = "win";
      r.score += TUNING.winPerSecond * Math.floor(Math.max(0, r.level.durationMs / 1000 - r.time));
      return;
   }
   for (const t of r.tickets) {
      if (open >= r.level.parallel) break;
      if (t.state !== "waiting") continue;
      t.state = "open";
      t.openedAt = r.time;
      open++;
   }
}

/** The station whose front spot is nearest, if within reach. */
export function nearestStation(r: Run): Station | undefined {
   let best: Station | undefined;
   let bestD: number = TUNING.reach;
   for (const s of r.stations) {
      const d = Math.hypot(s.x - r.player.x, s.z - r.player.z);
      if (d <= bestD) {
         bestD = d;
         best = s;
      }
   }
   return best;
}

function ticketBusy(r: Run, id: number): boolean {
   if (r.carried?.ticket === id || r.prep?.ticket === id) return true;
   for (const o of r.ovens) if (o?.pizza.ticket === id) return true;
   return false;
}

/** One Use at station `id` (the nearest one; anything else is ignored). */
export function applyStation(r: Run, id: string): void {
   if (r.end || r.time < r.stunUntil || r.time < r.nextUse) return;
   const s = nearestStation(r);
   if (!s || s.id !== id) return;
   r.nextUse = r.time + TUNING.useCooldown;
   r.reachUntil = r.time + TUNING.reachShow;
   if (id === "dough") {
      if (r.prep || r.carried) return;
      const t = r.tickets.find((x) => x.state === "open" && !ticketBusy(r, x.id));
      if (!t) return;
      r.prep = { ticket: t.id, added: 0, perfect: false, boxed: false };
      r.message = "Add sauce";
      r.events.push("dough");
   } else if (id === "sauce" || id === "cheese" || (TOPPINGS as readonly string[]).includes(id)) {
      if (!r.prep) return;
      const t = r.tickets[r.prep.ticket];
      if (t.ingredients[r.prep.added] !== id) {
         r.prep = null;
         r.stunUntil = r.time + TUNING.wrongStun;
         r.message = "Wrong ingredient: start again";
         r.events.push("spoil");
         return;
      }
      r.prep.added++;
      r.message = t.ingredients[r.prep.added] ? `Add ${t.ingredients[r.prep.added]}` : "Ready for the oven";
      r.events.push("add");
   } else if (id.startsWith("oven")) {
      const i = Number(id.slice(4));
      const oven = r.ovens[i];
      if (oven && !r.carried) {
         const grade = bakeGrade(r.time - oven.startedAt, r.level);
         if (grade === "raw") {
            r.message = "Still baking";
            return;
         }
         r.ovens[i] = null;
         if (grade === "burnt") {
            r.message = "Burnt: start again";
            r.events.push("burnt");
         } else {
            r.carried = oven.pizza;
            r.carried.perfect = grade === "perfect";
            r.message = grade === "perfect" ? "Perfect bake!" : "Golden bake";
            r.events.push("takeOut");
         }
      } else if (!oven && r.prep && r.prep.added === r.tickets[r.prep.ticket].ingredients.length) {
         r.ovens[i] = { pizza: r.prep, startedAt: r.time };
         r.prep = null;
         r.message = "Watch the oven ring";
         r.events.push("ovenIn");
      }
   } else if (id === "box") {
      if (!r.carried || r.carried.boxed) return;
      r.carried.boxed = true;
      r.message = "Boxed: to the hatch";
      r.events.push("box");
   } else if (id === "serve" && r.carried) {
      if (r.level.boxStep && !r.carried.boxed) {
         r.message = "Box it first";
         return;
      }
      const t = r.tickets[r.carried.ticket];
      if (t.state === "open") {
         const fresh = !r.level.patienceS || r.time - t.openedAt < r.level.patienceS / 2;
         const pts = TUNING.served + (r.carried.perfect ? TUNING.perfect : 0) + (fresh ? TUNING.fresh : 0);
         r.score += pts;
         r.lastPoints = pts;
         t.state = "served";
         r.served++;
         r.message = "Order served!";
         r.events.push("serve");
      }
      r.carried = null;
      refresh(r);
   }
}

/**
 * One frame of play: (x, z) is the world move direction (inputToWorld), `use` the one-frame Use press
 * (actionPressed: E / Enter / touch Use). Mutates `r`; no allocation.
 */
export function step(r: Run, dt: number, x: number, z: number, use: boolean): void {
   if (r.end || !Number.isFinite(dt) || dt <= 0) return;
   r.events.length = 0;
   dt = Math.min(dt, 0.05, r.level.durationMs / 1000 - r.time);
   r.time += dt;
   if (r.level.patienceS > 0) {
      for (const t of r.tickets) {
         if (t.state !== "open" || r.time - t.openedAt < r.level.patienceS) continue;
         t.state = "expired";
         r.expired++;
         if (r.prep?.ticket === t.id) r.prep = null;
         if (r.carried?.ticket === t.id) r.carried = null;
         for (let i = 0; i < r.ovens.length; i++) if (r.ovens[i]?.pizza.ticket === t.id) r.ovens[i] = null;
         r.message = "Ticket expired";
         r.events.push("expire");
      }
   }
   refresh(r);
   if (r.end) return;
   if (r.time >= r.level.durationMs / 1000 - 1e-9) {
      r.end = "timeup";
      return;
   }
   const p = r.player;
   const stunned = r.time < r.stunUntil;
   // on-foot mover (robot-collector): accelerate toward the stick, brake harder when letting go or reversing
   const len = Math.hypot(x, z);
   const k = stunned || len < 0.05 ? 0 : Math.min(1, len) / len;
   const tx = x * k * TUNING.speed;
   const tz = z * k * TUNING.speed;
   const rate = k === 0 || tx * p.vx + tz * p.vz < 0 ? TUNING.brake : TUNING.accel;
   let dvx = tx - p.vx;
   let dvz = tz - p.vz;
   const dv = Math.hypot(dvx, dvz);
   if (dv > rate * dt) {
      dvx *= (rate * dt) / dv;
      dvz *= (rate * dt) / dv;
   }
   p.vx += dvx;
   p.vz += dvz;
   const half = kitchenHalf(r.level) - TUNING.radius;
   p.x += p.vx * dt;
   p.z += p.vz * dt;
   if (p.x < -half || p.x > half) {
      p.x = Math.max(-half, Math.min(half, p.x));
      p.vx = 0;
   }
   if (p.z < TUNING.minZ || p.z > TUNING.maxZ) {
      p.z = Math.max(TUNING.minZ, Math.min(TUNING.maxZ, p.z));
      p.vz = 0;
   }
   if (use && !stunned) {
      const s = nearestStation(r);
      if (s) applyStation(r, s.id);
   }
}

/** step() plus the store: the score and Served chip on change, end() when the run ends. Shared by the Scene and the bots. */
export function frame(r: Run, dt: number, x: number, z: number, use: boolean, store?: StoreApi<ArcadeStore>): void {
   step(r, dt, x, z, use);
   if (!store) return;
   const s = store.getState();
   if (r.synced.score !== r.score) s.setScore((r.synced.score = r.score));
   if (r.synced.served !== r.served) s.setStat("served", (r.synced.served = r.served));
   if (r.end) s.end(r.end);
}

// ---------- server limits (README "Server limits and why they hold") ----------

const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

/** Bobj = 230 per ticket (150 served + 50 perfect + 30 fresh), each ticket pays once. */
export const objectiveCeiling = (l: PizzaLevel) => (TUNING.served + TUNING.perfect + TUNING.fresh) * l.orders;

/**
 * Per level: base = Bobj; the win bonus 4 * floor(D - t) is largest at the earliest win M, so
 * maxScore >= Bobj + 4 (D - M) and pps >= 4 (D - M) / M. M = 0.8 x the oracle bot's fastest win over
 * 200 seeds at 30 / 60 / 144 Hz (README), never below the hard floor ceil(orders / ovens) * bakeS.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   /** L1: Bobj 690, D 120 s, oracle 23.9 s → M 19.1 s: peak 1094 */
   1: { ...PTS, maxScore: 1130, minDurationMs: 4000, maxDurationMs: 120_000, base: 690, maxPointsPerSec: 22 },
   /** L2: Bobj 920, D 150 s, oracle 37.7 s → M 30.1 s: peak 1400 */
   2: { ...PTS, maxScore: 1440, minDurationMs: 4000, maxDurationMs: 150_000, base: 920, maxPointsPerSec: 16 },
   /** L3: Bobj 1380, D 180 s, oracle 48.1 s → M 38.5 s: peak 1946 */
   3: { ...PTS, maxScore: 2000, minDurationMs: 4000, maxDurationMs: 180_000, base: 1380, maxPointsPerSec: 15 },
   /** L4: Bobj 1840, D 180 s, oracle 65.8 s → M 52.6 s: peak 2350 */
   4: { ...PTS, maxScore: 2420, minDurationMs: 4000, maxDurationMs: 180_000, base: 1840, maxPointsPerSec: 10 },
   /** L5: Bobj 2300, D 210 s, oracle 97.6 s → M 78.1 s: peak 2828 */
   5: { ...PTS, maxScore: 2900, minDurationMs: 4000, maxDurationMs: 210_000, base: 2300, maxPointsPerSec: 7 },
};

/** M per level (s): 0.8 x the oracles' fastest win (README); the bound pps and maxScore are derived from. */
export const EARLIEST_WIN_S: Record<LevelId, number> = { 1: 19.1, 2: 30.1, 3: 38.5, 4: 52.6, 5: 78.1 };
