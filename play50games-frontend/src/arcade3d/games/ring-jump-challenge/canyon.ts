// The sea canyon of every level, as pure data (no React, no three.js): rings, orbs, updraft geysers,
// blade gates, wall pockets (the open niche with the gold ring, Riko's cracked seal, Vexa's ghost
// panel into the inner shaft), Kiro's storm-shear pockets, Zuno's orbs hidden in the wall, Nami's
// ledge nooks, the narrow slot sections, the target pad and the marked pool, and on level 5 the storm
// eye where Cyclone Ray fights. The same level is the same canyon for every run (no randomness here).
//
// Axes: y up (the sea at y = 0, the start column's top at y = depth), the shaft's axis is x = z = 0.
// The run starts on the +z rim and leaps towards -z (stick "up" with the orbit camera's start yaw).
// A position on the wall is polar: angle a (degrees, 0 = +x, 90 = +z) and radius from the axis.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type RingLevel } from "./levels";

export type RingKind = "ring" | "speed" | "gold" | "bonus";

/** A ring moving on the horizontal plane: an orbit round (cx, cz) or a slide along (ax, az). */
export interface RingMotion {
   kind: "orbit" | "slide";
   /** orbit: the circle's radius (m); slide: the half travel (m) */
   amp: number;
   /** rad/s (the peak speed is amp x omega m/s: the card's 2-4 m/s) */
   omega: number;
   phase: number;
   /** slide direction (unit, on the plane) */
   ax: number;
   az: number;
}

export interface RingDef {
   /** the ring's centre at rest (an orbit's centre) */
   x: number;
   y: number;
   z: number;
   /** the opening's radius (m): the hero's centre inside it threads the ring */
   r: number;
   kind: RingKind;
   /** on the main line: crossing its plane close by without threading it is a miss (the Perfect Streak) */
   main: boolean;
   motion: RingMotion | null;
   /** level 1's closing trio: the ring shrinks shut this long after the hero passes course.trioY (ms), else NaN */
   closeMs: number;
}

export type OrbGate = "none" | HeroId;

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   /** a hero-gated orb (not a main orb): behind a seal, under a ledge, in a storm, in the wall, in the inner shaft */
   gate: OrbGate;
}

/** An updraft geyser: a vertical column that slows the fall (the card's m2SpringPad geysers). */
export interface UpdraftDef {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
}

/** A blade gate (level 4-5): an arm turning on the plane at y with a spiked ball on each end. */
export interface BladeDef {
   x: number;
   y: number;
   z: number;
   arm: number;
   omega: number;
   phase: number;
}

export type PocketKind = "open" | "seal" | "ghost";

/**
 * A pocket behind the canyon wall: a vertical cylinder (radius pr) centred `out` metres from the axis
 * at angle `a`, between y0 and y1. "open": a niche you see through a gap (the gold ring); "seal": a
 * cracked ring seal only Riko's dash breaks; "ghost": a ghost panel only Vexa's phase slips through
 * (the inner shaft).
 */
export interface PocketDef {
   kind: PocketKind;
   a: number;
   out: number;
   pr: number;
   y0: number;
   y1: number;
   /** the pocket's centre (from a and out) */
   x: number;
   z: number;
}

/** A storm-shear pocket in the shaft: anyone but a shielded Kiro is blown out of it. */
export interface StormDef {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
}

/** A stone ledge jutting from the wall at angle a, from radius `inner` out into the wall, `half` wide, y0..y1. */
export interface LedgeDef {
   a: number;
   inner: number;
   half: number;
   y0: number;
   y1: number;
   /** the spring pad of an updraft stands on it (visual), else Nami's nook */
   geyser: boolean;
}

/** A section where the shaft has another radius (level 4's slots). */
export interface SectionDef {
   y0: number;
   y1: number;
   r: number;
}

export interface PadDef {
   x: number;
   z: number;
   y: number;
   r: number;
   /** the bull's-eye radius */
   bull: number;
}

export interface PoolDef {
   x: number;
   z: number;
   r: number;
}

export type SecretSpot = { kind: "ring"; ring: number } | { kind: "pickup"; x: number; y: number; z: number } | { kind: "landing" };

/** Level 5's storm eye: from `top` down it descends at `speed` m/s and stops at `stop` (its centre). */
export interface ArenaDef {
   top: number;
   stop: number;
   speed: number;
   /** the hero is held at least this far under the eye's centre... */
   floor: number;
   /** ...and this much deeper while diving (the dive strike) */
   diveFloor: number;
}

export interface Course {
   level: LevelId;
   /** the start column's top (the drop) */
   top: number;
   radius: number;
   durationMs: number;
   parMs: number;
   startX: number;
   startZ: number;
   rings: RingDef[];
   orbs: OrbDef[];
   /** orbs with gate "none" (the all-orbs star) */
   mainOrbs: number;
   updrafts: UpdraftDef[];
   blades: BladeDef[];
   pockets: PocketDef[];
   storms: StormDef[];
   ledges: LedgeDef[];
   sections: SectionDef[];
   /** level 1's closing trio starts its clock when the hero falls past this y (NaN: none) */
   trioY: number;
   pad: PadDef;
   pool: PoolDef | null;
   /** one per SECRETS[level] entry, in order */
   secrets: SecretSpot[];
   arena: ArenaDef | null;
   boss: boolean;
   /** decor: where the stone ring monuments stand on the wall (angle, y) */
   monuments: { a: number; y: number; s: number }[];
   /** decor: the sea stacks round the bottom (x, z, scale) */
   rocks: { x: number; z: number; s: number; rot: number }[];
}

const DEG = Math.PI / 180;

export function polarX(aDeg: number, r: number): number {
   return Math.cos(aDeg * DEG) * r;
}

export function polarZ(aDeg: number, r: number): number {
   return Math.sin(aDeg * DEG) * r;
}

/** The pad top (m above the sea) of every level's target column. */
export const PAD_TOP = 8;

// ---------- the builder ----------

interface Draft extends Course {}

function draft(level: RingLevel): Draft {
   return {
      level: level.id,
      top: level.depth,
      radius: level.radius,
      durationMs: level.durationMs,
      parMs: level.parMs,
      startX: 0,
      startZ: level.radius + 1.2,
      rings: [],
      orbs: [],
      mainOrbs: 0,
      updrafts: [],
      blades: [],
      pockets: [],
      storms: [],
      ledges: [],
      sections: [],
      trioY: Number.NaN,
      pad: { x: 0, z: 0, y: PAD_TOP, r: 3.4, bull: 0.9 },
      pool: null,
      secrets: [],
      arena: null,
      boss: level.boss,
      monuments: [],
      rocks: [],
   };
}

interface RingOpts {
   kind?: RingKind;
   main?: boolean;
   motion?: RingMotion | null;
   closeMs?: number;
}

function ring(c: Draft, x: number, y: number, z: number, r: number, o: RingOpts = {}): number {
   c.rings.push({ x, y, z, r, kind: o.kind ?? "ring", main: o.main ?? (o.kind === undefined || o.kind === "ring" || o.kind === "speed"), motion: o.motion ?? null, closeMs: o.closeMs ?? Number.NaN });
   return c.rings.length - 1;
}

function orb(c: Draft, x: number, y: number, z: number, gate: OrbGate = "none"): void {
   c.orbs.push({ x, y, z, gate });
}

/** `n` orbs evenly between two points (both ends excluded). */
function orbLine(c: Draft, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, n: number, gate: OrbGate = "none"): void {
   for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      orb(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, gate);
   }
}

/** Orbs on the line between consecutive (static) rings. */
function trailBetween(c: Draft, from: number, to: number, n: number): void {
   const a = c.rings[from];
   const b = c.rings[to];
   orbLine(c, a.x, a.y, a.z, b.x, b.y, b.z, n);
}

const slide = (amp: number, omega: number, phase: number, ax = 1, az = 0): RingMotion => ({ kind: "slide", amp, omega, phase, ax, az });
const orbit = (amp: number, omega: number, phase: number): RingMotion => ({ kind: "orbit", amp, omega, phase, ax: 0, az: 0 });

function pocket(c: Draft, kind: PocketKind, a: number, y0: number, y1: number, pr = 3.2): PocketDef {
   const out = radiusOf(c, (y0 + y1) / 2) + pr * 0.55;
   const p: PocketDef = { kind, a, out, pr, y0, y1, x: polarX(a, out), z: polarZ(a, out) };
   c.pockets.push(p);
   return p;
}

function radiusOf(c: Pick<Course, "radius" | "sections">, y: number): number {
   let r = c.radius;
   for (const s of c.sections) if (y >= s.y0 && y <= s.y1) r = Math.min(r, s.r);
   return r;
}

/** The gold ring (the secret every level hides): in an open niche off the main line, seen through its gap. */
function goldNiche(c: Draft, a: number, y: number): void {
   const p = pocket(c, "open", a, y - 10, y + 6, 3.4);
   const i = ring(c, p.x, y, p.z, 1.9, { kind: "gold", main: false });
   c.secrets.push({ kind: "ring", ring: i });
}

/** Riko's cracked seal over a side shaft with three orbs (and on level 4 the seal shard). */
function sealShaft(c: Draft, a: number, y: number, shard = false): void {
   const p = pocket(c, "seal", a, y - 14, y + 4, 3.2);
   for (let k = 0; k < 3; k++) orb(c, p.x, y - 2 - k * 3.5, p.z, "riko");
   if (shard) c.secrets.push({ kind: "pickup", x: p.x, y: y - 12, z: p.z });
}

/** Vexa's ghost panel into the inner shaft: bonus rings down it, the sticker (levels 2 and 5) at its foot. */
function innerShaft(c: Draft, a: number, y: number, len: number, sticker: boolean): void {
   const p = pocket(c, "ghost", a, y - len, y + 4, 3.3);
   const n = Math.max(3, Math.round(len / 18));
   for (let k = 0; k < n; k++) ring(c, p.x, y - 6 - (k * (len - 14)) / Math.max(1, n - 1), p.z, 2.1, { kind: "bonus", main: false });
   for (let k = 0; k < n - 1; k++) orb(c, p.x, y - 6 - ((k + 0.5) * (len - 14)) / Math.max(1, n - 1), p.z, "vexa");
   if (sticker) c.secrets.push({ kind: "pickup", x: p.x, y: y - len + 3, z: p.z });
}

/** Kiro's storm-shear pocket with three orbs in its eye. */
function stormPocket(c: Draft, x: number, z: number, y: number, h = 30): void {
   c.storms.push({ x, z, r: 3.6, y0: y - h, y1: y });
   for (let k = 0; k < 3; k++) orb(c, x, y - 6 - k * ((h - 12) / 2), z, "kiro");
}

/** Zuno's hidden trail: three orbs inside the wall (only his magnet pulls them out). */
function wallTrail(c: Draft, a: number, y: number): void {
   const r = radiusOf(c, y) + 1.3;
   for (let k = 0; k < 3; k++) orb(c, polarX(a + k * 3, r), y - k * 5, polarZ(a + k * 3, r), "zuno");
}

/** Nami's nook: a stone ledge with an orb tucked under it against the wall. */
function ledgeNook(c: Draft, a: number, y: number): void {
   const R = radiusOf(c, y);
   c.ledges.push({ a, inner: R - 4.2, half: 2.6, y0: y - 1.2, y1: y, geyser: false });
   const r = R - 1.6;
   orb(c, polarX(a, r), y - 2.6, polarZ(a, r), "nami");
}

/** An updraft geyser column from y0 to y1 with its spring pad on a ledge just under it. */
function updraft(c: Draft, a: number, rad: number, y0: number, y1: number, r = 4): UpdraftDef {
   const u: UpdraftDef = { x: polarX(a, rad), z: polarZ(a, rad), r, y0, y1 };
   c.updrafts.push(u);
   const R = radiusOf(c, y0);
   c.ledges.push({ a, inner: Math.min(R - 2, rad + r * 0.4), half: 2.4, y0: y0 - 2.4, y1: y0 - 1.6, geyser: true });
   return u;
}

function blade(c: Draft, x: number, y: number, z: number, arm: number, omega: number, phase: number): void {
   c.blades.push({ x, y, z, arm, omega, phase });
}

function finishDecor(c: Draft): void {
   const R = c.radius;
   const n = Math.max(6, Math.round(c.top / 80));
   for (let k = 0; k < n; k++) c.monuments.push({ a: (k * 137.5) % 360, y: c.top - 30 - (k * (c.top - 60)) / n, s: 9 + (k % 3) * 2.5 });
   for (let k = 0; k < 9; k++) {
      const a = k * 40 + 13;
      const r = R - 2.5 - (k % 3) * 1.4;
      c.rocks.push({ x: polarX(a, r), z: polarZ(a, r), s: 3.2 + (k % 4) * 0.9, rot: k * 1.7 });
   }
   c.mainOrbs = c.orbs.filter((o) => o.gate === "none").length;
}

// ---------- the five levels ----------

/** L1 Wide Rings: beat 1 a column of big rings straight below, beat 2 offset rings to steer, beat 3 a gap you dive to beat the closing trio. */
function wideRings(c: Draft): void {
   const t = c.top;
   // beat 1: just fall through them
   const b1 = [ring(c, 0, t - 16, 12, 5), ring(c, 0, t - 30, 9, 5), ring(c, 0, t - 44, 6, 5), ring(c, 0, t - 58, 3, 5), ring(c, 0, t - 72, 0, 5)];
   for (let k = 0; k + 1 < b1.length; k++) trailBetween(c, b1[k], b1[k + 1], 1);
   // beat 2: offset sideways, steer (an orb trail shows the line)
   const b2 = [ring(c, 5, t - 92, 2, 4.2), ring(c, -4, t - 112, -3, 4.2), ring(c, 4, t - 132, -7, 4), ring(c, -5, t - 152, -2, 4), ring(c, 3, t - 172, 4, 4)];
   trailBetween(c, b1[b1.length - 1], b2[0], 1);
   for (let k = 0; k + 1 < b2.length; k++) trailBetween(c, b2[k], b2[k + 1], 2);
   // beat 3: a gap with orbs straight down (diving keeps pace), then the closing trio, then the wide pad
   c.trioY = t - 184;
   orbLine(c, 3, t - 176, 4, 0, t - 268, 0, 5);
   ring(c, 0, t - 272, 0, 5.2, { closeMs: 4300 });
   ring(c, 0, t - 281, 0, 5.2, { closeMs: 4600 });
   ring(c, 0, t - 290, 0, 5.2, { closeMs: 4900 });
   orbLine(c, 0, t - 290, 0, 0, PAD_TOP + 2, 0, 3);
   // the secrets and the heroes' routes (soft on level 1: a niche, a seal, a nook)
   goldNiche(c, 205, t - 120);
   sealShaft(c, 40, t - 100);
   ledgeNook(c, 0, t - 205);
   wallTrail(c, 140, t - 150);
   innerShaft(c, 300, t - 60, 60, false);
   stormPocket(c, -9, 7, t - 205, 26);
   c.pad = { x: 0, z: 0, y: PAD_TOP, r: 4.2, bull: 1.1 };
   c.pool = { x: 10, z: -8, r: 4.5 };
   c.secrets.push({ kind: "landing" });
}

/** L2 Moving Rings: rings slide and orbit at 2-4 m/s, so you aim where they will be. */
function movingRings(c: Draft): void {
   const t = c.top;
   ring(c, 0, t - 16, 11, 4.8);
   // section A: rings sliding side to side
   for (let k = 0; k < 6; k++) {
      const y = t - 34 - k * 18;
      ring(c, 0, y, 6 - k * 2, 4.2, { motion: slide(4, 0.6, k * 0.8) });
      orb(c, 0, y - 9, 5 - k * 2);
   }
   // section B: rings orbiting the axis
   for (let k = 0; k < 7; k++) {
      const y = t - 146 - k * 15;
      ring(c, 0, y, 0, 3.9, { motion: orbit(6, 0.4, k * 0.6) });
   }
   // section C: pairs, z slides and tight orbits round offset centres
   for (let k = 0; k < 8; k++) {
      const y = t - 258 - k * 16;
      const cx = k % 2 === 0 ? 2.5 : -2.5;
      if (k % 3 === 2) ring(c, cx, y, -1, 3.6, { motion: orbit(2.5, 1, k) });
      else ring(c, cx, y, 0, 3.6, { motion: slide(3, 0.8, k * 0.7, 0, 1) });
      orb(c, cx * 0.5, y - 6.5, 0);
   }
   orbLine(c, 0, t - 380, 0, 0, PAD_TOP + 2, 0, 3);
   goldNiche(c, 135, t - 190);
   innerShaft(c, 300, t - 90, 80, true);
   sealShaft(c, 45, t - 250);
   stormPocket(c, 8, -8, t - 140, 30);
   wallTrail(c, 200, t - 300);
   ledgeNook(c, 270, t - 215);
   c.pad = { x: 0, z: 0, y: PAD_TOP, r: 3.4, bull: 0.9 };
   c.pool = { x: -9, z: 8, r: 4 };
}

/** L3 Updraft Rings: a fast vertical line of speed rings, or a slow wide line of geysers with more rings. */
function updraftRings(c: Draft): void {
   const t = c.top;
   // shared opening
   for (let k = 0; k < 4; k++) ring(c, 0, t - 18 - k * 14, 10 - k * 3.5, 4.6);
   orbLine(c, 0, t - 18, 10, 0, t - 60, -0.5, 3);
   // the fast line (+x): speed rings straight down, no orbs
   for (let k = 0; k < 9; k++) ring(c, 11, t - 90 - k * 30, 0, 3.6, { kind: "speed" });
   // the slow wide line (-x): three geysers, each with a spiral of rings and orbs in it
   const geysers = [updraft(c, 180, 10, t - 150, t - 100), updraft(c, 200, 10, t - 245, t - 195), updraft(c, 165, 10, t - 340, t - 290)];
   for (const u of geysers) {
      for (let k = 0; k < 5; k++) {
         const a = k * 72;
         const y = u.y1 - 4 - k * 9;
         ring(c, u.x + polarX(a, 2.2), y, u.z + polarZ(a, 2.2), 2.6);
         orb(c, u.x + polarX(a + 36, 2.2), y - 4.5, u.z + polarZ(a + 36, 2.2));
      }
   }
   // between the geysers: rings that walk the line back to the next one
   ring(c, -8, t - 172, 2, 3.8);
   ring(c, -9, t - 268, -3, 3.8);
   orb(c, -8, t - 180, 2);
   orb(c, -9, t - 276, -3);
   // shared finale
   for (let k = 0; k < 5; k++) ring(c, k % 2 === 0 ? -3 : 3, t - 370 - k * 22, 0, 4.2);
   orbLine(c, -3, t - 370, 0, 0, PAD_TOP + 2, 0, 5);
   goldNiche(c, 90, t - 230);
   sealShaft(c, 300, t - 130);
   innerShaft(c, 250, t - 380, 70, false);
   stormPocket(c, 3, 12, t - 220, 34);
   wallTrail(c, 30, t - 420);
   ledgeNook(c, 180, t - 360);
   c.pad = { x: 0, z: 0, y: PAD_TOP, r: 3.2, bull: 0.85 };
   c.pool = { x: 9, z: 9, r: 4 };
   c.secrets.push({ kind: "landing" });
}

/** L4 Fast Route: the canyon pinches into slots with spinning blade gates; diving is risky but fast. */
function fastRoute(c: Draft): void {
   const t = c.top;
   const slots: [number, number][] = [
      [t - 130, t - 80],
      [t - 290, t - 220],
      [t - 450, t - 380],
   ];
   for (const [y0, y1] of slots) {
      c.sections.push({ y0, y1, r: 8 });
      let k = 0;
      for (let y = y1 - 10; y > y0 + 6; y -= 16, k++) blade(c, 0, y, 0, 6.2, k % 2 === 0 ? 1.3 : -1.5, k * 1.9);
      // a ring between each pair of gates, dead centre
      for (let y = y1 - 18; y > y0 + 6; y -= 16) ring(c, 0, y, 0, 2.8);
   }
   // the chambers: rings and orb trails
   const chambers: [number, number][] = [
      [t - 75, t - 12],
      [t - 215, t - 135],
      [t - 375, t - 295],
      [t - 590, t - 455],
   ];
   chambers.forEach(([y0, y1], m) => {
      const n = Math.max(3, Math.floor((y1 - y0) / 16));
      let prev = -1;
      for (let k = 0; k < n; k++) {
         const a = m * 70 + k * 60;
         const y = y1 - 6 - (k * (y1 - y0 - 12)) / Math.max(1, n - 1);
         const rad = k === n - 1 ? 0 : 5;
         const i = ring(c, polarX(a, rad), y, polarZ(a, rad) + (m === 0 && k === 0 ? 6 : 0), 3.6);
         if (prev >= 0) trailBetween(c, prev, i, 1);
         prev = i;
      }
   });
   goldNiche(c, 230, t - 175);
   sealShaft(c, 90, t - 330, true);
   innerShaft(c, 320, t - 470, 60, false);
   stormPocket(c, -7, -6, t - 150, 26);
   wallTrail(c, 150, t - 500);
   ledgeNook(c, 0, t - 360);
   c.pad = { x: 0, z: 0, y: PAD_TOP, r: 3, bull: 0.8 };
   c.pool = { x: -8, z: -9, r: 3.6 };
}

/** L5 Perfect Streak: everything combined, then Cyclone Ray's storm eye, then the final 200 m drop to its tail pad. */
function perfectStreak(c: Draft): void {
   const t = c.top;
   // the opening (moving rings, a geyser, a blade gate pair, speed rings)
   ring(c, 0, t - 16, 12, 4.6);
   for (let k = 0; k < 4; k++) {
      ring(c, 0, t - 32 - k * 16, 4 - k * 2, 4, { motion: slide(3.5, 0.7, k * 0.9) });
      orb(c, 0, t - 40 - k * 16, 3 - k * 2);
   }
   const u = updraft(c, 200, 9, t - 140, t - 100);
   for (let k = 0; k < 4; k++) {
      ring(c, u.x + polarX(k * 90, 2), u.y1 - 4 - k * 9, u.z + polarZ(k * 90, 2), 2.6);
      orb(c, u.x + polarX(k * 90 + 45, 2), u.y1 - 8.5 - k * 9, u.z + polarZ(k * 90 + 45, 2));
   }
   c.sections.push({ y0: t - 200, y1: t - 160, r: 9 });
   blade(c, 0, t - 170, 0, 6.6, 1.2, 0);
   blade(c, 0, t - 188, 0, 6.6, -1.4, 1.7);
   ring(c, 0, t - 179, 0, 2.8);
   for (let k = 0; k < 3; k++) ring(c, 0, t - 215 - k * 18, 0, 3.6, { kind: "speed" });
   orbLine(c, 0, t - 215, 0, 0, t - 260, 0, 2);
   innerShaft(c, 250, t - 30, 90, true);
   stormPocket(c, 9, 6, t - 60, 26);
   sealShaft(c, 60, t - 220);
   ledgeNook(c, 90, t - 120);
   // the storm eye (no course items inside it)
   c.arena = { top: t - 280, stop: 240, speed: 8, floor: 12, diveFloor: 6 };
   // the final drop: rings down to the sea and the tail pad
   for (let k = 0; k < 7; k++) {
      const a = k * 100;
      ring(c, polarX(a, 5), 200 - k * 24, polarZ(a, 5), 3.8);
      orb(c, polarX(a + 50, 3), 188 - k * 24, polarZ(a + 50, 3));
   }
   goldNiche(c, 160, 150);
   wallTrail(c, 330, 120);
   // the tail pad: Cyclone Ray's tail surfaces at the sea (rules TAIL); the Tide Bell column stands in the cove
   c.pad = { x: 0, z: 0, y: 3, r: 3, bull: 1 };
   c.pool = null;
   c.secrets.push({ kind: "landing" });
}

const BUILDERS: Record<LevelId, (c: Draft) => void> = { 1: wideRings, 2: movingRings, 3: updraftRings, 4: fastRoute, 5: perfectStreak };

/** The canyon of a level (pure; the same for every run). */
export function buildCanyon(level: RingLevel = LEVELS[1]): Course {
   const c = draft(level);
   BUILDERS[level.id](c);
   // secrets are pushed by the builders in SECRETS order: gold first, then the hero / landing ones
   c.secrets.sort((a, b) => order(a) - order(b));
   finishDecor(c);
   return c;
}

function order(s: SecretSpot): number {
   return s.kind === "ring" ? 0 : s.kind === "pickup" ? 1 : 2;
}

/** The shaft's radius at height y (the narrowest section that covers it). */
export function shaftRadius(c: Pick<Course, "radius" | "sections">, y: number): number {
   return radiusOf(c, y);
}
