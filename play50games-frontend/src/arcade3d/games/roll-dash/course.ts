// Roll Dash's streets: pure data (no three.js, React or DOM). Each level is a 3-lane street, rolled
// along -z; everything on it is placed by its distance d (m) from the start. Levels 1-4 are fixed
// layouts (level 1 hand-written, 2-4 from a seeded generator, the same every run); level 5's feather-
// locks come from the Echo Storm Hawk at run time (rules.ts).
//
// Items:
// - crate: a low crate stack in one lane (jump it, or change lane);
// - sign: a hanging street sign over one lane (tuck under it, or change lane);
// - cart: a grey ore cart rolling across the lanes (level 3);
// - lock: a Prism Lock in one lane (dodge it, or open it for its orbs) or across all three (a full lock:
//   you must answer it). Each lock has a hero colour and glyph; only that hero's power opens it.
import { createRng } from "@/arcade3d/core/math";
import type { LevelId } from "../../types";
import { LEVELS, type DashLevel } from "./levels";
import { heroById, type HeroId } from "./heroes";

export const LANES = 3;
export const LANE_W = 2.2;
/** the lane's centre x */
export const laneX = (lane: number): number => (lane - 1) * LANE_W;

/** how far along the street the obstacles keep clear of the start and the gate (m) */
export const START_CLEAR = 45;
export const END_CLEAR = 35;

export type ItemKind = "crate" | "sign" | "cart" | "lock";

export interface Item {
   id: number;
   kind: ItemKind;
   /** distance from the start (m) of its near face */
   d: number;
   /** its depth along the street (m) */
   depth: number;
   /** the lane (a full lock: -1) */
   lane: number;
   /** a lock's hero colour */
   colour: HeroId | "";
   /** level 3: a shadow roller repaints the lock to this colour 1 s before you reach it ("" = never) */
   repaint: HeroId | "";
   /** a cart: it rolls across the lanes, its lane centre x(t) = amp sin(w t + phase) */
   cart: { amp: number; w: number; phase: number } | null;
}

export interface Orb {
   d: number;
   lane: number;
   /** height of its centre over the street */
   y: number;
}

export interface Zone {
   from: number;
   to: number;
}

export interface Course {
   level: LevelId;
   cfg: DashLevel;
   length: number;
   items: Item[];
   orbs: Orb[];
   /** level 4: street lamps (distances): a lock shows its colour within LAMP_LIGHT of one */
   lamps: number[];
   /** level 4: Prism Lock zones: no tagging inside */
   noTag: Zone[];
}

export const LAMP_LIGHT = 9;

interface Draft {
   items: Item[];
   orbs: Orb[];
}

function add(d: Draft, kind: ItemKind, dist: number, lane: number, colour: HeroId | "" = "", extra: Partial<Item> = {}): Item {
   const depth = kind === "lock" ? (colour === "nami" ? 0.6 : 1.0) : kind === "sign" ? 0.5 : kind === "cart" ? 1.9 : 1.0;
   const it: Item = { id: d.items.length, kind, d: dist, depth, lane, colour, repaint: "", cart: null, ...extra };
   d.items.push(it);
   return it;
}

/** A line of n orbs in a lane, every 2.5 m from `from`. */
function line(d: Draft, from: number, lane: number, n: number, y = 0.8): void {
   for (let k = 0; k < n; k++) d.orbs.push({ d: from + k * 2.5, lane, y });
}

/** The lock reward: a line of orbs right behind a single lock (Nyla's high over her barrier). */
function reward(d: Draft, it: Item): void {
   line(d, it.d + it.depth + 1.5, it.lane, 4, it.colour === "nami" ? 2.4 : 0.8);
}

// ---------- level 1: Gate Street (three beats) ----------

function level1(cfg: DashLevel): Draft {
   const d: Draft = { items: [], orbs: [] };
   const v = cfg.speed;
   let at = START_CLEAR + 20;
   // beat 1: red barricades in one lane (dodge, or tag Riko and break one)
   line(d, START_CLEAR, 1, 6);
   for (const lane of [1, 0, 2]) {
      reward(d, add(d, "lock", at, lane, "riko"));
      add(d, "crate", at + v * 2.2, (lane + 1) % 3);
      at += v * 4.2;
   }
   line(d, at - 20, 1, 5);
   // beat 2: blue barriers: tag Nyla and hop one
   for (const lane of [1, 2, 0]) {
      reward(d, add(d, "lock", at, lane, "nami"));
      add(d, "sign", at + v * 2.2, (lane + 2) % 3);
      at += v * 4.2;
   }
   // beat 3: a full lock pair, red then blue 1.5 s apart
   for (let k = 0; k < 3; k++) {
      add(d, "lock", at, -1, "riko");
      add(d, "lock", at + v * 1.5, -1, "nami");
      line(d, at + v * 1.5 + 4, k % 3, 4);
      at += v * 5.5;
   }
   return d;
}

// ---------- levels 2-4: segments from the seeded generator ----------

function generate(cfg: DashLevel): Draft {
   const d: Draft = { items: [], orbs: [] };
   const rng = createRng(1000 + cfg.id * 77);
   const v = cfg.speed;
   const len = cfg.length;
   const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
   // a colour is not asked again until its power has recharged on an active hero (its cooldown + 0.6 s)
   const used: Partial<Record<HeroId, number>> = {};
   const usable = (at: number, c: HeroId): boolean => at - (used[c] ?? -1e9) > v * (heroById(c).cooldownMs / 1000 + 0.6);
   const fresh = (at: number, but: HeroId | "" = ""): HeroId => {
      const ok = cfg.locks.filter((c) => c !== but && usable(at, c));
      const c = pick(ok.length > 0 ? ok : cfg.locks.filter((x) => x === "nami" || x !== but));
      used[c] = at;
      return c;
   };

   const span = (len - START_CLEAR - END_CLEAR) / cfg.segments;
   const beatGap = v * 2.3;
   line(d, START_CLEAR - 25, 1, 8);
   for (let s = 0; s < cfg.segments; s++) {
      const s0 = START_CLEAR + s * span;
      // the last ~2 s of a segment is a safe recovery pocket with an orb line
      const pocket = v * 2;
      let at = s0 + 6;
      let beat = 0;
      while (at < s0 + span - pocket) {
         const roll = rng();
         const free = Math.floor(rng() * 3);
         if (roll < 0.34) {
            // a single lock (one lane) next to a plain obstacle in another lane
            const lock = add(d, "lock", at, free, fresh(at));
            if (cfg.repaints && rng() < 0.4) {
               const to = cfg.locks.filter((c) => c !== lock.colour && usable(at, c));
               if (to.length > 0) {
                  const c = pick(to);
                  used[c] = at;
                  lock.repaint = c;
               }
            }
            reward(d, lock);
            add(d, rng() < 0.5 ? "crate" : "sign", at, (free + 1 + Math.floor(rng() * 2)) % 3);
         } else if (roll < 0.58) {
            // a full lock
            const lock = add(d, "lock", at, -1, fresh(at));
            if (cfg.repaints && rng() < 0.35) {
               const to = cfg.locks.filter((c) => c !== lock.colour && usable(at, c));
               if (to.length > 0) {
                  const c = pick(to);
                  used[c] = at;
                  lock.repaint = c;
               }
            }
            line(d, at + 4, free, 4);
         } else if (roll < 0.74 && cfg.doubles && usable(at, "vexa") && usable(at, "riko")) {
            // a double lock: a ghost wall and a barricade 6 m behind it, across all lanes (tag Vexa, phase, tag Riko)
            add(d, "lock", at, -1, "vexa");
            add(d, "lock", at + 6, -1, "riko");
            used.vexa = at;
            used.riko = at;
            line(d, at + 10, free, 4);
            at += 6;
         } else if (roll < 0.86 && cfg.repaints) {
            // an ore cart rolling across the lanes, with a crate wall leaving one lane
            add(d, "cart", at, 1, "", { cart: { amp: LANE_W, w: 1.3 + rng(), phase: rng() * 6.28 } });
            line(d, at + 6, free, 4);
         } else {
            // plain obstacles: two lanes blocked (a crate and a sign), one free with orbs
            const a = (free + 1) % 3;
            const b = (free + 2) % 3;
            add(d, "crate", at, a);
            add(d, "sign", at + (rng() < 0.5 ? 0 : 3), b);
            line(d, at - 2, free, 3);
         }
         beat += 1;
         at += beatGap + rng() * v * 0.8;
      }
      line(d, s0 + span - pocket + 2, Math.floor(rng() * 3), 5);
   }
   return d;
}

/** Level 5's bridge: no fixed obstacles (the Hawk drops them), orb lines every 30 m in turning lanes. */
function bridge(): Draft {
   const d: Draft = { items: [], orbs: [] };
   for (let k = 0; k < 40; k++) line(d, 30 + k * 30, k % 3, 3);
   return d;
}

function build(level: LevelId): Course {
   const cfg = LEVELS[level];
   const draft = level === 1 ? level1(cfg) : level === 5 ? bridge() : generate(cfg);
   draft.items.sort((a, b) => a.d - b.d);
   draft.items.forEach((it, i) => (it.id = i));
   draft.orbs.sort((a, b) => a.d - b.d);
   const lamps: number[] = [];
   const noTag: Zone[] = [];
   if (cfg.night) {
      for (let x = 20; x < cfg.length; x += 26) lamps.push(x);
      // Prism Lock zones: the 2 s before some full locks have no tagging (be the right hero BEFORE you
      // enter). Never over a double lock (it needs a tag between its two walls) or another lock.
      const locks = draft.items.filter((it) => it.kind === "lock");
      locks.forEach((it, k) => {
         if (it.lane >= 0 || k % 3 !== 0) return;
         const from = it.d - cfg.speed * 2.2;
         const clash = locks.some((o) => o !== it && o.d >= from - 2 && o.d <= it.d + 15);
         if (!clash) noTag.push({ from, to: it.d + it.depth });
      });
   }
   return { level, cfg, length: cfg.length, items: draft.items, orbs: draft.orbs.filter((o) => cfg.boss || o.d < cfg.length - 10), lamps, noTag };
}

const CACHE = new Map<LevelId, Course>();

/** The level's street (built once; treat it as read-only). */
export function courseFor(level: LevelId): Course {
   let c = CACHE.get(level);
   if (!c) {
      c = build(level);
      CACHE.set(level, c);
   }
   return c;
}

/** A cart's lane-centre x at play time ms. */
export function cartX(it: Item, ms: number): number {
   const c = it.cart;
   if (!c) return laneX(it.lane);
   return c.amp * Math.sin(c.w * (ms / 1000) + c.phase);
}

/** Is a lock's colour readable at distance d (level 4: only in a lamp's light)? */
export function lit(c: Course, d: number): boolean {
   if (!c.cfg.night) return true;
   for (const x of c.lamps) if (Math.abs(x - d) <= LAMP_LIGHT) return true;
   return false;
}
