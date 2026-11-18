// The climb: the giant tree's platforms and vines, built from levels.ts beats (pure, three-free,
// cached per level). The route winds up round the trunk on a wide circle (radius RING m): a beat
// `gap` m further along it, so the swing planes turn gently (about 25 degrees a vine). Every vine hangs from an anchor and
// swings in the vertical plane that points at the next stop on the route (the card: vine to vine,
// branch to branch, up the tree). course.test.ts checks every layout.
import type { LevelId } from "../../types";
import { LEVELS, type VineLevel } from "./levels";

/** The route's circle round the trunk (m): wide, so a swing plane turns little from one vine to the next. */
export const RING = 16;
/** The trunk's radius (drawn; nothing on the route comes near it). */
export const TRUNK_R = 7;
/** A vine from a platform: its anchor this far over the platform's top (a jump off it reaches the vine). */
export const VINE_OVER_PAD = 4.6;
/** A platform after a vine: its top this far under the vine's anchor (a release from the swing lands on it). */
export const PAD_UNDER_VINE = 5;
/** The bot's grip (m): orbs on vines sit at the chest at the bottom of this grip. */
export const ORB_GRIP = 4.4;
/** A branch bobs this far (L2) and takes this long a cycle (ms). */
export const BOB = { amp: 0.6, periodMs: 3000 } as const;
/** Arch vines (L4) lean with the hero's weight: the anchor slides this far along the swing. */
export const TILT = 0.8;

export type PadKind = "start" | "branch" | "leaf" | "step" | "net" | "canopy" | "hollow" | "arena" | "goal";

export interface Pad {
   id: number;
   kind: PadKind;
   x: number;
   /** the walking surface's top (m) */
   y: number;
   z: number;
   r: number;
   /** bob amplitude (m), 0 = still (L2's swaying branches) */
   bob: number;
   phase: number;
   /** the route stop index, -1 off the route */
   node: number;
}

export type VineKind = "live" | "dry" | "glow" | "arch" | "boss";

export interface Vine {
   id: number;
   kind: VineKind;
   /** the anchor at rest */
   x: number;
   y: number;
   z: number;
   /** the swing plane's horizontal direction (unit) */
   dx: number;
   dz: number;
   /** the anchor rides a bobbing branch (L2) */
   bob: number;
   phase: number;
   node: number;
}

export interface Point {
   x: number;
   y: number;
   z: number;
}

export interface Orb extends Point {
   /** the vine whose swing passes it, -1 a platform's */
   vine: number;
}

export interface Snapper extends Point {
   /** its bite cycle offset (ms) */
   phase: number;
}

export interface Monkey extends Point {
   /** its throw cycle offset (ms) */
   phase: number;
}

export interface Arena {
   /** the vine the hero fights from, and the King's own vine (phase 3) */
   main: number;
   kingVine: number;
   /** the King's perch (phase 1) on the main vine's arc, and his hanging spot (phase 2) */
   perch: Point;
   hang: Point;
   /** the arena platform */
   pad: number;
}

export interface Course {
   level: LevelId;
   cfg: VineLevel;
   pads: Pad[];
   vines: Vine[];
   /** the route in order: pads and vines, as { pad } or { vine } */
   route: { pad: number; vine: number }[];
   orbs: Orb[];
   emeralds: Point[];
   snappers: Snapper[];
   monkeys: Monkey[];
   /** Vexa's trunk hollow (a pad behind the ghost-root wall) and the wall's circle */
   hollow: number;
   ghost: { x: number; z: number; r: number; y0: number; y1: number };
   /** the vine that glows at the full 6 m grip (the hidden emerald vine) */
   glow: number;
   /** Nami's high canopy pad over a platform */
   canopy: number;
   arena: Arena | null;
   /** the goal (the last platform; level 5: the arena) */
   goal: number;
   /** the top of the climb (the goal's top) */
   top: number;
}

/** The route's place `u` m along the circle round the trunk (counter-clockwise seen from above, from the front). */
export function routePoint(u: number): { x: number; z: number } {
   const a = u / RING;
   return { x: RING * Math.sin(a), z: RING * Math.cos(a) };
}

const cache = new Map<LevelId, Course>();

export function courseFor(level: LevelId): Course {
   const hit = cache.get(level);
   if (hit) return hit;
   const cfg = LEVELS[level];
   const pads: Pad[] = [];
   const vines: Vine[] = [];
   const route: { pad: number; vine: number }[] = [];
   const addPad = (kind: PadKind, x: number, y: number, z: number, r: number, node: number): Pad => {
      const p: Pad = { id: pads.length, kind, x, y, z, r, bob: 0, phase: 0, node };
      pads.push(p);
      return p;
   };
   const start = addPad("start", routePoint(0).x, 0, routePoint(0).z, 2.6, 0);
   route.push({ pad: start.id, vine: -1 });
   let u = 0;
   let padTop = 0;
   let anchor = 0;
   let lastWasVine = false;
   const nets: { under: number; at: number }[] = [];
   for (const b of cfg.beats) {
      if (b.t === "net") {
         nets.push({ under: b.under, at: route.length });
         continue;
      }
      u += b.gap;
      const p = routePoint(u);
      if (b.t === "pad") {
         const top = (lastWasVine ? anchor - PAD_UNDER_VINE : padTop) + b.rise;
         const pad = addPad(b.kind ?? "branch", p.x, top, p.z, b.r ?? 1.6, route.length);
         padTop = top;
         lastWasVine = false;
         route.push({ pad: pad.id, vine: -1 });
      } else {
         const y = (lastWasVine ? anchor : padTop + VINE_OVER_PAD) + b.rise;
         const v: Vine = { id: vines.length, kind: b.kind ?? "live", x: p.x, y, z: p.z, dx: 1, dz: 0, bob: 0, phase: 0, node: route.length };
         vines.push(v);
         anchor = y;
         lastWasVine = true;
         route.push({ pad: -1, vine: v.id });
      }
   }
   // each vine swings toward the next stop (the last one back along the route)
   const stopAt = (k: number): { x: number; z: number } => {
      const s = route[k];
      return s.pad >= 0 ? pads[s.pad] : vines[s.vine];
   };
   for (let k = 0; k < route.length; k++) {
      const s = route[k];
      if (s.vine < 0) continue;
      const v = vines[s.vine];
      const to = k + 1 < route.length ? stopAt(k + 1) : stopAt(k - 1);
      const sign = k + 1 < route.length ? 1 : -1;
      const dx = (to.x - v.x) * sign;
      const dz = (to.z - v.z) * sign;
      const n = Math.hypot(dx, dz) || 1;
      v.dx = dx / n;
      v.dz = dz / n;
   }
   // nets: a safety leaf under the gap between the vines either side of it
   for (const n of nets) {
      const a = route[n.at - 1];
      const b = route[n.at];
      if (!a || !b || a.vine < 0 || b.vine < 0) continue;
      const va = vines[a.vine];
      const vb = vines[b.vine];
      addPad("net", (va.x + vb.x) / 2, Math.min(va.y, vb.y) - 7.2, (va.z + vb.z) / 2, 2.2, -1);
   }
   // L2: every branch and leaf bobs (not the start, the stairs keep still), and every second vine with it
   if (cfg.bob) {
      for (const p of pads) {
         if (p.kind !== "branch" && p.kind !== "leaf") continue;
         p.bob = BOB.amp;
         p.phase = (p.id * 0.37) % 1;
      }
      vines.forEach((v, i) => {
         if (i % 2 === 1) {
            v.bob = BOB.amp;
            v.phase = (i * 0.29) % 1;
         }
      });
   }
   const routePads = route.filter((s) => s.pad >= 0).map((s) => pads[s.pad]);
   const lastPad = routePads[routePads.length - 1];
   // the goal: the last platform, wide (level 5: the arena)
   lastPad.kind = cfg.boss ? "arena" : "goal";
   lastPad.bob = 0;
   const top = lastPad.y;

   // orbs: five, at the chest at the bottom of the bot's grip on five vines spread up the climb
   const orbs: Orb[] = [];
   const live = vines.filter((v) => (v.kind === "live" || v.kind === "glow") && v.bob === 0);
   for (let i = 0; i < 5; i++) {
      const v = live[Math.min(live.length - 1, Math.floor(((i + 0.5) / 5) * live.length))];
      if (orbs.some((o) => o.vine === v.id)) continue;
      orbs.push({ x: v.x, y: v.y - ORB_GRIP - 0.5, z: v.z, vine: v.id });
   }
   for (let i = 0; orbs.length < 5 && i < live.length; i++) {
      const v = live[i];
      if (!orbs.some((o) => o.vine === v.id)) orbs.push({ x: v.x, y: v.y - ORB_GRIP - 0.5, z: v.z, vine: v.id });
   }

   // Vexa's hollow: beside the third route platform, toward the trunk, behind the ghost-root wall
   const host = routePads[Math.min(3, routePads.length - 2)];
   const inward = Math.hypot(host.x, host.z) || 1;
   const hx = host.x - (host.x / inward) * 3.1;
   const hz = host.z - (host.z / inward) * 3.1;
   const hollow = addPad("hollow", hx, host.y, hz, 1.1, -1);
   const ghost = { x: hx, z: hz, r: 1.6, y0: host.y - 0.5, y1: host.y + 3 };

   // Nami's canopy leaf: 3.4 m over the fourth route platform, a little outward
   const under = routePads[Math.min(4, routePads.length - 2)];
   const out = Math.hypot(under.x, under.z) || 1;
   const canopy = addPad("canopy", under.x + (under.x / out) * 0.6, under.y + 3.4, under.z + (under.z / out) * 0.6, 1.1, -1);

   // emeralds: a trail inside the hollow, one on the canopy leaf, and a trail beside two vines' swings
   const emeralds: Point[] = [];
   for (let k = 0; k < 3; k++) emeralds.push({ x: hx + (k - 1) * 0.35, y: host.y + 0.9, z: hz + (k - 1) * 0.35 });
   for (let k = 0; k < 3; k++) emeralds.push({ x: canopy.x + (k - 1) * 0.4, y: canopy.y + 0.9, z: canopy.z });
   for (const v of [vines[Math.floor(vines.length / 3)], vines[Math.floor((2 * vines.length) / 3)]]) {
      if (!v) continue;
      // beside the swing (1.6 m off its plane): Zuno's magnet pulls them, a wide swing brushes them
      const px = -v.dz;
      const pz = v.dx;
      for (let k = -1; k <= 1; k++) emeralds.push({ x: v.x + v.dx * k * 1.6 + px * 1.6, y: v.y - 4.2 + Math.abs(k) * 0.5, z: v.z + v.dz * k * 1.6 + pz * 1.6 });
   }

   // snappers (L3, L5): beside every second leaf / branch platform, on its outer rim
   const snappers: Snapper[] = [];
   if (cfg.snappers) {
      routePads.forEach((p, i) => {
         if (i === 0 || i % 2 === 0 || p.r < 1.5 || p.kind === "arena" || p.kind === "goal") return;
         const n = Math.hypot(p.x, p.z) || 1;
         snappers.push({ x: p.x + (p.x / n) * (p.r + 0.5), y: p.y, z: p.z + (p.z / n) * (p.r + 0.5), phase: (snappers.length * 700) % 2000 });
      });
   }
   // monkeys (L4, L5): on perches outside the route, beside vines spread up the climb
   const monkeys: Monkey[] = [];
   for (let i = 0; i < cfg.monkeys; i++) {
      const v = vines[Math.min(vines.length - 1, Math.floor(((i + 0.6) / (cfg.monkeys + 0.4)) * vines.length))];
      const n = Math.hypot(v.x, v.z) || 1;
      monkeys.push({ x: v.x + (v.x / n) * 4.2, y: v.y - 2.4, z: v.z + (v.z / n) * 4.2, phase: i * 1300 });
   }

   // the arena (level 5): the main vine over the arena platform's near edge, the King's vine at its far edge
   let arena: Arena | null = null;
   if (cfg.boss) {
      const ap = lastPad;
      ap.r = 3.6;
      const prev = routePads[routePads.length - 2];
      let dx = ap.x - prev.x;
      let dz = ap.z - prev.z;
      const n = Math.hypot(dx, dz) || 1;
      dx /= n;
      dz /= n;
      const ay = ap.y + 1.4 + 4;
      const mainX = ap.x - dx * 2.6;
      const mainZ = ap.z - dz * 2.6;
      const main: Vine = { id: vines.length, kind: "boss", x: mainX, y: ay, z: mainZ, dx, dz, bob: 0, phase: 0, node: -1 };
      vines.push(main);
      const king: Vine = { id: vines.length, kind: "boss", x: ap.x + dx * 4.4, y: ay, z: ap.z + dz * 4.4, dx: -dx, dz: -dz, bob: 0, phase: 0, node: -1 };
      vines.push(king);
      const s45 = Math.sin(Math.PI / 4) * 4;
      const c45 = Math.cos(Math.PI / 4) * 4;
      const perch = { x: mainX + dx * s45, y: ay - c45 - 0.5, z: mainZ + dz * s45 };
      // phase 2: a quarter second along the flight of a release from 40 degrees at the full swing
      const th = (40 * Math.PI) / 180;
      const v0 = Math.sqrt(2 * 23 * 4 * (Math.cos(th) - Math.cos((75 * Math.PI) / 180)));
      const t = 0.25;
      const hx2 = 4 * Math.sin(th) + v0 * Math.cos(th) * t;
      const hy2 = -4 * Math.cos(th) + v0 * Math.sin(th) * t - 0.5 * 23 * t * t;
      const hang = { x: mainX + dx * hx2, y: ay + hy2 - 0.5, z: mainZ + dz * hx2 };
      arena = { main: main.id, kingVine: king.id, perch, hang, pad: ap.id };
   }

   const glow = vines.findIndex((v) => v.kind === "glow");
   const course: Course = {
      level, cfg, pads, vines, route, orbs, emeralds, snappers, monkeys,
      hollow: hollow.id, ghost, glow, canopy: canopy.id, arena, goal: lastPad.id, top,
   };
   cache.set(level, course);
   return course;
}

/** A pad's place at play time `ms` (L2's bobbing branches move in y). */
export function padY(p: Pad, ms: number): number {
   return p.bob > 0 ? p.y + p.bob * Math.sin(((ms / BOB.periodMs) + p.phase) * Math.PI * 2) : p.y;
}

/** The vertical speed of a bobbing pad or anchor (m/s) at `ms`. */
export function bobSpeed(amp: number, phase: number, ms: number): number {
   if (amp <= 0) return 0;
   return amp * ((2 * Math.PI) / (BOB.periodMs / 1000)) * Math.cos(((ms / BOB.periodMs) + phase) * Math.PI * 2);
}

/** A snapper's state at `ms`: open, warning (its jaws rise) or biting. Cycle 2 s. */
export const SNAP = { cycleMs: 2000, warnMs: 1400, biteMs: 1700, reach: 1.15 } as const;
export function snapPhase(s: Snapper, ms: number): "open" | "warn" | "bite" {
   const t = (((ms + s.phase) % SNAP.cycleMs) + SNAP.cycleMs) % SNAP.cycleMs;
   if (t >= SNAP.biteMs) return "bite";
   if (t >= SNAP.warnMs) return "warn";
   return "open";
}
