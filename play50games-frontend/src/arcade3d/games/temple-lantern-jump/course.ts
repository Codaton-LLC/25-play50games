// Temple Lantern Jump's courses: pure, deterministic geometry (no React, no three.js). One course per
// level, the same every run (the run's seed only varies decor): a spiral of pads up a round shaft.
//
// - The CLIMB is `chain`: pad ids in climb order, a start deck, then ledges and lanterns on a ring of
//   radius RING, 52 degrees apart, rising a little each step, ending on the goal roof. Lantern
//   counts and the ledges between them come from levels.ts.
// - Glyph ledges are solid only in light; plain ledges and decks always; lanterns are bounce pads
//   (a normal jump x1.4 high), balconies are wood that crumbles on level 3 and up.
// - SIDE things: a gallery (a dark glyph ledge off the ring with a brazier and an orb), a hidden
//   lantern room behind a ghost wall (Vexa's), an express column through a fire jet (level 2 on),
//   spark patches in the soot walls (Zuno), and on level 5 the roof arena of the Soot Bat Queen.
import type { LevelId } from "../../types";
import { LEVELS, type TempleLevel } from "./levels";

export const RING = 3.4;
export const STEP_ANGLE = (52 * Math.PI) / 180;
/** every ledge's landing radius (m); decks and the roof are wider */
export const LEDGE_R = 1.15;
export const DECK_R = 2.3;
export const START_DECK_R = 3.2;
export const LANTERN_PAD_R = 0.8;
export const GALLERY_RING = 8.2;
export const GALLERY_R = 1.3;
export const ROOM_RING = 10.8;
export const ROOM_R = 1.3;
/** the invisible wall: a hero outside the ghost-wall ring turns back unless phasing */
export const WALL_RING = 9.3;
/** nobody walks past this (the shaft's outer rim) */
export const RIM = 12;

export type PadKind = "deck" | "plain" | "glyph" | "lantern" | "balcony" | "gallery" | "express" | "goal";

export interface Pad {
   id: number;
   kind: PadKind;
   x: number;
   /** the top (m): where the feet stand */
   y: number;
   z: number;
   /** landing radius (m) */
   r: number;
   /** position in the climb (-1 for side pads) */
   node: number;
   /** index among the lanterns (-1 when not one) */
   lantern: number;
   /** a swinging lantern's tangent (unit), null when it hangs still */
   swing: { x: number; z: number } | null;
}

export interface Orb {
   x: number;
   y: number;
   z: number;
   /** a gallery orb (the dark side galleries) */
   gallery: boolean;
}

export interface Spark {
   x: number;
   y: number;
   z: number;
}

export interface Brazier {
   x: number;
   y: number;
   z: number;
   /** the pad it stands on */
   pad: number;
}

export interface Jet {
   /** a column on the axis from y0 to y1 */
   y0: number;
   y1: number;
   r: number;
}

export interface Bat {
   /** the circle's height (m) and phase (rad) */
   y: number;
   phase: number;
}

export interface Course {
   level: LevelId;
   cfg: TempleLevel;
   pads: Pad[];
   /** pad ids in climb order: the start deck first, the goal last */
   chain: number[];
   lanterns: number[];
   decks: number[];
   goal: number;
   top: number;
   orbs: Orb[];
   sparks: Spark[];
   braziers: Brazier[];
   galleries: number[];
   /** the hidden lantern room's pad (Vexa's), -1 when none */
   room: number;
   jet: Jet | null;
   express: number[];
   bats: Bat[];
   /** the twin plates of the co-op chandelier (level 1 start deck) */
   plates: { x: number; z: number }[];
   /** level 5: the arena: the lanterns under her perch and the roof brazier */
   arena: number[];
   roofBrazier: { x: number; y: number; z: number } | null;
   /** the Queen's perch (m) */
   perch: { x: number; y: number; z: number };
   /** the golden roof over the arena (level 5): its underside (m), never landed on */
   roofY: number;
}

const cache = new Map<LevelId, Course>();

function addPad(pads: Pad[], kind: PadKind, x: number, y: number, z: number, r: number, node = -1, lantern = -1, swing: Pad["swing"] = null): Pad {
   const pad: Pad = { id: pads.length, kind, x, y, z, r, node, lantern, swing };
   pads.push(pad);
   return pad;
}

/** Builds a level's course. Cached: the same object for the same level. */
export function courseFor(level: LevelId): Course {
   const hit = cache.get(level);
   if (hit) return hit;
   const cfg = LEVELS[level];
   const pads: Pad[] = [];
   const chain: number[] = [];
   const lanterns: number[] = [];
   const decks: number[] = [];

   // the token list: D, then per lantern k ledges and the lantern, then one ledge and the roof
   const tokens: PadKind[] = ["deck"];
   cfg.gaps.forEach((k, i) => {
      for (let j = 0; j < k; j++) {
         if (i < cfg.plainLanterns) tokens.push("plain");
         else if (cfg.gusts && j % 3 === 2) tokens.push("balcony");
         else tokens.push(j % 3 === 2 ? "plain" : "glyph");
      }
      tokens.push("lantern");
   });
   // the roof: a goal pad on levels 1-4; on level 5 the climb ends on the last lantern, under the Queen's roof
   if (!cfg.boss) tokens.push("glyph", "goal");
   // checkpoints: a deck in place of a plain-ish ledge about 40 % and 75 % up (levels 2 on)
   if (level >= 2) {
      for (const f of [0.4, 0.75]) {
         let i = Math.round(f * (tokens.length - 1));
         while (tokens[i] === "lantern" || tokens[i] === "goal" || tokens[i] === "deck") i -= 1;
         tokens[i] = "deck";
      }
   }
   const n = tokens.length;
   const rise = cfg.height / (n - 1);
   let lanternIndex = 0;
   for (let i = 0; i < n; i++) {
      const kind = tokens[i];
      const y = i * rise;
      const angle = Math.PI + i * STEP_ANGLE;
      let pad: Pad;
      if (i === 0) pad = addPad(pads, "deck", 0, 0, 0, START_DECK_R, 0);
      else {
         const x = Math.cos(angle) * RING;
         const z = Math.sin(angle) * RING;
         if (kind === "lantern") {
            const swing = cfg.swing ? { x: -Math.sin(angle), z: Math.cos(angle) } : null;
            pad = addPad(pads, "lantern", x, y, z, LANTERN_PAD_R, i, lanternIndex, swing);
            lanternIndex += 1;
         } else if (kind === "goal") pad = addPad(pads, "goal", x, y, z, DECK_R, i);
         else if (kind === "deck") pad = addPad(pads, "deck", x, y, z, DECK_R, i);
         else pad = addPad(pads, kind, x, y, z, LEDGE_R, i);
      }
      chain.push(pad.id);
      if (pad.kind === "lantern") lanterns.push(pad.id);
      if (pad.kind === "deck") decks.push(pad.id);
   }

   // the side things hang off ledge nodes picked by fraction (never a lantern, a deck or the goal)
   const ledgeNear = (f: number, taken: Set<number>): number => {
      let i = Math.round(f * (n - 1));
      for (let guard = 0; guard < n; guard++) {
         const p = pads[chain[Math.max(1, Math.min(n - 2, i))]];
         if ((p.kind === "glyph" || p.kind === "plain" || p.kind === "balcony") && !taken.has(p.id)) return p.id;
         i += 1;
      }
      return chain[1];
   };
   const taken = new Set<number>();
   const orbs: Orb[] = [];
   const braziers: Brazier[] = [];
   const galleries: number[] = [];
   for (const f of [0.22, 0.46, 0.74]) {
      const p = pads[ledgeNear(f, taken)];
      taken.add(p.id);
      orbs.push({ x: p.x, y: p.y + 1.9, z: p.z, gallery: false });
   }
   for (const f of [0.34, 0.62]) {
      const p = pads[ledgeNear(f, taken)];
      taken.add(p.id);
      const a = Math.atan2(p.z, p.x);
      const g = addPad(pads, "gallery", Math.cos(a) * GALLERY_RING, p.y + 0.25, Math.sin(a) * GALLERY_RING, GALLERY_R);
      galleries.push(g.id);
      braziers.push({ x: g.x + Math.cos(a) * 0.5, y: g.y, z: g.z + Math.sin(a) * 0.5, pad: g.id });
      orbs.push({ x: g.x - Math.cos(a) * 0.3, y: g.y + 1.9, z: g.z - Math.sin(a) * 0.3, gallery: true });
   }
   // Vexa's hidden lantern room behind the ghost wall
   let room = -1;
   {
      const p = pads[ledgeNear(0.54, taken)];
      taken.add(p.id);
      const a = Math.atan2(p.z, p.x);
      room = addPad(pads, "lantern", Math.cos(a) * ROOM_RING, p.y + 0.3, Math.sin(a) * ROOM_RING, ROOM_R * 0.8, -1, -1).id;
      // the gallery next to it is the hero's stepping stone: a second small ledge on the wall line
      const step = addPad(pads, "gallery", Math.cos(a) * (WALL_RING - 1.4), p.y + 0.3, Math.sin(a) * (WALL_RING - 1.4), 1.0);
      galleries.push(step.id);
   }
   // spark patches in the soot walls (Zuno's magnet)
   const sparks: Spark[] = [];
   for (const f of [0.3, 0.52, 0.8]) {
      const i = Math.round(f * (n - 1));
      const a = Math.PI + (i + 0.5) * STEP_ANGLE;
      sparks.push({ x: Math.cos(a) * 5.4, y: i * rise + 1.2, z: Math.sin(a) * 5.4 });
   }
   // the express column through a fire jet (level 2 on)
   let jet: Jet | null = null;
   const express: number[] = [];
   if (cfg.jets) {
      let a = Math.round(0.3 * (n - 1));
      while (pads[chain[a]].kind !== "lantern") a += 1;
      const y0 = pads[chain[a]].y;
      for (let k = 1; k <= 3; k++) express.push(addPad(pads, "express", 0, y0 + 1.25 * k, 0, 1.05).id);
      jet = { y0: y0 + 0.4, y1: y0 + 5, r: 0.95 };
   }
   // soot bats (level 4): circles at the lantern ring, a lantern's height each
   const bats: Bat[] = [];
   for (let b = 0; b < cfg.bats; b++) {
      const lp = pads[lanterns[Math.round(((b + 1) / (cfg.bats + 1)) * (lanterns.length - 1))]];
      bats.push({ y: lp.y + 0.9, phase: b * 2.1 });
   }
   // the chandelier plates (level 1)
   const plates = level === 1 ? [{ x: -2.1, z: 0 }, { x: 2.1, z: 0 }] : [];
   // the Queen's arena: the last four lanterns, the roof brazier on the axis
   const arena = cfg.boss ? lanterns.slice(-4) : [];
   const goal = chain[n - 1];
   const roofBrazier = cfg.boss ? { x: 0, y: cfg.height + 1, z: 0 } : null;
   const course: Course = {
      level, cfg, pads, chain, lanterns, decks, goal, top: cfg.height, orbs, sparks, braziers, galleries, room, jet, express, bats, plates, arena, roofBrazier,
      perch: { x: 0, y: cfg.height + 6, z: 0 }, roofY: cfg.height + 4.5,
   };
   cache.set(level, course);
   return course;
}

/** A swinging lantern's offset along its tangent (m): +-2, period 3 s (level 2). */
export function swingOffset(ms: number, index: number): number {
   return 2 * Math.sin((ms / 3000) * Math.PI * 2 + index * 0.9);
}

/** A pad's x at time ms (swinging lanterns move; everything else stays). */
export function padX(pad: Pad, ms: number): number {
   return pad.swing ? pad.x + pad.swing.x * swingOffset(ms, pad.lantern) : pad.x;
}
export function padZ(pad: Pad, ms: number): number {
   return pad.swing ? pad.z + pad.swing.z * swingOffset(ms, pad.lantern) : pad.z;
}

/** A bat's position on its circle (m) at time ms: radius RING, 9 s a turn, against the climb. */
export function batAt(bat: Bat, ms: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const a = bat.phase - (ms / 9000) * Math.PI * 2;
   out.x = Math.cos(a) * RING;
   out.y = bat.y + 0.4 * Math.sin(ms / 700 + bat.phase);
   out.z = Math.sin(a) * RING;
   return out;
}

/** The jet's cycle: telegraph 800 ms, then on for 1600 ms, every 5000 ms (3500 ms on level 5's second phase). */
export function jetPhase(ms: number, fast: boolean): "off" | "warn" | "on" {
   const period = fast ? 3500 : 5000;
   const t = ms % period;
   if (t >= period - 1600) return "on";
   if (t >= period - 2400) return "warn";
   return "off";
}

/** A gust starts at 5 s and every 9 s after, lasts 1.5 s; leaves drift in 1 s ahead (level 3). */
export const GUST = { first: 5000, every: 9000, lastsMs: 1500, warnMs: 1000 } as const;
export function gustStart(k: number): number {
   return GUST.first + k * GUST.every;
}
