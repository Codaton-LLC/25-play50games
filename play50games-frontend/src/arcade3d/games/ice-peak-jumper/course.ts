// The frozen peak: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a chain of platforms climbing round the peak: ICE sheets (no grip: you slide, the run-up
// is your aim), SNOW patches (grip: stop, turn, re-aim; the checkpoints), CRACKED ice (shatters 1.2 s
// after the first touch, back after 4 s). Each link of the main route is one slide-launch in one of the
// four compass directions, so the route runs straight through every platform's centre. Hero side routes
// branch off it: Riko's speed ledges and cracked walls, Nami's high cornices, Kiro's icicle chute, Zuno's
// frozen coin trails, Vexa's ghost-ice caves. README "Levels" lists each layout.
//
// Units: 1 = 1 m, y up. North is -z.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type PeakLevel } from "./levels";

export type Surface = "ice" | "snow" | "cracked";
export type Dir = "N" | "E" | "S" | "W";
export type PlatKind = "main" | "side" | "boss";

export interface Plat {
   id: number;
   x: number;
   z: number;
   /** the top (m) */
   y: number;
   /** half extents along x and z */
   hx: number;
   hz: number;
   surface: Surface;
   kind: PlatKind;
   /** level 5: only solid in this boss phase (-1 always) */
   phase: number;
   /** a slope: the top rises by `rise` along `dir` across the platform (level 5's slam slopes) */
   ramp: { dir: Dir; rise: number } | null;
   /** level 4: snow grips only while this lantern is lit (-1 always) */
   lantern: number;
   /** ms after the first touch it crumbles (cracked 1200, the cairn climb 3000; 0 never) */
   crumbleMs: number;
}

export type WallKind = "cracked" | "ghost" | "cube" | "trail";

export interface Wall {
   x: number;
   z: number;
   y0: number;
   y1: number;
   hx: number;
   hz: number;
   kind: WallKind;
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   /** the hero whose route carries it, or "ride" (the snowball ride's ledge): a bonus orb; null on the main route */
   bonus: HeroId | "ride" | null;
   /** frozen inside an ice wall: only Zuno's magnet pulls it out */
   magnet: boolean;
}

export interface Icicle {
   x: number;
   z: number;
   /** the platform top it falls onto */
   y: number;
}

export interface Chute {
   x: number;
   z: number;
   y0: number;
   y1: number;
   hx: number;
   hz: number;
}

export interface Yeti {
   x: number;
   y: number;
   z: number;
   /** it throws while the hero is inside this box (x0, x1, z0, z1, y0) */
   zone: { x0: number; x1: number; z0: number; z1: number; y0: number };
}

export interface Roller {
   /** the lane: from (x0, z0) to (x1, z1) on the top y */
   x0: number;
   z0: number;
   x1: number;
   z1: number;
   y: number;
   speed: number;
   periodMs: number;
   phaseMs: number;
}

export interface Lantern {
   x: number;
   y: number;
   z: number;
   phaseMs: number;
}

export interface Slime {
   plat: number;
   /** patrols along x (or z) through this offset from the platform centre */
   axis: "x" | "z";
   offset: number;
   amp: number;
   speed: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
}

/** Level 5: the golem's arena and the targets that charge a hit in each phase. */
export interface Arena {
   x: number;
   z: number;
   y: number;
   /** the golem stands here, facing the arena (south) */
   golem: { x: number; z: number; y: number };
   /** the platform whose touch charges a hit, per phase */
   targets: [number, number, number];
   /** where the hero is set down after a charged hit (phases 1 and 2) */
   reset: { x: number; z: number };
}

export interface Course {
   level: LevelId;
   config: PeakLevel;
   plats: Plat[];
   walls: Wall[];
   orbs: OrbDef[];
   mainOrbs: number;
   icicles: Icicle[];
   chutes: Chute[];
   yetis: Yeti[];
   rollers: Roller[];
   lanterns: Lantern[];
   slimes: Slime[];
   /** aligned with progression SECRETS[level] */
   secrets: SecretSpot[];
   /** the main route: platform ids in order (start ... goal) */
   route: number[];
   /**
    * The beacons: the route's snow patches after the start, in order (the goal is the last). Each lights
    * only after the one before it; the summit opens once all are lit; a fall drops you on the last lit.
    */
   beacons: number[];
   start: number;
   goal: number;
   /** the goal platform's top less the start's (the climb) */
   height: number;
   arena: Arena | null;
   /** the lowest top (falls below it less 10 m respawn) */
   floor: number;
}

export const DIRS: Record<Dir, { x: number; z: number }> = { N: { x: 0, z: -1 }, E: { x: 1, z: 0 }, S: { x: 0, z: 1 }, W: { x: -1, z: 0 } };

/** A platform's half extent along a direction. */
export function halfAlong(p: { hx: number; hz: number }, d: Dir): number {
   return d === "N" || d === "S" ? p.hz : p.hx;
}

/** The direction from platform a to b (the main route's links are axis-aligned). */
export function dirBetween(a: { x: number; z: number }, b: { x: number; z: number }): Dir {
   const dx = b.x - a.x;
   const dz = b.z - a.z;
   if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? "E" : "W";
   return dz >= 0 ? "S" : "N";
}

/** The top of a platform at (x, z) (a ramp rises along its direction). */
export function topAt(p: Plat, x: number, z: number): number {
   if (!p.ramp) return p.y;
   const d = DIRS[p.ramp.dir];
   const h = halfAlong(p, p.ramp.dir);
   const along = (x - p.x) * d.x + (z - p.z) * d.z;
   const t = Math.max(0, Math.min(1, (along + h) / (2 * h)));
   return p.y + p.ramp.rise * t;
}

// ---------- the builder ----------

interface Opts {
   surface?: Surface;
   kind?: PlatKind;
   phase?: number;
   ramp?: { dir: Dir; rise: number } | null;
   lantern?: number;
   crumbleMs?: number;
}

class Builder {
   plats: Plat[] = [];
   walls: Wall[] = [];
   orbs: OrbDef[] = [];
   icicles: Icicle[] = [];
   chutes: Chute[] = [];
   yetis: Yeti[] = [];
   rollers: Roller[] = [];
   lanterns: Lantern[] = [];
   slimes: Slime[] = [];
   secrets: SecretSpot[] = [];
   route: number[] = [];
   arena: Arena | null = null;

   add(x: number, z: number, y: number, hx: number, hz: number, o: Opts = {}): Plat {
      const surface = o.surface ?? "ice";
      const p: Plat = {
         id: this.plats.length,
         x,
         z,
         y,
         hx,
         hz,
         surface,
         kind: o.kind ?? "main",
         phase: o.phase ?? -1,
         ramp: o.ramp ?? null,
         lantern: o.lantern ?? -1,
         crumbleMs: o.crumbleMs ?? (surface === "cracked" ? CRACK_MS : 0),
      };
      this.plats.push(p);
      return p;
   }

   /** The start platform of the main route. */
   start(x: number, z: number, y: number, hx: number, hz: number, o: Opts = {}): Plat {
      const p = this.add(x, z, y, hx, hz, { surface: "snow", ...o });
      this.route.push(p.id);
      return p;
   }

   /** A platform `gap` m beyond `from` along `dir`, `rise` m higher (centres on one axis). */
   beyond(from: Plat, dir: Dir, gap: number, rise: number, hx: number, hz: number, o: Opts = {}): Plat {
      const d = DIRS[dir];
      const reach = halfAlong(from, dir) + gap + (dir === "N" || dir === "S" ? hz : hx);
      return this.add(from.x + d.x * reach, from.z + d.z * reach, from.y + rise, hx, hz, o);
   }

   /** The next main-route platform. */
   next(dir: Dir, gap: number, rise: number, hx: number, hz: number, o: Opts = {}): Plat {
      const from = this.plats[this.route[this.route.length - 1]];
      const p = this.beyond(from, dir, gap, rise, hx, hz, o);
      this.route.push(p.id);
      return p;
   }

   last(): Plat {
      return this.plats[this.route[this.route.length - 1]];
   }

   orb(x: number, y: number, z: number, bonus: HeroId | "ride" | null = null, magnet = false): void {
      this.orbs.push({ x, y, z, bonus, magnet });
   }

   /** A row of n orbs over a platform's top along a direction through its centre. */
   orbRow(p: Plat, dir: Dir, n: number, bonus: HeroId | "ride" | null = null, spacing = 1.8): void {
      const d = DIRS[dir];
      for (let i = 0; i < n; i++) {
         const k = (i - (n - 1) / 2) * spacing;
         this.orb(p.x + d.x * k, p.y + ORB_Y, p.z + d.z * k, bonus);
      }
   }

   /** Riko: a speed ledge `gap` m off `from` (only a dash-boosted launch reaches it), its orbs. */
   speedLedge(from: Plat, dir: Dir, gap: number): Plat {
      const p = this.beyond(from, dir, gap, 0.4, 2.2, 2.2, { surface: "snow", kind: "side" });
      this.orbRow(p, dir, 2, "riko", 1.4);
      return p;
   }

   /** Nami: a high cornice `rise` m over `from` (only a second jump reaches it), its orbs. */
   highLedge(from: Plat, dir: Dir, rise: number): Plat {
      const p = this.beyond(from, dir, 0.6, rise, 2, 2, { surface: "snow", kind: "side" });
      this.orbRow(p, dir, 2, "nami", 1.4);
      return p;
   }

   /** Vexa: a ghost-ice wall across the mouth of a back cave beside `from`, its orbs (and a secret). */
   ghostCave(from: Plat, dir: Dir, secret: boolean): Plat {
      const p = this.beyond(from, dir, 0.0, 0, 2.2, 2.2, { surface: "snow", kind: "side" });
      const d = DIRS[dir];
      const edge = halfAlong(from, dir) + 0.1;
      this.walls.push({
         x: from.x + d.x * edge,
         z: from.z + d.z * edge,
         y0: from.y - 0.5,
         y1: from.y + 4,
         hx: d.x !== 0 ? 0.25 : from.hx,
         hz: d.z !== 0 ? 0.25 : from.hz,
         kind: "ghost",
      });
      this.orbRow(p, dir === "N" || dir === "S" ? "E" : "N", 2, "vexa", 1.4);
      if (secret) this.secrets.push({ x: p.x, y: p.y + 0.9, z: p.z });
      return p;
   }

   /** Zuno: a coin trail frozen in an ice wall beside platform `p` (on its `side`), 3 orbs. */
   trail(p: Plat, side: Dir): void {
      const d = DIRS[side];
      const off = halfAlong(p, side) + 1.6;
      const wx = p.x + d.x * off;
      const wz = p.z + d.z * off;
      const alongX = d.z !== 0;
      this.walls.push({ x: wx, z: wz, y0: p.y - 1, y1: p.y + 3, hx: alongX ? 2.6 : 0.5, hz: alongX ? 0.5 : 2.6, kind: "trail" });
      for (let i = -1; i <= 1; i++) this.orb(wx + (alongX ? i * 1.6 : 0), p.y + 1.4, wz + (alongX ? 0 : i * 1.6), "zuno", true);
   }

   /** Kiro: an icicle-rain chute over a shortcut platform beyond `from` (crossing it needs the shield), its orbs. */
   chute(from: Plat, dir: Dir, gap: number, rise: number): Plat {
      const p = this.beyond(from, dir, gap, rise, 2.2, 2.2, { surface: "snow", kind: "side" });
      this.chutes.push({ x: p.x, z: p.z, y0: p.y - 0.5, y1: p.y + 5, hx: p.hx + 0.3, hz: p.hz + 0.3 });
      this.orbRow(p, dir, 2, "kiro", 1.4);
      return p;
   }

   /** Riko: the golden mitten frozen in an ice cube beside `p` (a dash breaks the cube). */
   mitten(p: Plat, side: Dir): void {
      const d = DIRS[side];
      const off = halfAlong(p, side) - 1.0;
      const x = p.x + d.x * off;
      const z = p.z + d.z * off;
      this.walls.push({ x, z, y0: p.y, y1: p.y + 1.6, hx: 0.8, hz: 0.8, kind: "cube" });
      this.secrets.push({ x, y: p.y + 0.8, z });
   }

   /** The hidden ledge behind the peak: `gap` m off `from` (a launch of 8.5 m/s and up), its secret. */
   hidden(from: Plat, dir: Dir, gap: number): Plat {
      const p = this.beyond(from, dir, gap, 0.2, 1.6, 1.6, { surface: "snow", kind: "side" });
      this.secrets.push({ x: p.x, y: p.y + 0.9, z: p.z });
      return p;
   }

   /** The shortcut flag on a high cornice (Nami): a high ledge with the secret on it. */
   flag(from: Plat, dir: Dir, rise: number): Plat {
      const p = this.highLedge(from, dir, rise);
      this.secrets.push({ x: p.x, y: p.y + 0.9, z: p.z });
      return p;
   }
}

/** Riko's speed ledges sit this far off their run (m): only a dash launch reaches (9 m/s carries 6.7 m) */
export const SPEED_GAP = 6.8;
/** the orbs float this high over a top */
export const ORB_Y = 0.9;
/** cracked ice shatters this long after the first touch (the card's 1.2 s) */
export const CRACK_MS = 1200;
/** the cairn climb's platforms crumble this long after the first touch (the card's 3 s) */
export const CLIMB_CRUMBLE_MS = 3000;

/** Main-route orbs: one over each platform's centre (the landing aim), then more along each run (the outgoing direction). */
function routeOrbs(b: Builder, want: number): void {
   const before = b.orbs.length;
   const r = b.route;
   // (not on the last platform: the goal ends the run as you land)
   for (let i = 1; i < r.length - 1 && b.orbs.length - before < want; i++) {
      const p = b.plats[r[i]];
      b.orb(p.x, p.y + ORB_Y, p.z);
   }
   // more along the runs (the outgoing direction) until the card's count
   for (let pass = 0; pass < 3 && b.orbs.length - before < want; pass++) {
      for (let i = 1; i < r.length - 1 && b.orbs.length - before < want; i++) {
         const p = b.plats[r[i]];
         const n = b.plats[r[i + 1]];
         // behind the centre only on ice (you slide back to the run-up start there; on snow you walk on)
         if (pass === 1 && p.surface !== "ice") continue;
         const dn = dirBetween(p, n);
         const d = DIRS[dn];
         const k = halfAlong(p, dn) * (pass === 0 ? 0.55 : pass === 1 ? -0.55 : 0.8);
         b.orb(p.x + d.x * k, p.y + ORB_Y, p.z + d.z * k);
      }
   }
}

// ---------- the levels ----------

function level1(b: Builder): void {
   // Base Camp: (1) slide across a flat ice sheet and stop on snow, (2) the 3 m gap, (3) a cracked platform
   const s = b.start(0, 0, 0, 3, 3);
   const sheet = b.next("N", 0.8, 0, 3.5, 6);
   b.trail(sheet, "W");
   // the mitten cube sits on the sheet's east side (ice: a dash takes a run at it)
   b.mitten(sheet, "E");
   b.next("N", 0.8, 0.4, 2.5, 2.5, { surface: "snow" });
   const run = b.next("N", 0.8, 0.5, 3, 4.5);
   b.ghostCave(run, "W", false);
   b.next("N", 3.0, 0.5, 2.5, 2.5, { surface: "snow" });
   b.next("E", 1.4, 0.8, 2.5, 2.5, { surface: "cracked" });
   b.next("E", 1.4, 0.8, 2.5, 2.5, { surface: "snow" });
   const longIce = b.next("N", 1.0, 1.0, 3, 5);
   b.speedLedge(longIce, "E", SPEED_GAP);
   b.next("N", 2.0, 1.0, 3.5, 3.5);
   const wIce = b.next("W", 1.8, 1.0, 4.5, 3);
   b.hidden(wIce, "S", 6.4);
   b.next("W", 1.5, 1.0, 2.5, 2.5, { surface: "snow" });
   const up = b.next("N", 1.8, 1.2, 3, 4.5);
   b.highLedge(up, "E", 3.6);
   b.next("N", 1.8, 1.2, 2.5, 2.5, { surface: "cracked" });
   b.next("N", 1.6, 1.2, 4, 4, { surface: "snow" });
   void s;
}

function level2(b: Builder): void {
   // Icicle Steps: tiered ledges zig-zag (plan the slide direction), icicles shake 0.8 s, then drop
   b.start(0, 0, 0, 3, 3);
   const a = b.next("N", 1.0, 0.6, 3, 5);
   // the icicles hang beside each run (1.7 m off its line): pass by and they shake, linger and they drop
   b.icicles.push({ x: a.x + 1.7, z: a.z - 2.2, y: a.y });
   b.next("E", 1.4, 0.8, 2.5, 2.5, { surface: "snow" });
   const c = b.next("E", 1.6, 0.8, 5, 3);
   b.icicles.push({ x: c.x + 1.5, z: c.z - 1.7, y: c.y });
   b.trail(c, "S");
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "snow" });
   const e = b.next("W", 1.8, 1.0, 5, 3);
   b.icicles.push({ x: e.x - 1.4, z: e.z + 1.7, y: e.y });
   b.chute(e, "S", 1.2, 2.0);
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "cracked" });
   const g = b.next("N", 1.6, 1.0, 3, 5);
   b.icicles.push({ x: g.x - 1.7, z: g.z + 1.6, y: g.y });
   b.ghostCave(g, "W", true);
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "snow" });
   const i = b.next("E", 1.8, 1.1, 5, 3);
   b.icicles.push({ x: i.x + 1.2, z: i.z - 1.7, y: i.y });
   b.flag(i, "S", 3.6);
   b.next("E", 1.6, 1.1, 2.5, 2.5, { surface: "snow" });
   const k = b.next("N", 1.8, 1.2, 3, 5);
   b.speedLedge(k, "E", SPEED_GAP);
   b.icicles.push({ x: k.x - 1.7, z: k.z - 1.8, y: k.y });
   b.next("W", 1.6, 1.2, 2.5, 2.5, { surface: "cracked" });
   b.next("W", 1.6, 1.2, 4.5, 3);
   b.next("W", 1.6, 1.2, 4, 4, { surface: "snow" });
}

function level3(b: Builder): void {
   // Yeti Ridge: a yeti on a high ledge throws snowballs every 3 s; rolling snowballs on the ramp sheets (ride one)
   b.start(0, 0, 0, 3, 3);
   const a = b.next("N", 1.0, 0.6, 3, 5);
   b.mitten(a, "W");
   b.next("N", 1.6, 0.8, 2.5, 2.5, { surface: "snow" });
   const c = b.next("E", 1.6, 0.9, 5, 3);
   b.trail(c, "S");
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "cracked" });
   const e = b.next("N", 1.6, 1.0, 3, 5);
   // the rolling-snowball sheet beside the route (ride a snowball to its orbs)
   const sheet = b.beyond(e, "E", 1.2, 0, 5, 3, { kind: "side" });
   b.rollers.push({ x0: sheet.x - 4.5, z0: sheet.z, x1: sheet.x + 4.5, z1: sheet.z, y: sheet.y, speed: 4, periodMs: 4500, phaseMs: 0 });
   const top = b.beyond(sheet, "E", 1.0, 1.0, 2, 2, { surface: "snow", kind: "side" });
   b.orbRow(top, "N", 2, "ride", 1.4);
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "snow" });
   const g = b.next("W", 1.8, 1.1, 5, 3);
   b.ghostCave(g, "N", true);
   b.next("W", 1.6, 1.1, 2.5, 2.5, { surface: "snow" });
   const i = b.next("N", 1.8, 1.1, 3, 5);
   b.chute(i, "W", 1.2, 2.0);
   b.next("E", 1.6, 1.1, 2.5, 2.5, { surface: "cracked" });
   const k = b.next("E", 1.8, 1.2, 5, 3);
   b.highLedge(k, "N", 3.6);
   b.next("E", 1.6, 1.2, 2.5, 2.5, { surface: "snow" });
   b.next("N", 1.8, 1.2, 3, 4.5);
   b.next("N", 1.6, 1.2, 4, 4, { surface: "snow" });
   // the yeti on its ledge over the middle of the ridge, throwing at whoever is on the ridge's upper half
   const mid = b.plats[b.route[Math.floor(b.route.length / 2)]];
   const ys = b.plats.filter((p) => p.kind === "main" && p.y >= mid.y - 0.5);
   const x0 = Math.min(...ys.map((p) => p.x - p.hx));
   const x1 = Math.max(...ys.map((p) => p.x + p.hx));
   const z0 = Math.min(...ys.map((p) => p.z - p.hz));
   const z1 = Math.max(...ys.map((p) => p.z + p.hz));
   b.yetis.push({ x: x1 + 6, y: mid.y + 5, z: (z0 + z1) / 2, zone: { x0, x1, z0, z1, y0: mid.y - 1 } });
   b.add(x1 + 6, (z0 + z1) / 2, mid.y + 5, 2, 2, { surface: "snow", kind: "side" });
}

function level4(b: Builder): void {
   // Lantern Night: snow grips only while its lantern is lit (a 6 s loop: lit 4 s, dark 2 s); ice slimes patrol
   b.start(0, 0, 0, 3, 3);
   let lanterns = 0;
   const lit = (o: Opts = {}): Opts => ({ surface: "snow", lantern: lanterns++, ...o });
   const a = b.next("N", 1.0, 0.6, 3, 5);
   b.trail(a, "E");
   const s1 = b.next("N", 1.6, 0.8, 2.6, 2.6, lit());
   b.slimes.push({ plat: s1.id, axis: "x", offset: 1.9, amp: 1.6, speed: 1.2 });
   const c = b.next("W", 1.6, 0.9, 5, 3);
   b.flag(c, "N", 3.6);
   b.next("W", 1.6, 1.0, 2.6, 2.6, lit());
   const e = b.next("N", 1.6, 1.0, 3, 5);
   b.ghostCave(e, "W", false);
   const s3 = b.next("N", 1.6, 1.0, 2.6, 2.6, lit());
   b.slimes.push({ plat: s3.id, axis: "z", offset: -1.9, amp: 1.6, speed: 1.1 });
   b.next("E", 1.8, 1.1, 5, 3);
   b.next("N", 1.6, 1.1, 2.6, 2.6, { surface: "cracked" });
   const i = b.next("N", 1.8, 1.1, 3, 5);
   b.speedLedge(i, "W", SPEED_GAP);
   b.hidden(i, "E", 6.4);
   b.next("N", 1.6, 1.1, 2.6, 2.6, lit());
   const k = b.next("W", 1.8, 1.2, 5, 3);
   b.chute(k, "S", 1.2, 2.0);
   b.next("W", 1.6, 1.2, 2.6, 2.6, lit());
   b.next("N", 1.8, 1.2, 3, 4.5);
   b.next("E", 1.6, 1.2, 2.6, 2.6, { surface: "cracked" });
   b.next("E", 1.6, 1.2, 4.5, 3);
   b.next("E", 1.6, 1.2, 4, 4, lit());
   // each lantern on a post at its patch's corner, the loops staggered by 1.5 s
   b.plats.forEach((p) => {
      if (p.lantern < 0) return;
      b.lanterns.push({ x: p.x + p.hx - 0.4, y: p.y, z: p.z - p.hz + 0.4, phaseMs: (p.lantern * 1500) % LANTERN.periodMs });
   });
}

function level5(b: Builder): void {
   // Summit Cairn: a short climb to the golem's arena, then the boss (README "Boss")
   b.start(0, 0, 0, 3, 3);
   const a = b.next("N", 1.0, 0.8, 3, 5);
   b.trail(a, "W");
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "snow" });
   const c = b.next("E", 1.6, 1.0, 5, 3);
   b.ghostCave(c, "S", true);
   b.next("N", 1.6, 1.0, 2.5, 2.5, { surface: "cracked" });
   const e = b.next("N", 1.6, 1.1, 3, 5);
   b.hidden(e, "E", 6.4);
   b.next("N", 1.6, 1.1, 2.5, 2.5, { surface: "snow" });
   // the arena: a wide snow floor; the golem on the north side
   const ar = b.next("N", 1.8, 1.2, 9, 7, { surface: "snow" });
   const gx = ar.x;
   const gz = ar.z - ar.hz - 3;
   const gy = ar.y;
   // phase 1: the slam slope (ice, 25 degrees) rising north towards his back; the core on his back
   const slope = b.add(ar.x - 3.5, ar.z - 1.5, ar.y, 1.6, 3.5, { kind: "boss", phase: 0, ramp: { dir: "N", rise: 3.2 } });
   const back = b.beyond(slope, "N", 1.0, 3.6, 1.6, 1.4, { surface: "snow", kind: "boss", phase: 0 });
   // phase 2: glaze; boulder steps up to his shoulder
   const st1 = b.add(ar.x + 4, ar.z + 1.5, ar.y + 1.4, 1.2, 1.2, { surface: "snow", kind: "boss", phase: 1 });
   const st2 = b.beyond(st1, "N", 1.2, 1.4, 1.2, 1.2, { surface: "snow", kind: "boss", phase: 1 });
   const st3 = b.beyond(st2, "W", 1.2, 1.4, 1.2, 1.2, { surface: "snow", kind: "boss", phase: 1 });
   const shoulder = b.beyond(st3, "N", 1.2, 1.4, 1.4, 1.2, { surface: "snow", kind: "boss", phase: 1 });
   // phase 3: the cairn climb, crumbling 3 s behind you, to his head crystal
   const c1 = b.add(ar.x - 6, ar.z + 3, ar.y + 1.4, 1.3, 1.3, { surface: "snow", kind: "boss", phase: 2, crumbleMs: CLIMB_CRUMBLE_MS });
   const c2 = b.beyond(c1, "N", 1.2, 1.4, 1.3, 1.3, { surface: "snow", kind: "boss", phase: 2, crumbleMs: CLIMB_CRUMBLE_MS });
   const c3 = b.beyond(c2, "N", 1.2, 1.4, 1.3, 1.3, { surface: "snow", kind: "boss", phase: 2, crumbleMs: CLIMB_CRUMBLE_MS });
   const c4 = b.beyond(c3, "E", 1.2, 1.4, 1.3, 1.3, { surface: "snow", kind: "boss", phase: 2, crumbleMs: CLIMB_CRUMBLE_MS });
   const c5 = b.beyond(c4, "E", 1.2, 1.4, 1.3, 1.3, { surface: "snow", kind: "boss", phase: 2, crumbleMs: CLIMB_CRUMBLE_MS });
   const head = b.beyond(c5, "N", 1.0, 1.2, 1.6, 1.4, { surface: "snow", kind: "boss", phase: 2 });
   b.arena = { x: ar.x, z: ar.z, y: ar.y, golem: { x: gx, z: gz, y: gy }, targets: [back.id, shoulder.id, head.id], reset: { x: ar.x, z: ar.z + 3 } };
   // the summit beyond his head (open once he is free): the goal
   const summit = b.beyond(head, "N", 1.0, 0.4, 3, 3, { surface: "snow", kind: "main" });
   b.route.push(summit.id);
}

const LAYOUTS: Record<LevelId, (b: Builder) => void> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };

/** The lantern loop (level 4): lit 4 s, dark 2 s. */
export const LANTERN = { periodMs: 6000, litMs: 4000 } as const;

export function buildCourse(level: LevelId, config: PeakLevel = LEVELS[level]): Course {
   const b = new Builder();
   LAYOUTS[level](b);
   const bonus = b.orbs.length;
   // the main route's orbs (level 5: up to the arena)
   const routeEnd = config.boss ? b.route.length - 1 : b.route.length;
   const saved = b.route;
   b.route = saved.slice(0, routeEnd);
   routeOrbs(b, MAIN_ORB_TARGET[level]);
   b.route = saved;
   const orbs = b.orbs.slice(bonus).concat(b.orbs.slice(0, bonus));
   const start = b.route[0];
   const goal = b.route[b.route.length - 1];
   const floor = Math.min(...b.plats.map((p) => p.y));
   return {
      level,
      config,
      plats: b.plats,
      walls: b.walls,
      orbs,
      mainOrbs: orbs.filter((o) => o.bonus === null).length,
      icicles: b.icicles,
      chutes: b.chutes,
      yetis: b.yetis,
      rollers: b.rollers,
      lanterns: b.lanterns,
      slimes: b.slimes,
      secrets: b.secrets,
      route: b.route,
      beacons: b.route.slice(1).filter((id) => b.plats[id].surface === "snow"),
      start,
      goal,
      height: b.plats[goal].y - b.plats[start].y,
      arena: b.arena,
      floor,
   };
}

/** The card's main orb counts (25 / 30 / 35 / 40 / 45); a layout with fewer route spots carries fewer. */
const MAIN_ORB_TARGET: Record<LevelId, number> = { 1: 25, 2: 30, 3: 35, 4: 40, 5: 45 };

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}
