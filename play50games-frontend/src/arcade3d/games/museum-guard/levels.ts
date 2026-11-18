// Museum Guard's five levels: pure data, no React (docs/arcade-levels.md §6.3, core/README.md "Levels").
// Each level has its own wing look (palette, wall murals, floor medallion, ceiling architecture,
// GLB prop layout and code-built set pieces) and its own gameplay twist (except Level 1, which is
// today's Main Hall unchanged).
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import type { LevelId } from "@/arcade3d/types";
import { SARCOPHAGUS_SPOTS } from "./assets";
import { COLORS } from "./looks";

export type WingTheme = "main-hall" | "ancient-wing" | "art-wing" | "science-wing" | "full-night";
export type LevelTwist = "none" | "cordon" | "paired" | "randomized" | "full-night";
export type WingSetPiece = "rotunda" | "obelisks" | "vitrines" | "orrery" | "vault-lasers";

export interface WingPalette {
   wallTop: string;
   wallMid: string;
   wallLow: string;
   wallPanel: string;
   trim: string;
   trimDark: string;
   floorCore: string;
   floorMid: string;
   floorEdge: string;
   ceiling: string;
   skylight: string;
   sconce: string;
   lampGlow: string;
   velvet: string;
   brass: string;
   plinth: string;
   column: string;
   cap: string;
   vase: string;
   beam: string;
}

export interface WingDecor {
   setPiece: WingSetPiece;
   /** Low inner-ring or outer-alcove bench spots. */
   benchSpots: readonly InstanceSpot[];
   /** Outer perimeter decorative urns/amphorae (r >= 6.65). */
   vaseSpots: readonly InstanceSpot[];
   /** Outer perimeter sarcophagus displays (r = 7.2, tangential). */
   sarcophagusSpots: readonly InstanceSpot[];
   /** Outer perimeter marble busts atop plinths (r >= 7.05, y = 0.84). */
   bustSpots: readonly InstanceSpot[];
   /** Outer perimeter treasure/relic chests (r >= 7.05, facing centre). */
   chestSpots: readonly InstanceSpot[];
   /** Outer perimeter science rockets (r >= 7.08). */
   rocketSpots: readonly InstanceSpot[];
   /** Outer perimeter glowing specimen pods (r >= 7.02). */
   glowPodSpots: readonly InstanceSpot[];
   /** Outer perimeter historical cannons (r >= 7.12, tangential). */
   cannonSpots: readonly InstanceSpot[];
   /** Angles for architectural set pieces in the outer perimeter (r >= 6.85). */
   setPieceAngles: readonly number[];
}

export interface MuseumLevel {
   /** wing visual identity */
   wing: WingTheme;
   /** per-level gameplay mechanic twist (level 1 is "none") */
   twist: LevelTwist;
   /** phase i is active until this many seconds; the last equals dawn */
   ends: readonly [number, number, number];
   /** the run is won at this second if an alarm remains */
   dawn: number;
   /** multiplier on every statue's speed, per phase */
   speed: readonly [number, number, number];
   /** sneaking at once, per phase (frozen and returning do not count) */
   cap: readonly [number, number, number];
   /** departures, per phase */
   starts: readonly [number, number, number];
   /** seconds between departures, per phase */
   gap: readonly [number, number, number];
   /** no departure before this second */
   first: number;
   /** beam half-angle in degrees, per phase (coarse still ×1.2, clamped at 17) */
   beam: readonly [number, number, number];
   /** knight, robot, penguin, dino. Always eight, so the ring and the radar stay put. */
   roster: readonly [number, number, number, number];
   /** per-wing colour palette */
   palette: WingPalette;
   /** per-wing 3D prop layout and architectural set pieces */
   decor: WingDecor;
}

function ringSpots(angles: readonly number[], r: number, y = 0, turn = 0): InstanceSpot[] {
   return angles.map((a) => ({
      x: Math.sin(a) * r,
      y,
      z: Math.cos(a) * r,
      rotY: a + turn,
   }));
}

export const LEVELS: Record<LevelId, MuseumLevel> = {
   // Level 1 — Main Hall: today's game, unchanged
   1: {
      wing: "main-hall",
      twist: "none",
      ends: [30, 60, 90], dawn: 90,
      speed: [1, 1.15, 1.25], cap: [2, 3, 3], starts: [6, 7, 8], gap: [4.2, 3.6, 3.2],
      first: 3, beam: [16, 14, 12], roster: [2, 2, 2, 2],
      palette: {
         wallTop: COLORS.wallTop,
         wallMid: COLORS.wallMid,
         wallLow: COLORS.wallLow,
         wallPanel: COLORS.wallPanel,
         trim: COLORS.trim,
         trimDark: COLORS.trimDark,
         floorCore: COLORS.floorCore,
         floorMid: COLORS.floorMid,
         floorEdge: COLORS.floorEdge,
         ceiling: COLORS.ceiling,
         skylight: COLORS.skylight,
         sconce: COLORS.sconce,
         lampGlow: COLORS.lampGlow,
         velvet: COLORS.velvet,
         brass: COLORS.brass,
         plinth: COLORS.plinth,
         column: COLORS.column,
         cap: COLORS.cap,
         vase: COLORS.vase,
         beam: COLORS.beam,
      },
      decor: {
         setPiece: "rotunda",
         benchSpots: [{ x: 0, y: 0, z: -2.35, rotY: 0 }],
         vaseSpots: ringSpots([0, Math.PI / 4, Math.PI, (5 * Math.PI) / 4], 6.65),
         sarcophagusSpots: [],
         bustSpots: [],
         chestSpots: [],
         rocketSpots: [],
         glowPodSpots: [],
         cannonSpots: [],
         setPieceAngles: [],
      },
   },
   // Level 2 — Ancient Wing: sandstone & lapis temple hall, obelisks & sarcophagi, cordoned north path
   2: {
      wing: "ancient-wing",
      twist: "cordon",
      ends: [35, 70, 105], dawn: 105,
      speed: [1, 1.18, 1.3], cap: [2, 3, 3], starts: [7, 8, 9], gap: [4.2, 3.4, 3],
      first: 3, beam: [16, 14, 12], roster: [2, 2, 2, 2],
      palette: {
         wallTop: "#1a1108",
         wallMid: "#3d2914",
         wallLow: "#24170b",
         wallPanel: "rgba(245, 198, 105, 0.16)",
         trim: "#e5b85c",
         trimDark: "#78521a",
         floorCore: "#3b2816",
         floorMid: "#21160c",
         floorEdge: "#0c0804",
         ceiling: "#120c06",
         skylight: "#f59e0b",
         sconce: "#fbbf24",
         lampGlow: "#f59e0b",
         velvet: "#0369a1",
         brass: "#d97706",
         plinth: "#21150a",
         column: "#4a3319",
         cap: "#e5b85c",
         vase: "#c27838",
         beam: "#fef3c7",
      },
      decor: {
         setPiece: "obelisks",
         benchSpots: [],
         vaseSpots: ringSpots([0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, -(2 * Math.PI) / 3, -Math.PI / 3], 6.72),
         sarcophagusSpots: SARCOPHAGUS_SPOTS,
         bustSpots: ringSpots([Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 6, -(5 * Math.PI) / 6], 7.05, 0.84, Math.PI),
         chestSpots: ringSpots([Math.PI / 4, -(3 * Math.PI) / 4], 7.05, 0, Math.PI),
         rocketSpots: [],
         glowPodSpots: [],
         cannonSpots: [],
         setPieceAngles: [0, Math.PI, Math.PI / 3, -(2 * Math.PI) / 3],
      },
   },
   // Level 3 — Art Wing: crimson-velvet & gold salon, busts & glass vitrines, curator-paired chains
   3: {
      wing: "art-wing",
      twist: "paired",
      ends: [40, 80, 120], dawn: 120,
      speed: [1, 1.22, 1.35], cap: [2, 3, 3], starts: [8, 9, 10], gap: [4.2, 3.2, 2.8],
      first: 3, beam: [16, 13, 11], roster: [2, 2, 2, 2],
      palette: {
         wallTop: "#1f0812",
         wallMid: "#4a152b",
         wallLow: "#2b0c19",
         wallPanel: "rgba(253, 224, 171, 0.14)",
         trim: "#f5d076",
         trimDark: "#85581a",
         floorCore: "#381827",
         floorMid: "#210d17",
         floorEdge: "#0d0409",
         ceiling: "#170710",
         skylight: "#fda4af",
         sconce: "#fde68a",
         lampGlow: "#fda4af",
         velvet: "#d97706",
         brass: "#f5d076",
         plinth: "#261019",
         column: "#4d2638",
         cap: "#f5d076",
         vase: "#e11d48",
         beam: "#ffe4e6",
      },
      decor: {
         setPiece: "vitrines",
         benchSpots: ringSpots([Math.PI / 8, -(7 * Math.PI) / 8], 7.05, 0, Math.PI),
         vaseSpots: ringSpots([(3 * Math.PI) / 8, (5 * Math.PI) / 8, -(3 * Math.PI) / 8, -(5 * Math.PI) / 8], 6.72),
         sarcophagusSpots: [],
         bustSpots: ringSpots([0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (7 * Math.PI) / 4], 7.08, 0.84, Math.PI),
         chestSpots: [],
         rocketSpots: [],
         glowPodSpots: [],
         cannonSpots: [],
         setPieceAngles: [Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 6, -(5 * Math.PI) / 6],
      },
   },
   // Level 4 — Science Wing: cyber-cobalt planetarium, rockets, specimen pods & orrery, randomized turntables
   4: {
      wing: "science-wing",
      twist: "randomized",
      ends: [40, 80, 120], dawn: 120,
      speed: [1, 1.28, 1.4], cap: [3, 3, 3], starts: [8, 10, 11], gap: [4, 3, 2.6],
      first: 3, beam: [15, 13, 11], roster: [1, 2, 3, 2],
      palette: {
         wallTop: "#05101f",
         wallMid: "#0f2b48",
         wallLow: "#081a2e",
         wallPanel: "rgba(56, 189, 248, 0.18)",
         trim: "#38bdf8",
         trimDark: "#0369a1",
         floorCore: "#0e2944",
         floorMid: "#071626",
         floorEdge: "#020810",
         ceiling: "#030b17",
         skylight: "#38bdf8",
         sconce: "#7dd3fc",
         lampGlow: "#38bdf8",
         velvet: "#06b6d4",
         brass: "#cbd5e1",
         plinth: "#091526",
         column: "#1e3a5f",
         cap: "#38bdf8",
         vase: "#0ea5e9",
         beam: "#e0f2fe",
      },
      decor: {
         setPiece: "orrery",
         benchSpots: [],
         vaseSpots: ringSpots([(3 * Math.PI) / 8, -(5 * Math.PI) / 8], 6.72),
         sarcophagusSpots: SARCOPHAGUS_SPOTS,
         bustSpots: [],
         chestSpots: [],
         rocketSpots: ringSpots([0, Math.PI], 7.08, 0, Math.PI),
         glowPodSpots: ringSpots([Math.PI / 4, -(3 * Math.PI) / 4, Math.PI / 6, -(5 * Math.PI) / 6], 7.02, 0, Math.PI),
         cannonSpots: [],
         setPieceAngles: [(5 * Math.PI) / 6, -Math.PI / 6, -(3 * Math.PI) / 8, (5 * Math.PI) / 8],
      },
   },
   // Level 5 — Full Museum Night: obsidian & gold midnight treasury vault, lasers, cannons & chests, cross-gallery sweep
   5: {
      wing: "full-night",
      twist: "full-night",
      ends: [45, 90, 135], dawn: 135,
      speed: [1, 1.32, 1.45], cap: [3, 3, 3], starts: [9, 11, 12], gap: [3.8, 2.8, 2.5],
      first: 3, beam: [14, 12, 10], roster: [1, 1, 3, 3],
      palette: {
         wallTop: "#06050f",
         wallMid: "#191336",
         wallLow: "#0d0a1f",
         wallPanel: "rgba(251, 191, 36, 0.16)",
         trim: "#fbbf24",
         trimDark: "#92400e",
         floorCore: "#1c1538",
         floorMid: "#0d091c",
         floorEdge: "#020617",
         ceiling: "#04030a",
         skylight: "#f43f5e",
         sconce: "#fde047",
         lampGlow: "#f43f5e",
         velvet: "#e11d48",
         brass: "#fbbf24",
         plinth: "#090714",
         column: "#1e1640",
         cap: "#fbbf24",
         vase: "#f59e0b",
         beam: "#fef9c3",
      },
      decor: {
         setPiece: "vault-lasers",
         benchSpots: [],
         vaseSpots: ringSpots([Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 6, -(5 * Math.PI) / 6], 6.72),
         sarcophagusSpots: SARCOPHAGUS_SPOTS,
         bustSpots: ringSpots([(3 * Math.PI) / 8, (5 * Math.PI) / 8, -(3 * Math.PI) / 8, -(5 * Math.PI) / 8], 7.08, 0.84, Math.PI),
         chestSpots: ringSpots([Math.PI / 4, -(3 * Math.PI) / 4, Math.PI / 8, -(7 * Math.PI) / 8], 7.05, 0, Math.PI),
         rocketSpots: [],
         glowPodSpots: [],
         cannonSpots: ringSpots([0, Math.PI], 7.12, 0, Math.PI / 2),
         setPieceAngles: [0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (7 * Math.PI) / 4],
      },
   },
};
