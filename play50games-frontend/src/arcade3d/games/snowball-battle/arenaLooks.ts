// How each level's arena looks (levels.ts ARENAS[].theme). Plain data, no three.js: the light, sky
// and fog for index.tsx, the palette, and where the scenery stands. Every decor piece stands outside
// the 24 x 18 fence and never on the camera's side (+z), so it cannot hide a kid (looks.test.ts
// sweeps it like the pines). Level 1 ("yard") is today's look and draws nothing from this file.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { ArenaTheme } from "./levels";
import type { WorldBox } from "./looks";

export interface ThemeLook {
   background: string;
   fog: readonly [string, number, number];
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   /** snowfall flakes before the quality scale */
   snow: number;
   fence: string;
   rail: string;
   /** the far ground disc beyond the fence */
   shade: string;
   /** fort body, cap and trim (hedge / ice brick / igloo / ice block) */
   fortBody: string;
   fortCap: string;
   fortTrim: string;
}

export const THEMES: Record<ArenaTheme, ThemeLook> = {
   yard: {
      background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow", skyTop: "#bae6fd", skyBottom: "#f8fafc", snow: 360,
      fence: "#e2e8f0", rail: "#cbd5e1", shade: "#bfdbfe", fortBody: "#f8fafc", fortCap: "#bae6fd", fortTrim: "#0c4a6e",
   },
   // Frozen Park: a clear bright noon, a wooden park fence, snow-capped hedges for forts
   park: {
      background: "#bfe3fb", fog: ["#d6ecfb", 30, 56], lighting: "day", skyTop: "#60a5fa", skyBottom: "#eff6ff", snow: 120,
      fence: "#a16207", rail: "#78350f", shade: "#c7e3d4", fortBody: "#3f6212", fortCap: "#f8fafc", fortTrim: "#1a2e05",
   },
   // Snow Fort: late afternoon under a golden sky (the white "day" sun keeps the snow white, the
   // "sunset" preset turned it to sand), ice-brick castle walls with merlons and pennants
   fort: {
      background: "#fde7cf", fog: ["#fde7cf", 28, 52], lighting: "day", skyTop: "#f97316", skyBottom: "#fff7ed", snow: 200,
      fence: "#7c2d12", rail: "#9a3412", shade: "#e2e8f0", fortBody: "#e0f2fe", fortCap: "#60a5fa", fortTrim: "#1e3a8a",
   },
   // Ice Village: blue hour, heavy snowfall, igloos for forts, lamp light along the lanes
   village: {
      background: "#c7d2fe", fog: ["#c7d2fe", 26, 52], lighting: "snow", skyTop: "#4f46e5", skyBottom: "#e0e7ff", snow: 720,
      fence: "#cbd5e1", rail: "#94a3b8", shade: "#a5b4fc", fortBody: "#f1f5f9", fortCap: "#c7d2fe", fortTrim: "#312e81",
   },
   // Championship Arena: night under floodlights, ice-block barriers, team banners round the ring
   arena: {
      background: "#0b1020", fog: ["#111827", 30, 62], lighting: "night", skyTop: "#1e1b4b", skyBottom: "#312e81", snow: 240,
      fence: "#e2e8f0", rail: "#38bdf8", shade: "#1e293b", fortBody: "#bae6fd", fortCap: "#e0f2fe", fortTrim: "#0ea5e9",
   },
};

/** Ice and deep-snow patches as drawn (the rules zones). */
export const ICE_LOOK = { color: "#a5d8f3", rim: "#e0f2fe", y: 0.012 } as const;
export const DRIFT_LOOK = { color: "#c7d7f0", rim: "#ffffff", height: 0.16, y: 0.01 } as const;

export type DecorKind = "tree" | "bench" | "lamp" | "tower" | "glacier" | "stand" | "banner" | "flood";

export interface DecorSpot {
   kind: DecorKind;
   x: number;
   z: number;
   rotY: number;
   /** drawn size, metres: width (local x), height, depth (local z) */
   w: number;
   h: number;
   d: number;
   /** banner / stand colour */
   color?: string;
}

const tree = (x: number, z: number, rotY = 0, h = 4.2): DecorSpot => ({ kind: "tree", x, z, rotY, w: h * 0.94, h, d: h * 0.65 });
const bench = (x: number, z: number, rotY: number): DecorSpot => ({ kind: "bench", x, z, rotY, w: 1.8, h: 0.8, d: 0.76 });
const lamp = (x: number, z: number, h = 3.2): DecorSpot => ({ kind: "lamp", x, z, rotY: 0, w: 0.75, h, d: 0.73 });
const tower = (x: number, z: number, rotY = 0): DecorSpot => ({ kind: "tower", x, z, rotY, w: 3.6, h: 5, d: 3.7 });
const glacier = (x: number, z: number, rotY = 0): DecorSpot => ({ kind: "glacier", x, z, rotY, w: 3, h: 2.2, d: 2.24 });
const stand = (x: number, z: number, rotY: number, w: number, color: string): DecorSpot => ({ kind: "stand", x, z, rotY, w, h: 2.4, d: 3, color });
const banner = (x: number, z: number, rotY: number, color: string): DecorSpot => ({ kind: "banner", x, z, rotY, w: 2.6, h: 0.9, d: 0.08, color });
const flood = (x: number, z: number): DecorSpot => ({ kind: "flood", x, z, rotY: 0, w: 0.9, h: 7, d: 0.9 });

/** Scenery per theme. Side pieces stay low or thin (|x| > 13); tall ones stand past the far fence. */
export const DECOR: Record<ArenaTheme, readonly DecorSpot[]> = {
   yard: [],
   park: [
      tree(-15, -12.5, 0.4), tree(-8.5, -13.2, 1.3), tree(-2.6, -12.4, 2.2, 4.6), tree(3.4, -13, 0.9), tree(9.2, -12.6, 2.8, 4.6), tree(15.2, -12.2, 1.9),
      tree(-18.5, -4, 0.3, 4.8), tree(18.5, -3, 2.4, 4.8), tree(-18.8, 4.5, 1.1), tree(18.8, 5, 0.6),
      bench(-13.4, -4, Math.PI / 2), bench(-13.4, 3, Math.PI / 2), bench(13.4, -2.5, -Math.PI / 2), bench(13.4, 4.5, -Math.PI / 2),
      lamp(-13.2, -7.6), lamp(-13.2, 0), lamp(-13.2, 7), lamp(13.2, -7.6), lamp(13.2, 1), lamp(13.2, 7.2),
   ],
   fort: [
      tower(-14.2, -11.6, 0.3), tower(14.2, -11.6, -0.3), tower(-5.5, -12.8, 0.1), tower(5.5, -12.8, -0.1),
      tree(-19, -2, 0.7, 4.8), tree(19, -1, 2.1, 4.8),
      banner(-6, -9.25, 0, "#f87171"), banner(0, -9.25, 0, "#4ade80"), banner(6, -9.25, 0, "#fb923c"),
   ],
   village: [
      glacier(-14.5, -12.8, 0.6), glacier(14.6, -12.4, -0.8), glacier(-17.8, 2.5, 1.4), glacier(17.8, -1.5, -1.2),
      lamp(-13.2, -7.2, 3.4), lamp(-13.2, -1, 3.4), lamp(-13.2, 5.2, 3.4), lamp(13.2, -7.2, 3.4), lamp(13.2, -1, 3.4), lamp(13.2, 5.2, 3.4),
      bench(-13.6, 2.2, Math.PI / 2), bench(13.6, 2.2, -Math.PI / 2),
   ],
   arena: [
      stand(0, -12.6, 0, 22, "#1e3a8a"), stand(-15.6, -1, Math.PI / 2, 14, "#3730a3"), stand(15.6, -1, -Math.PI / 2, 14, "#3730a3"),
      flood(-13.4, -10.4), flood(13.4, -10.4), flood(-13.4, 8.4), flood(13.4, 8.4),
      banner(-8, -9.25, 0, "#f87171"), banner(-2.7, -9.25, 0, "#4ade80"), banner(2.7, -9.25, 0, "#fb923c"), banner(8, -9.25, 0, "#38bdf8"),
      banner(-12.25, -3.5, Math.PI / 2, "#38bdf8"), banner(-12.25, 3.5, Math.PI / 2, "#f87171"),
      banner(12.25, -3.5, -Math.PI / 2, "#4ade80"), banner(12.25, 3.5, -Math.PI / 2, "#fb923c"),
   ],
};

/** The world box a decor spot fills (its footprint turned by rotY, conservatively axis-aligned). */
export function decorBox(spot: DecorSpot, out: WorldBox): WorldBox {
   const c = Math.abs(Math.cos(spot.rotY));
   const s = Math.abs(Math.sin(spot.rotY));
   const hx = (spot.w * c + spot.d * s) / 2;
   const hz = (spot.w * s + spot.d * c) / 2;
   out.minX = spot.x - hx;
   out.maxX = spot.x + hx;
   out.minY = spot.kind === "banner" ? 0.15 : 0;
   out.maxY = spot.kind === "banner" ? 0.15 + spot.h : spot.h;
   out.minZ = spot.z - hz;
   out.maxZ = spot.z + hz;
   return out;
}

/** The centre cover (rules: the 1.40 x 1.60 x 1.40 snowman box) per theme. Visual only. */
export type CentrePiece = "snowman" | "fountain" | "snowmanBig" | "trophy";
export const CENTRE: Record<ArenaTheme, CentrePiece> = {
   yard: "snowman",
   park: "fountain",
   fort: "snowman",
   village: "snowmanBig",
   arena: "trophy",
};

/** Arena floodlights: warm point lights over the ring (night only). */
export const FLOOD_LIGHTS: readonly { x: number; y: number; z: number; color: string; intensity: number }[] = [
   { x: -8, y: 9, z: -4, color: "#fde68a", intensity: 60 },
   { x: 8, y: 9, z: -4, color: "#fde68a", intensity: 60 },
   { x: 0, y: 9, z: 5, color: "#e0f2fe", intensity: 50 },
];
