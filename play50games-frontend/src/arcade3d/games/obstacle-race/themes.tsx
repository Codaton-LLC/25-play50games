// Obstacle Race level themes (README "Levels", docs/master-plan game 10): each level's look —
// palette overrides over the level-1 base colors, lane-rope colors, and the static decor set
// pieces that give the level its own scenery (layout of props, never course geometry). Pure data
// plus the React context that hands the active theme to the look (Primitives.tsx, Decor.tsx);
// the rules never read any of this. Level 1's theme is empty: resolveColors(LEVEL_THEMES[1])
// returns the base colors bit for bit, so level 1 draws exactly as before (themes.test.ts).
//
// Every decor spot must stay out of the play area (themes.test.ts proves it per level with
// playAreaClear): the runner's circle never gets further from x = 0 than KNOCK_STOP_X + its
// radius (6.7 m), so a spot that intersects the corridor |x| <= PLAY_HALF_X along the course
// (p from PLAY_P_MIN to the finish line + PLAY_P_PAST) may only hang overhead, at OVERHEAD_Y or
// higher — a jump's feet peak at 1.445 over the 1.5 m platforms (2.95 m).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { LevelId } from "@/arcade3d/types";
import type { Course } from "./rules";

// ---------- the base palette (level 1, today's game; moved here from Primitives.tsx) ----------

export const BASE_COLORS = {
   sky: "#bae6fd",
   water: "#38bdf8",
   waterTint: "#ffffff",
   deck: "#e2e8f0",
   coping: "#f8fafc",
   padSide: "#3b82f6",
   padTop: "#e0f2fe",
   checkpointTop: "#c7d2fe",
   finishTop: "#bbf7d0",
   rim: "#fbbf24",
   discSide: "#ef4444",
   discStripeA: "#fff1f2",
   discStripeB: "#fecaca",
   hub: "#facc15",
   hubCap: "#f97316",
   barRed: "#ef4444",
   barWhite: "#ffffff",
   slab: "#16a34a",
   cushion: "#86efac",
   pillar: "#e2e8f0",
   block: "#f59e0b",
   blockTop: "#fcd34d",
   rail: "#94a3b8",
   beam: "#a855f7",
   beamTop: "#c4b5fd",
   line: "#ffffff",
   accent: "#6366f1",
   reached: "#22c55e",
   post: "#f8fafc",
   archLeg: "#ef4444",
   archTop: "#facc15",
   ropeA: "#ef4444",
   ropeB: "#ffffff",
   ropeC: "#2563eb",
   splash: "#e0f2fe",
   hoodie: "#f97316",
   hood: "#ea580c",
   pants: "#1e293b",
   shoes: "#f8fafc",
   skin: "#f5c9a3",
   hair: "#3f2a1d",
   band: "#14b8a6",
   pack: "#1d4ed8",
   eye: "#0f172a",
} as const;

export type CourseColors = { [K in keyof typeof BASE_COLORS]: string };
export type ColorKey = keyof CourseColors;

/** One level's look: palette overrides over BASE_COLORS and the lane-rope colors. */
export interface LevelTheme {
   /** palette overrides (level 1: none) */
   readonly tint: Partial<Record<ColorKey, string>>;
   /** the two lane ropes' float colors (pairs repeating: A A B B C C) */
   readonly rope: [string, string, string];
}

/**
 * The five levels' themes, matching the level names (meta.ts titles). Level 1 "Training Course"
 * is today's sunny pool, empty. Level 2 "Moving Blocks" is a container-yard build: teal container
 * blocks, amber rails, tower cranes and warning beacons. Level 3 "Bridge Run" is a wooden harbor
 * crossing: deck-toned pads, pilings and rope rails along the whole course, two overhead rope
 * bridges. Level 4 "Spinner Arena" is a night stadium: neon rails, floodlight pylons and a dark
 * crowd. Level 5 "Championship Course" is the sunset final: crimson and gold, bunting, a podium
 * with a trophy, and crowds.
 */
export const LEVEL_THEMES: Record<LevelId, LevelTheme> = {
   1: { tint: {}, rope: [BASE_COLORS.ropeA, BASE_COLORS.ropeB, BASE_COLORS.ropeC] },
   2: {
      tint: { block: "#0d9488", blockTop: "#5eead4", rail: "#f59e0b", padSide: "#2563eb" },
      rope: ["#f59e0b", "#f8fafc", "#0d9488"],
   },
   3: {
      tint: {
         padSide: "#a16207",
         padTop: "#ecd9b0",
         rim: "#92400e",
         slab: "#b45309",
         cushion: "#e8b06c",
         pillar: "#d6b48a",
         beam: "#a16207",
         beamTop: "#ca8a04",
         rail: "#b45309",
         waterTint: "#fef3c7",
      },
      rope: ["#b45309", "#ecd9b0", "#a16207"],
   },
   4: {
      tint: {
         padSide: "#1e40af",
         padTop: "#bfdbfe",
         rim: "#facc15",
         discSide: "#7f1d1d",
         hub: "#eab308",
         slab: "#0f766e",
         cushion: "#5eead4",
         pillar: "#94a3b8",
         block: "#c2410c",
         blockTop: "#fb923c",
         rail: "#67e8f9",
         beam: "#7c3aed",
         beamTop: "#a78bfa",
         accent: "#22d3ee",
         waterTint: "#93c5fd",
      },
      rope: ["#22d3ee", "#f8fafc", "#facc15"],
   },
   5: {
      tint: {
         padSide: "#be123c",
         padTop: "#fef3c7",
         checkpointTop: "#ddd6fe",
         rim: "#f59e0b",
         discSide: "#9f1239",
         hub: "#fbbf24",
         slab: "#d97706",
         cushion: "#fbbf24",
         pillar: "#fca5a5",
         block: "#c0262c",
         blockTop: "#fda4af",
         rail: "#fbbf24",
         beam: "#6d28d9",
         beamTop: "#c4b5fd",
         accent: "#f59e0b",
         waterTint: "#fed7aa",
      },
      rope: ["#f59e0b", "#fef3c7", "#be123c"],
   },
};

/** The active level's full palette: the base colors with the theme's overrides applied. */
export function resolveColors(theme: LevelTheme): CourseColors {
   return { ...BASE_COLORS, ...theme.tint };
}

// ---------- the theme context ----------

const ThemeContext = createContext<LevelTheme>(LEVEL_THEMES[1]);

export function ThemeProvider({ level, children }: { level: LevelId; children: ReactNode }) {
   return <ThemeContext.Provider value={LEVEL_THEMES[level]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): LevelTheme {
   return useContext(ThemeContext);
}

/** The resolved palette of the active level (level 1 = BASE_COLORS, bit for bit). */
export function useColors(): CourseColors {
   const theme = useContext(ThemeContext);
   return useMemo(() => resolveColors(theme), [theme]);
}

// ---------- decor set pieces (pure data; Decor.tsx draws it, themes.test.ts proves it safe) ----------

/** An axis-aligned box (a static prop). x/z is the centre, y the centre height. */
export interface DecorBox {
   readonly x: number;
   readonly y: number;
   readonly z: number;
   readonly sx: number;
   readonly sy: number;
   readonly sz: number;
   readonly rotY?: number;
   readonly color: string;
}

/** An upright cylinder (a static prop). x/z is the centre, y the BASE (bottom). */
export interface DecorCyl {
   readonly x: number;
   readonly y: number;
   readonly z: number;
   readonly r: number;
   readonly h: number;
   readonly color: string;
}

/** A translucent light cone. x/y/z is the APEX, the cone opens downwards, tilted by rotZ. */
export interface DecorCone {
   readonly x: number;
   readonly y: number;
   readonly z: number;
   readonly r: number;
   readonly h: number;
   readonly rotZ: number;
   readonly color: string;
   readonly opacity: number;
}

/** A small hanging triangle (pennant / flag): x/z the top edge centre, y the top edge. */
export interface DecorTri {
   readonly x: number;
   readonly y: number;
   readonly z: number;
   readonly color: string;
}

/** A rail beacon (level 2): floats at (x, −p); its light flashes with block `block`'s position. */
export interface DecorBeacon {
   readonly x: number;
   readonly p: number;
   readonly block: number;
}

/** One level's static decor and its dynamic pieces' placements. Level 1: all empty. */
export interface LevelDecorData {
   readonly boxes: readonly DecorBox[];
   readonly cylinders: readonly DecorCyl[];
   readonly cones: readonly DecorCone[];
   readonly tris: readonly DecorTri[];
   readonly beacons: readonly DecorBeacon[];
   /** floodlight apexes whose cones sweep with the bar (level 4) */
   readonly sweepers: readonly { x: number; y: number; z: number; side: 1 | -1 }[];
}

const NO_DECOR: LevelDecorData = { boxes: [], cylinders: [], cones: [], tris: [], beacons: [], sweepers: [] };

/** The pool geometry (Primitives.tsx): decks hold bank-side props, the water holds floats. */
const DECK_X = 24;
const DECK_TOP = -1;
const WATER_PROPS_Y = -2.4;

/** A p-helper: world z from course progress p. */
const at = (p: number): number => -p;

function constructionDecor(course: Course): LevelDecorData {
   const boxes: DecorBox[] = [];
   const cylinders: DecorCyl[] = [];
   const beacons: DecorBeacon[] = [];
   const blocks = course.supports.filter((s) => s.kind === "block");
   const blockMidP = (blocks[0].minP + blocks[blocks.length - 1].maxP) / 2;
   // two tower cranes on the decks flanking the block section
   for (const side of [-1, 1] as const) {
      const cx = side * 30;
      const z = at(blockMidP + side * 6);
      boxes.push(
         { x: cx, y: DECK_TOP + 0.5, z, sx: 3.2, sy: 1, sz: 3.2, color: "#475569" },
         { x: cx, y: DECK_TOP + 8.5, z, sx: 0.9, sy: 16, sz: 0.9, color: "#f59e0b" },
         { x: side * 23.6, y: DECK_TOP + 15.4, z, sx: 13.6, sy: 0.7, sz: 0.9, color: "#fbbf24" },
         { x: side * 32.4, y: DECK_TOP + 15.4, z, sx: 4.4, sy: 0.7, sz: 0.9, color: "#fbbf24" },
         { x: side * 33.8, y: DECK_TOP + 14.4, z, sx: 1.6, sy: 1.8, sz: 1.4, color: "#334155" },
         { x: side * 29.2, y: DECK_TOP + 14.2, z: z + 0.8, sx: 1.5, sy: 1.3, sz: 1.3, color: "#e2e8f0" },
         { x: side * 17.6, y: DECK_TOP + 11.2, z, sx: 0.5, sy: 0.5, sz: 0.5, color: "#334155" },
      );
      cylinders.push({ x: side * 17.6, y: DECK_TOP + 11.4, z, r: 0.04, h: 3.9, color: "#334155" });
   }
   // container stacks on both decks along the blocks
   const containerColors = ["#0ea5e9", "#f97316", "#64748b", "#14b8a6", "#eab308"];
   for (const side of [-1, 1] as const) {
      let k = 0;
      for (let p = blocks[0].minP - 8; p < blocks[blocks.length - 1].maxP + 8; p += 7.5) {
         const stack = 1 + ((k * 2 + (side > 0 ? 1 : 0)) % 3);
         const x = side * (26.4 + (k % 2) * 5.4);
         for (let s = 0; s < stack; s++) {
            boxes.push({ x, y: DECK_TOP + 1.15 + s * 2.3, z: at(p), sx: 5.6, sy: 2.3, sz: 2.2, color: containerColors[(k + s) % containerColors.length] });
         }
         k++;
      }
   }
   // warning floats down both sides of the whole course
   for (const side of [-1, 1] as const) {
      for (let p = -2; p < course.finish.line + 8; p += 10) {
         cylinders.push({ x: side * 8.6, y: WATER_PROPS_Y, z: at(p), r: 0.3, h: 1, color: "#f97316" });
         cylinders.push({ x: side * 8.6, y: WATER_PROPS_Y + 1, z: at(p), r: 0.14, h: 0.4, color: "#f8fafc" });
      }
   }
   // a rail beacon per block row per side (the twist: the beacons telegraph each block's slide)
   for (const s of blocks) {
      const p = (s.minP + s.maxP) / 2;
      for (const side of [-1, 1] as const) {
         cylinders.push({ x: side * 8.2, y: WATER_PROPS_Y, z: at(p), r: 0.09, h: 1.5, color: "#334155" });
         beacons.push({ x: side * 8.2, p, block: s.block });
      }
   }
   return { ...NO_DECOR, boxes, cylinders, beacons };
}

function bridgeDecor(course: Course): LevelDecorData {
   const boxes: DecorBox[] = [];
   const cylinders: DecorCyl[] = [];
   const tris: DecorTri[] = [];
   const end = course.finish.line + 6;
   // pilings with rope rails line both sides of the course for its whole length
   const flagColors = ["#fbbf24", "#ef4444", "#f8fafc"];
   for (const side of [-1, 1] as const) {
      for (const x of [9.6, 12.6]) {
         let k = 0;
         for (let p = -2; p < end; p += 8) {
            cylinders.push({ x: side * x, y: WATER_PROPS_Y, z: at(p), r: 0.34, h: 3.6, color: "#7c4a21" });
            boxes.push({ x: side * x, y: 1.29, z: at(p), sx: 0.95, sy: 0.18, sz: 0.95, color: "#a16207" });
            if (x < 10 && k % 2 === 0) tris.push({ x: side * x, y: 1.75, z: at(p), color: flagColors[k % flagColors.length] });
            k++;
         }
         boxes.push({ x: side * x, y: x < 10 ? 1.05 : 0.85, z: at(end / 2 - 1), sx: 0.07, sy: 0.07, sz: end + 2, color: "#b45309" });
      }
   }
   // two overhead rope bridges the runner passes under (at the CP2 and CP3 pads' middles)
   for (const cp of course.checkpoints.slice(2)) {
      const pad = course.supports[cp.support];
      const p = (pad.minP + pad.maxP) / 2;
      const z = at(p);
      boxes.push(
         { x: 0, y: 3.62, z, sx: 26, sy: 0.14, sz: 1.3, color: "#8b5a2b" },
         { x: 0, y: 4.3, z: z - 0.6, sx: 26, sy: 0.06, sz: 0.06, color: "#b45309" },
         { x: 0, y: 4.3, z: z + 0.6, sx: 26, sy: 0.06, sz: 0.06, color: "#b45309" },
      );
      for (let x = -12; x <= 12; x += 4) {
         for (const dz of [-0.6, 0.6]) {
            cylinders.push({ x, y: 3.66, z: z + dz, r: 0.05, h: 0.64, color: "#a16207" });
         }
      }
   }
   return { ...NO_DECOR, boxes, cylinders, tris };
}

function arenaDecor(course: Course): LevelDecorData {
   const boxes: DecorBox[] = [];
   const cylinders: DecorCyl[] = [];
   const cones: DecorCone[] = [];
   const sweepers: Array<{ x: number; y: number; z: number; side: 1 | -1 }> = [];
   // floodlight pylons on the decks around the sweeper disc
   for (const side of [-1, 1] as const) {
      for (const p of [4, 32]) {
         const z = at(p);
         cylinders.push({ x: side * 26, y: DECK_TOP, z, r: 0.32, h: 13.5, color: "#334155" });
         boxes.push(
            { x: side * 26, y: 12.9, z, sx: 1.9, sy: 1.1, sz: 0.8, rotY: side > 0 ? -0.3 : 0.3, color: "#e2e8f0" },
            { x: side * 26, y: 12.9, z: z + side * -0.45, sx: 1.6, sy: 0.85, sz: 0.1, rotY: side > 0 ? -0.3 : 0.3, color: "#f8fafc" },
         );
         cones.push({ x: side * 26, y: 12.4, z, r: 4.4, h: 13.2, rotZ: -side * 0.72, color: "#93c5fd", opacity: 0.1 });
      }
      // a crowd on a dark bleacher along the deck by the disc
      boxes.push({ x: side * 29.5, y: DECK_TOP + 0.5, z: at(18), sx: 10, sy: 1, sz: 46, color: "#1e293b" });
      const crowdColors = ["#334155", "#0f172a", "#475569", "#1e293b", "#f472b6", "#22d3ee", "#facc15"];
      let k = 0;
      for (let x = 25.8; x <= 33.4; x += 1.25) {
         for (let p = -3; p <= 39; p += 1.55) {
            boxes.push({ x: side * x, y: DECK_TOP + 1.33, z: at(p), sx: 0.55, sy: 0.65, sz: 0.45, color: crowdColors[(k * 7 + Math.round(p * 3)) % crowdColors.length] });
            k++;
         }
      }
      // striped buoys flanking the sweeper disc
      let b = 0;
      for (let p = 10; p <= 26; p += 3.2) {
         cylinders.push({ x: side * 8.6, y: WATER_PROPS_Y, z: at(p), r: 0.28, h: 0.85, color: b % 2 === 0 ? "#f97316" : "#f8fafc" });
         b++;
      }
   }
   // two sweeping cones from the near pylons track the bar (the twist)
   for (const side of [-1, 1] as const) {
      sweepers.push({ x: side * 26, y: 12.4, z: at(4), side });
   }
   return { ...NO_DECOR, boxes, cylinders, cones, sweepers };
}

function championshipDecor(course: Course): LevelDecorData {
   const boxes: DecorBox[] = [];
   const cylinders: DecorCyl[] = [];
   const tris: DecorTri[] = [];
   const line = course.finish.line;
   const end = line + 6;
   // bunting strings across the course at the start, the three gates and the finish
   const pennantColors = ["#f59e0b", "#ef4444", "#f8fafc"];
   const strings = [2, ...course.checkpoints.slice(1).map((c) => c.line + 1), line - 4];
   for (const p of strings) {
      const z = at(p);
      for (const side of [-1, 1] as const) {
         cylinders.push({ x: side * 8.4, y: 0, z, r: 0.12, h: 4.5, color: "#f8fafc" });
      }
      for (const [x, y] of [[-5.6, 4.32], [0, 4.06], [5.6, 4.32]] as const) {
         boxes.push({ x, y, z, sx: 5.75, sy: 0.04, sz: 0.04, color: "#f8fafc" });
      }
      for (let x = -7.8; x <= 7.8; x += 1.3) {
         const sag = 4.3 - 0.26 * (1 - Math.abs(x) / 8.4);
         tris.push({ x, y: sag, z, color: pennantColors[Math.abs(Math.round(x * 10)) % pennantColors.length] });
      }
   }
   // a raft with the winners' podium and a trophy beside the finish pad
   const raftP = line + 4;
   const raftZ = at(raftP);
   boxes.push(
      { x: 10.8, y: -0.55, z: raftZ, sx: 5, sy: 0.6, sz: 4.4, color: "#8b5a2b" },
      { x: 10.8, y: 0.32, z: raftZ, sx: 0.95, sy: 0.55, sz: 0.95, color: "#cbd5e1" },
      { x: 11.9, y: 0.52, z: raftZ, sx: 0.95, sy: 0.95, sz: 0.95, color: "#facc15" },
      { x: 9.7, y: 0.42, z: raftZ, sx: 0.95, sy: 0.75, sz: 0.95, color: "#e2e8f0" },
   );
   cylinders.push({ x: 11.9, y: 1, z: raftZ, r: 0.1, h: 0.35, color: "#fbbf24" });
   boxes.push({ x: 11.9, y: 1.5, z: raftZ, sx: 0.34, sy: 0.34, sz: 0.34, color: "#fbbf24" });
   // crowds on both decks for the whole course
   for (const side of [-1, 1] as const) {
      boxes.push({ x: side * 29.5, y: DECK_TOP + 0.6, z: at(end / 2), sx: 10, sy: 1.2, sz: end + 8, color: "#4c1d95" });
      const crowdColors = ["#3b2244", "#4a2b3a", "#2a1b33", "#5a3246", "#fbbf24", "#fef3c7"];
      let k = 0;
      for (let x = 25.8; x <= 33.4; x += 1.25) {
         for (let p = -3; p <= end; p += 1.6) {
            boxes.push({ x: side * x, y: DECK_TOP + 1.53, z: at(p), sx: 0.55, sy: 0.65, sz: 0.45, color: crowdColors[(k * 5 + Math.round(p * 2)) % crowdColors.length] });
            k++;
         }
      }
   }
   return { ...NO_DECOR, boxes, cylinders, tris };
}

/** One level's decor set pieces, placed from its course (never inside the play area). */
export function decorOf(level: LevelId, course: Course): LevelDecorData {
   switch (level) {
      case 1:
         return NO_DECOR;
      case 2:
         return constructionDecor(course);
      case 3:
         return bridgeDecor(course);
      case 4:
         return arenaDecor(course);
      case 5:
         return championshipDecor(course);
   }
}

// ---------- the play-area rule (themes.test.ts proves every spot obeys it) ----------

/** The runner's circle never reaches further from x = 0 than this (m). */
export const PLAY_HALF_X = 7.5;
/** The corridor's p range: a little behind the start pad to a little past the finish pad. */
export const PLAY_P_MIN = -6;
export const PLAY_P_PAST = 10;
/**
 * A prop over the corridor must hang at least this high (m): a jump's feet peak at 1.445 over
 * the tallest (1.5 m) platforms.
 */
export const OVERHEAD_Y = 3.2;

/**
 * Does a decor footprint stay out of the play area? Anything intersecting the corridor
 * |x| <= PLAY_HALF_X, PLAY_P_MIN..finish.line + PLAY_P_PAST must hang entirely at OVERHEAD_Y
 * or higher; outside the corridor a prop may sit anywhere (the pool/decks are scenery space).
 */
export function playAreaClear(
   spot: { minX: number; maxX: number; minP: number; maxP: number; bottom: number },
   course: Course,
): boolean {
   const ox = Math.min(spot.maxX, PLAY_HALF_X) - Math.max(spot.minX, -PLAY_HALF_X);
   const op = Math.min(spot.maxP, course.finish.line + PLAY_P_PAST) - Math.max(spot.minP, PLAY_P_MIN);
   if (ox <= 0 || op <= 0) return true;
   return spot.bottom >= OVERHEAD_Y;
}

/** The rule applied to each spot kind (a cylinder is its bounding square, a tri a thin plane). */
export function decorSpotClear(
   spot: DecorBox | DecorCyl | DecorCone | DecorTri,
   course: Course,
): boolean {
   if ("sx" in spot) {
      const c = Math.abs(Math.cos(spot.rotY ?? 0));
      const s = Math.abs(Math.sin(spot.rotY ?? 0));
      const ex = (c * spot.sx + s * spot.sz) / 2;
      const ep = (s * spot.sx + c * spot.sz) / 2;
      return playAreaClear({ minX: spot.x - ex, maxX: spot.x + ex, minP: -spot.z - ep, maxP: -spot.z + ep, bottom: spot.y - spot.sy / 2 }, course);
   }
   if ("r" in spot) {
      if ("rotZ" in spot) {
         // a cone: it opens downward from its apex and its base swings by h·sin(rotZ)
         const swing = spot.h * Math.sin(Math.abs(spot.rotZ));
         const baseX = spot.x - Math.sign(spot.rotZ) * swing;
         return playAreaClear({ minX: Math.min(spot.x, baseX) - spot.r, maxX: Math.max(spot.x, baseX) + spot.r, minP: -spot.z - spot.r, maxP: -spot.z + spot.r, bottom: spot.y - spot.h }, course);
      }
      // a cylinder: y is its base
      return playAreaClear({ minX: spot.x - spot.r, maxX: spot.x + spot.r, minP: -spot.z - spot.r, maxP: -spot.z + spot.r, bottom: spot.y }, course);
   }
   // a pennant: a thin hanging plane
   return playAreaClear({ minX: spot.x - 0.16, maxX: spot.x + 0.16, minP: -spot.z - 0.03, maxP: -spot.z + 0.03, bottom: spot.y - 0.42 }, course);
}
