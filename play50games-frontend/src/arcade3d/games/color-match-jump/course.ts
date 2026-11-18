// Color Match Jump's fields (pure, seeded per level, so every player gets the same field): hex cells on
// one lattice, 2.3 m apart in all six directions. L1-L4 are a field of rows running away from the
// camera (-z) to the crown; L5 is a ring around the Echo Frost Golem. Every level also lays the five
// hero routes of the card: Nyla's tall pillar, Kiro's curtained alcove, Riko's dash island, Zuno's
// floating orb trail and Vexa's ghost pillar, each holding an orb ("all orbs" needs every hero).
import { createRng } from "../../core/math";
import type { LevelId } from "../../types";
import { LEVELS, type CmjLevel } from "./levels";

/** Hero colours by index (the hero order): 0 red Riko, 1 blue Nyla, 2 green Kiro, 3 yellow Zuno, 4 purple Vexa. */
export const GREY = 5;
/** The golem's frozen hexes (L5 P1): neutral and slippery. */
export const ICE = 6;
/** Centre spacing of two neighbouring hexes (m). */
export const D = 2.3;
export const ROW_DZ = (D * Math.sqrt(3)) / 2;
const S = Math.sqrt(3) / 2;
/** The six hop directions (x, z), unit length; -z is forward. */
export const DIRS: readonly { x: number; z: number }[] = [
   { x: 1, z: 0 },
   { x: 0.5, z: -S },
   { x: -0.5, z: -S },
   { x: -1, z: 0 },
   { x: -0.5, z: S },
   { x: 0.5, z: S },
];

export interface Cell {
   id: number;
   row: number;
   col: number;
   x: number;
   z: number;
   /** top of the hex (m) */
   h: number;
   /** 0..4 hero colour, GREY neutral */
   colour: number;
   /** Vexa: a ghost pillar stands on it; only a phasing hero passes or lands */
   ghost: boolean;
   /** Kiro: a lightning curtain; only a shielded hero crosses */
   curtain: boolean;
   /** L4: a landing skids */
   glassy: boolean;
   orb: boolean;
   /** Nyla: a 4 m pillar (double jump) */
   tall: boolean;
   /** Riko: across the void (dash) */
   island: boolean;
   crown: boolean;
   /** L5: the golem core this hex feeds (0..2), else -1 */
   core: number;
   /** L5: the hex beside the golem to stomp from */
   stomp: boolean;
   /** the secret this hex holds (index into progression SECRETS), else -1 */
   secret: number;
   /** L3 bob phase (rad) */
   phase: number;
}

export interface FloatOrb {
   x: number;
   y: number;
   z: number;
   /** -1 = an orb (counts for the star); else the secret index (Zuno's magnet shard) */
   secret: number;
}

export interface Course {
   level: CmjLevel;
   seed: number;
   cells: Cell[];
   start: number;
   /** the crown hex (L1-L4), -1 on L5 */
   crown: number;
   /** L5: the stomp hex, else -1 */
   stomp: number;
   /** L5: the three core hexes (index = core), else [] */
   cores: number[];
   floats: FloatOrb[];
   /** orbs that count for the "all orbs" star (cells + floats, secrets excluded) */
   orbTotal: number;
}

/** L5: the golem's three cores and their colours (red, green, purple). */
export const CORE_COLOURS = [0, 2, 4] as const;
export const GOLEM = { x: 0, z: 0, ringIn: 6.6, ringOut: 15.8 } as const;

/** Every hex sits on the lattice: x in half-hex steps (D / 2), z in rows (ROW_DZ); key by those indices. */
export const keyOf = (x: number, z: number): string => `${Math.round(x / (D / 2))},${Math.round(z / ROW_DZ)}`;

export function cellAt(course: Course, index: Map<string, number>, x: number, z: number): Cell | undefined {
   const id = index.get(keyOf(x, z));
   return id === undefined ? undefined : course.cells[id];
}

/** The lookup map of a course (built once per run). */
export function indexCourse(course: Course): Map<string, number> {
   const m = new Map<string, number>();
   for (const c of course.cells) m.set(keyOf(c.x, c.z), c.id);
   return m;
}

const posX = (row: number, col: number, width: number) => (col - (width - 1) / 2 + (row & 1 ? 0.5 : 0)) * D;

function blank(row: number, col: number, x: number, h: number, colour: number): Omit<Cell, "id"> {
   return { row, col, x, z: -row * ROW_DZ, h, colour, ghost: false, curtain: false, glassy: false, orb: false, tall: false, island: false, crown: false, core: -1, stomp: false, secret: -1, phase: 0 };
}

const cache = new Map<LevelId, Course>();

export function courseFor(level: LevelId): Course {
   let c = cache.get(level);
   if (!c) {
      c = buildCourse(level);
      cache.set(level, c);
   }
   return c;
}

export function buildCourse(level: LevelId): Course {
   return LEVELS[level].boss ? buildRing(LEVELS[level]) : buildField(LEVELS[level]);
}

function finish(l: CmjLevel, seed: number, raw: Omit<Cell, "id">[], floats: FloatOrb[], start: number, crown: number, stomp: number, cores: number[]): Course {
   const cells = raw.map((c, id) => ({ ...c, id }));
   const orbTotal = cells.filter((c) => c.orb).length + floats.filter((f) => f.secret < 0).length;
   return { level: l, seed, cells, start, crown, stomp, cores, floats, orbTotal };
}

function buildField(l: CmjLevel): Course {
   const seed = 9100 + l.id * 31;
   const rng = createRng(seed);
   const W = l.width;
   const R = l.rows;
   const mid = Math.floor(W / 2);
   const heights = l.bob > 0 ? [0, 0.4] : [0, 0.5, 1.0];
   const pick = () => l.palette[Math.floor(rng() * l.palette.length)];
   const raw: Omit<Cell, "id">[] = [];
   const at = new Map<string, number>();
   const put = (row: number, col: number, colour: number, h?: number) => {
      const c = blank(row, col, posX(row, col, W), h ?? heights[Math.floor(rng() * heights.length)], colour);
      c.phase = rng() * Math.PI * 2;
      at.set(`${row}:${col}`, raw.length);
      raw.push(c);
      return c;
   };
   // the field
   for (let row = 0; row < R; row++) {
      for (let col = 0; col < W; col++) {
         if (row === 0) {
            put(row, col, GREY, 0);
            continue;
         }
         if (l.id === 1) {
            // the card's three beats: a row of red hexes, one blue hex ahead, then alternating R/B
            // stepping stones over a short void (tag on every jump)
            if (row <= 3) { put(row, col, 0); continue; }
            if (row === 4) { put(row, col, col === mid ? 1 : 0); continue; }
            if (row === 5) { put(row, col, rng() < 0.5 ? 0 : 1); continue; }
            if (row >= 6 && row <= 9) {
               if (col === mid) put(row, col, row % 2 === 0 ? 1 : 0, 0.5);
               continue;
            }
         }
         const grey = rng() < 0.12;
         const c = put(row, col, grey ? GREY : pick());
         if (!grey && l.glassy > 0 && rng() < l.glassy) c.glassy = true;
      }
   }
   // easy orbs on the field: one every few rows, never on the first rows
   for (let row = 3; row < R - 1; row += 4) {
      const id = at.get(`${row}:${Math.floor(rng() * W)}`);
      if (id !== undefined) raw[id].orb = true;
   }
   const crownCell = blank(R, mid, posX(R, mid, W), 0.5, GREY);
   crownCell.crown = true;
   raw.push(crownCell);
   const crown = raw.length - 1;
   // the hero routes: feature rows (L1 keeps them off the stepping stones)
   const f = (t: number) => Math.min(R - 3, Math.max(2, Math.round(R * t)));
   const rows = l.id === 1 ? { tall: 4, alcove: 11, island: 12, floats: 13, ghost: 14, extra: 10 } : { tall: f(0.3), alcove: f(0.45), island: f(0.55), floats: f(0.68), ghost: f(0.8), extra: f(0.6) };
   const tall = put(rows.tall, W, GREY, 4);
   tall.tall = true;
   tall.orb = true;
   const alcove = put(rows.alcove, -1, GREY, 0.5);
   alcove.curtain = true;
   alcove.orb = true;
   put(rows.island, W + 2, GREY, 0.5).island = true;
   const isle = put(rows.island, W + 3, GREY, 0.5);
   isle.island = true;
   isle.orb = true;
   const ghostId = at.get(`${rows.ghost}:${mid}`);
   if (ghostId !== undefined) {
      raw[ghostId].ghost = true;
      raw[ghostId].orb = true;
      raw[ghostId].colour = GREY;
   }
   const floats: FloatOrb[] = [];
   for (let k = 0; k < 4; k++) {
      const row = rows.floats + k;
      floats.push({ x: posX(row, 0, W) - 5, y: 1.6, z: -row * ROW_DZ, secret: -1 });
   }
   // the level's secret (progression.ts SECRETS index 0)
   if (l.id === 1) {
      const s = put(rows.extra, W, GREY, 4);
      s.tall = true;
      s.secret = 0;
   } else if (l.id === 2) {
      const id = at.get(`${rows.extra}:1`);
      if (id !== undefined) Object.assign(raw[id], { ghost: true, colour: GREY, secret: 0, orb: false });
   } else if (l.id === 3) {
      const s = put(rows.island, W + 6, GREY, 0.5);
      s.island = true;
      s.secret = 0;
   }
   // L4's secret is a rule (a code cracked in under 4 s)
   return finish(l, seed, raw, floats, at.get(`0:${mid}`)!, crown, -1, []);
}

function nearest(raw: Omit<Cell, "id">[], x: number, z: number, ok: (c: Omit<Cell, "id">) => boolean = () => true): number {
   let best = -1;
   let bd = Infinity;
   raw.forEach((c, i) => {
      if (!ok(c)) return;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bd) {
         bd = d;
         best = i;
      }
   });
   return best;
}

function buildRing(l: CmjLevel): Course {
   const seed = 9100 + l.id * 31;
   const rng = createRng(seed);
   const raw: Omit<Cell, "id">[] = [];
   const pick = () => l.palette[Math.floor(rng() * l.palette.length)];
   for (let row = -9; row <= 9; row++) {
      for (let col = -9; col <= 9; col++) {
         const x = (col + (row & 1 ? 0.5 : 0)) * D;
         const z = -row * ROW_DZ;
         const r = Math.hypot(x, z);
         if (r < GOLEM.ringIn || r > GOLEM.ringOut) continue;
         const c = blank(row, col, x, rng() < 0.5 ? 0 : 0.5, rng() < 0.1 ? GREY : pick());
         raw.push(c);
      }
   }
   const plain = (c: Omit<Cell, "id">) => !c.tall && !c.curtain && !c.ghost && c.core < 0 && !c.stomp;
   const start = nearest(raw, 0, 14);
   Object.assign(raw[start], { colour: GREY, h: 0 });
   const stomp = nearest(raw, 0, 7.6);
   Object.assign(raw[stomp], { colour: GREY, stomp: true, h: 0 });
   const cores = [-4.6, 0, 4.6].map((x, i) => {
      const id = nearest(raw, x, -8.2, plain);
      Object.assign(raw[id], { core: i, colour: CORE_COLOURS[i], h: 0.5 });
      return id;
   });
   const tall = nearest(raw, -12, 6, plain);
   Object.assign(raw[tall], { tall: true, orb: true, colour: GREY, h: 4 });
   const alcove = nearest(raw, 12, 6, plain);
   Object.assign(raw[alcove], { curtain: true, orb: true, colour: GREY });
   const ghost = nearest(raw, -7, -9, plain);
   Object.assign(raw[ghost], { ghost: true, orb: true, colour: GREY });
   // Riko: an island three hexes east of the ring's east edge on row 0
   let east = -1;
   raw.forEach((c, i) => {
      if (c.row === 0 && (east < 0 || c.x > raw[east].x)) east = i;
   });
   const e = raw[east];
   const isleA = blank(0, e.col + 3, e.x + 3 * D, 0.5, GREY);
   isleA.island = true;
   const isleB = blank(0, e.col + 4, e.x + 4 * D, 0.5, GREY);
   isleB.island = true;
   isleB.orb = true;
   raw.push(isleA, isleB);
   const floats: FloatOrb[] = [-3, -1, 1, 3].map((x) => ({ x, y: 1.8, z: 19, secret: -1 }));
   floats.push({ x: 0, y: 2.2, z: -19.6, secret: 0 });
   return finish(l, seed, raw, floats, start, -1, stomp, cores);
}
