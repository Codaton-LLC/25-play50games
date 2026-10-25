import { createRng } from "@/arcade3d/core/math";
import { judgeTiming } from "@/arcade3d/core/hud/timingMath";
import type { PizzaLevel } from "./levels";
export const TOPPINGS = ["pepperoni", "mushroom", "olive", "tomato", "onion"] as const;
export type Ingredient = "sauce" | "cheese" | typeof TOPPINGS[number];
export interface Ticket { id: number; ingredients: Ingredient[]; openedAt: number | null; state: "waiting" | "open" | "served" | "expired" }
export interface Pizza { ticket: number; added: number; perfect: boolean; boxed: boolean }
export interface Oven { pizza: Pizza; startedAt: number }
export interface Station { id: string; x: number; z: number; label: string }
export interface Run {
   level: PizzaLevel; tickets: Ticket[]; ovens: (Oven | null)[]; prep: Pizza | null; carried: Pizza | null;
   player: { x: number; y: number; z: number }; time: number; score: number; served: number; expired: number;
   stunUntil: number; nextUse: number; reachUntil: number; end: "win" | "lose" | "timeup" | null; message: string;
}
const layouts = new WeakMap<PizzaLevel, Station[]>();
export function stations(l: PizzaLevel): Station[] {
   const cached = layouts.get(l);
   if (cached) return cached;
   const ids = ["dough", "sauce", "cheese", ...TOPPINGS.slice(0, l.toppingTypes), ...Array.from({ length: l.ovens }, (_, i) => `oven${i}`), ...(l.boxStep ? ["box"] : []), "serve"];
   const result = ids.map((id, i) => ({ id, x: (i - (ids.length - 1) / 2) * 1.6, z: -1.6, label: id.startsWith("oven") ? `Oven ${Number(id.slice(4)) + 1}` : id }));
   layouts.set(l, result);
   return result;
}
export function createRun(seed: number, level: PizzaLevel): Run {
   const rng = createRng(seed);
   const tickets: Ticket[] = Array.from({ length: level.orders }, (_, id) => {
      const pool = [...TOPPINGS.slice(0, level.toppingTypes)];
      const count = pool.length ? Math.floor(rng() * (level.maxToppings + 1)) : 0;
      const ingredients: Ingredient[] = ["sauce", "cheese"];
      for (let i = 0; i < count; i++) ingredients.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      return { id, ingredients, openedAt: id < level.parallel ? 0 : null, state: id < level.parallel ? "open" : "waiting" };
   });
   return { level, tickets, ovens: Array(level.ovens).fill(null), prep: null, carried: null, player: { x: stations(level)[0].x, y: 0, z: 0.2 }, time: 0, score: 0, served: 0, expired: 0, stunUntil: 0, nextUse: 0, reachUntil: 0, end: null, message: "Start at dough" };
}
export function bakeZones(l: PizzaLevel) { return [{ start: l.bakeS / (l.bakeS + l.goldenS), end: 1 }]; }
export function bakeGrade(age: number, l: PizzaLevel): "raw" | "perfect" | "good" | "burnt" {
   if (age + 1e-9 < l.bakeS) return "raw";
   if (age + 1e-9 >= l.bakeS + l.goldenS) return "burnt";
   const grade = judgeTiming(Math.max(l.bakeS, age) / (l.bakeS + l.goldenS), bakeZones(l), 0);
   return grade === "miss" ? "raw" : age + 1e-9 < l.bakeS + 1.5 ? "perfect" : "good";
}
function refresh(r: Run) {
   const quota = r.level.orders - (r.level.patienceS ? 1 : 0);
   if (r.level.orders - r.expired < quota) { r.end = "lose"; return; }
   if (r.tickets.every(t => t.state === "served" || t.state === "expired")) {
      r.end = "win";
      r.score += 4 * Math.floor(Math.max(0, r.level.durationMs / 1000 - r.time));
      return;
   }
   let n = r.tickets.filter(t => t.state === "open").length;
   for (const t of r.tickets) if (t.state === "waiting" && n < r.level.parallel) { t.state = "open"; t.openedAt = r.time; n++; }
}
export function nearestStation(r: Run): Station | undefined {
   return stations(r.level).find(s => Math.hypot(s.x - r.player.x, s.z - r.player.z) <= 1.2);
}
export function useStation(r: Run, id: string): void {
   if (r.end || r.time < r.stunUntil || r.time < r.nextUse) return;
   const s = nearestStation(r);
   if (!s || s.id !== id) return;
   r.nextUse = r.time + 0.22;
   r.reachUntil = r.time + 0.28;
   if (id === "dough" && !r.prep && !r.carried) {
      const occupied = new Set([r.carried, ...r.ovens.map(o => o?.pizza)].filter(Boolean).map(p => p!.ticket));
      const t = r.tickets.find(t => t.state === "open" && !occupied.has(t.id));
      if (t) { r.prep = { ticket: t.id, added: 0, perfect: false, boxed: false }; r.message = "Add sauce"; }
   } else if (["sauce", "cheese", ...TOPPINGS].includes(id) && r.prep) {
      const t = r.tickets[r.prep.ticket];
      if (t.ingredients[r.prep.added] !== id) { r.prep = null; r.stunUntil = r.time + 0.5; r.message = "Wrong ingredient — start again"; }
      else { r.prep.added++; r.message = t.ingredients[r.prep.added] ? `Add ${t.ingredients[r.prep.added]}` : "Ready for the oven"; }
   } else if (id.startsWith("oven")) {
      const i = Number(id.slice(4));
      const oven = r.ovens[i];
      if (oven && !r.carried) {
         const grade = bakeGrade(r.time - oven.startedAt, r.level);
         if (grade === "raw") { r.message = "Still baking"; return; }
         r.ovens[i] = null;
         if (grade === "burnt") r.message = "Burnt — start again";
         else { r.carried = oven.pizza; r.carried.perfect = grade === "perfect"; r.message = grade === "perfect" ? "Perfect bake!" : "Golden bake"; }
      } else if (!oven && r.prep && r.prep.added === r.tickets[r.prep.ticket].ingredients.length) {
         r.ovens[i] = { pizza: r.prep, startedAt: r.time }; r.prep = null; r.message = "Watch the oven ring";
      }
   } else if (id === "box" && r.carried) { r.carried.boxed = true; r.message = "Boxed — serve at hatch"; }
   else if (id === "serve" && r.carried) {
      const t = r.tickets[r.carried.ticket];
      if (r.level.boxStep && !r.carried.boxed) { r.message = "Box it first"; return; }
      if (t.state === "open") {
         const fresh = !r.level.patienceS || r.time - t.openedAt! < r.level.patienceS / 2;
         r.score += 150 + (r.carried.perfect ? 50 : 0) + (fresh ? 30 : 0);
         t.state = "served"; r.served++; r.message = "Order served!";
      }
      r.carried = null; refresh(r);
   }
}
export function step(r: Run, dt: number, x: number, z: number, action: boolean): void {
   if (r.end || !Number.isFinite(dt) || dt <= 0) return;
   dt = Math.min(dt, 0.05, r.level.durationMs / 1000 - r.time);
   r.time += dt;
   for (const t of r.tickets) if (t.state === "open" && r.level.patienceS && r.time - t.openedAt! >= r.level.patienceS) {
      t.state = "expired"; r.expired++;
      if (r.prep?.ticket === t.id) r.prep = null;
      if (r.carried?.ticket === t.id) r.carried = null;
      r.ovens = r.ovens.map(o => o?.pizza.ticket === t.id ? null : o);
      r.message = "Ticket expired";
   }
   refresh(r);
   if (r.end) return;
   if (r.time >= r.level.durationMs / 1000) { r.end = "timeup"; return; }
   if (r.time >= r.stunUntil) {
      const length = Math.max(1, Math.hypot(x, z));
      const half = stations(r.level).length * 0.8 + 0.4;
      r.player.x = Math.max(-half + 0.36, Math.min(half - 0.36, r.player.x + x / length * 4.2 * dt));
      r.player.z = Math.max(-0.64, Math.min(3.64, r.player.z + z / length * 4.2 * dt));
      if (action) { const s = nearestStation(r); if (s) useStation(r, s.id); }
   }
}
