// Base palette, per-level farm looks (theme → grass/soil/fog + apron scenery), the chase camera,
// and the fence spots. Pure: no React, no three.js. Apron props never enter the play yard.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type FarmLevel, type FarmTheme } from "./levels";
import { BAY_DEPTH, GATE_HALF } from "./rules";

export const COLORS = {
   grass: "#84cc16",
   grassDark: "#65a30d",
   soil: "#a16207",
   soilDark: "#854d0e",
   mud: "#57534e",
   mudWet: "#44403c",
   barn: "#b45309",
   barnDark: "#7c2d12",
   barnTrim: "#fdba74",
   accent: "#eab308",
   hay: "#facc15",
   hayBand: "#ca8a04",
   crate: "#c2410c",
   crateLid: "#9a3412",
   tractor: "#eab308",
   tractorDark: "#a16207",
   cab: "#e0f2fe",
   cabFrame: "#44403c",
   wheel: "#292524",
   hub: "#a8a29e",
   trailer: "#78716c",
   trailerBed: "#57534e",
   hitch: "#3f3f46",
   fence: "#a16207",
   fencePost: "#78350f",
   silo: "#e7e5e4",
   siloBand: "#b45309",
   siloLeg: "#78716c",
   scarecrow: "#a16207",
   scarecrowShirt: "#ef4444",
   scarecrowHat: "#1c1917",
   trough: "#64748b",
   water: "#7dd3fc",
   skin: "#f1d0b4",
   shirt: "#3f6212",
   pants: "#44403c",
   boot: "#292524",
   trunk: "#78350f",
   leaf: "#65a30d",
   ring: "#eab308",
   wheat: "#eab308",
   wheatStem: "#a3e635",
   blossom: "#fb7185",
} as const;

/** Ground tones and fog for one farm theme. Gameplay accents stay on COLORS. */
export interface FarmLook {
   grass: string;
   soil: string;
   soilDark: string;
   mud: string;
   mudWet: string;
   mudRim: string;
   leaf: string;
   fogNear: number;
   fogFarExtra: number;
   /** apron set pieces outside the fenced yard (Decor.tsx) */
   scenery: FarmTheme;
}

export const LOOKS: Record<FarmTheme, FarmLook> = {
   // Farm Yard: today's bright lime grass and brown soil.
   yard: {
      grass: COLORS.grass, soil: COLORS.soil, soilDark: COLORS.soilDark,
      mud: COLORS.mud, mudWet: COLORS.mudWet, mudRim: "#44403c", leaf: COLORS.leaf,
      fogNear: 48, fogFarExtra: 120, scenery: "yard",
   },
   // Wheat Field: golden stubble soil, green-gold grass, soft green sky fog.
   wheat: {
      grass: "#a3e635", soil: "#ca8a04", soilDark: "#a16207",
      mud: COLORS.mud, mudWet: COLORS.mudWet, mudRim: "#57534e", leaf: "#84cc16",
      fogNear: 42, fogFarExtra: 110, scenery: "wheat",
   },
   // Orchard: warmer dusk soil, pink-tinted canopy, sunset fog.
   orchard: {
      grass: "#65a30d", soil: "#92400e", soilDark: "#78350f",
      mud: COLORS.mud, mudWet: COLORS.mudWet, mudRim: "#44403c", leaf: "#4d7c0f",
      fogNear: 36, fogFarExtra: 95, scenery: "orchard",
   },
   // Mud Farm: grey-green wash, dark soil, wet mud pits (fog near matches today's mud).
   mud: {
      grass: "#78716c", soil: "#57534e", soilDark: "#44403c",
      mud: "#3f3f46", mudWet: "#292524", mudRim: "#1c1917", leaf: "#57534e",
      fogNear: 22, fogFarExtra: 58, scenery: "mud",
   },
   // Mega Farm: deep sunset soil, dense apron, cinematic fog.
   mega: {
      grass: "#3f6212", soil: "#9a3412", soilDark: "#7c2d12",
      mud: "#44403c", mudWet: "#292524", mudRim: "#1c1917", leaf: "#365314",
      fogNear: 30, fogFarExtra: 88, scenery: "mega",
   },
};

export const lookFor = (level: FarmLevel): FarmLook => LOOKS[level.theme];

export const PITCH = (46 * Math.PI) / 180;
export const YAWS = [Math.PI, Math.PI / 2] as const;
export const FOV = 46;
export const FOLLOW = 1;
/** What must stay on screen around the tractor (m): the yard scrolls under the camera. */
export const WINDOW = { w: 20, d: 14 } as const;
export const LOOK_AHEAD = 3.5;
export const DAMPING = 4.5;

/** Apron decor stands at least this far past the fence. */
export const APRON_GAP = 1.6;

export function fieldBox(level: FarmLevel): AABB {
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   return {
      min: { x: -halfW - 0.6, y: 0, z: -halfD - 0.6 },
      max: { x: halfW + 0.6, y: 3.2, z: halfD + 0.6 },
   };
}

/** The window round the camera aim that the fit keeps on screen. */
export function windowBox(level: FarmLevel): AABB {
   const halfW = level.width / 2 + 0.6;
   const halfD = level.depth / 2 + 0.6;
   const w = Math.min(halfW, WINDOW.w / 2);
   const d = Math.min(halfD, WINDOW.d / 2);
   return { min: { x: -w, y: 0, z: -d }, max: { x: w, y: 3.2, z: d } };
}

/** Where the camera aim may go: the yard shrunk by half the window, so the fence never leaves the frame. */
export function aimBounds(level: FarmLevel): AABB {
   const halfW = level.width / 2 + 0.6;
   const halfD = level.depth / 2 + 0.6;
   const w = Math.min(halfW, WINDOW.w / 2);
   const d = Math.min(halfD, WINDOW.d / 2);
   return { min: { x: -(halfW - w), y: 0, z: -(halfD - d) }, max: { x: halfW - w, y: 3.2, z: halfD - d } };
}

export function lookAtFor(level: FarmLevel): [number, number, number] {
   return [0, 0.7, 0];
}

/** Grass extends past the fence so the chase camera never shows a void at the edge. */
export function groundSpan(level: FarmLevel): number {
   return Math.max(level.width, level.depth) * 2.6;
}

export function gateZOf(level: FarmLevel): number {
   return level.depth / 2 - BAY_DEPTH;
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A window round the tractor stays on screen; portrait may pick the side yaw. The chase camera follows it. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = windowBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: [{ x: 0, y: 0.7, z: 0 }],
         margin: { top: 0.06, right: 0.03, bottom: 0.1, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Theme fog: mud farm keeps today's grey near/far; others fog toward their sky. */
export function fogFor(level: FarmLevel): [string, number, number] {
   const look = LOOKS[level.theme];
   const reach = Math.max(level.width, level.depth);
   if (level.theme === "mud") return [level.background, look.fogNear, look.fogFarExtra];
   return [level.background, look.fogNear, look.fogFarExtra + reach];
}

/** True when (x,z) sits inside the fenced yard, expanded by `pad` metres. */
export function inPlayYard(level: FarmLevel, x: number, z: number, pad = 0): boolean {
   const halfW = level.width / 2 + pad;
   const halfD = level.depth / 2 + pad;
   return Math.abs(x) <= halfW && Math.abs(z) <= halfD;
}

/** Decor sits outside the fence, on the barn side, so it does not cover the tractor. Level 1 = today. */
export function decorAt(level: FarmLevel) {
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   if (level.theme === "yard") {
      return {
         silo: { x: -halfW - 2.6, z: halfD - 0.4 },
         trough: { x: halfW + 2.4, z: halfD - 1.6 },
         scarecrow: { x: halfW + 2.3, z: halfD - 5.2 },
         crate: { x: -halfW - 2.4, z: halfD - 4.4 },
         barn: { x: 0, z: halfD - 0.8 },
      };
   }
   if (level.theme === "wheat") {
      return {
         silo: { x: -halfW - 3.0, z: halfD - 1.2 },
         trough: { x: halfW + 2.8, z: halfD - 0.8 },
         scarecrow: { x: halfW + 2.5, z: -halfD - 2.2 },
         crate: { x: -halfW - 2.6, z: halfD - 5.0 },
         barn: { x: 0, z: halfD - 0.8 },
      };
   }
   if (level.theme === "orchard") {
      return {
         silo: { x: -halfW - 2.8, z: halfD - 0.6 },
         trough: { x: halfW + 2.6, z: halfD - 2.4 },
         scarecrow: { x: -halfW - 2.5, z: -halfD - 2.0 },
         crate: { x: halfW + 2.5, z: halfD - 5.0 },
         barn: { x: 0, z: halfD - 0.8 },
      };
   }
   if (level.theme === "mud") {
      return {
         silo: { x: -halfW - 2.4, z: halfD - 1.0 },
         trough: { x: halfW + 2.2, z: halfD - 1.2 },
         scarecrow: { x: halfW + 2.6, z: halfD - 6.0 },
         crate: { x: -halfW - 2.8, z: halfD - 5.2 },
         barn: { x: 0, z: halfD - 0.8 },
      };
   }
   // mega
   return {
      silo: { x: -halfW - 3.2, z: halfD - 0.5 },
      trough: { x: halfW + 3.0, z: halfD - 1.4 },
      scarecrow: { x: halfW + 2.8, z: -halfD - 2.4 },
      crate: { x: -halfW - 2.8, z: halfD - 4.8 },
      barn: { x: 0, z: halfD - 0.8 },
   };
}

export interface FarmScenery {
   /** Tall wheat stalks (unit cylinders; spot sy is height). */
   wheatStems: InstanceSpot[];
   /** Golden wheat heads on the stems. */
   wheatHeads: InstanceSpot[];
   /** Visual apron trees (not the solid orchard trees inside the yard). */
   trees: InstanceSpot[];
   hayStacks: InstanceSpot[];
   crates: InstanceSpot[];
   /** Extra silos beyond decorAt.silo. */
   silos: InstanceSpot[];
   scarecrows: InstanceSpot[];
   troughs: InstanceSpot[];
   /** Low wooden boardwalk strips beside the mud farm (outside fence). */
   planks: InstanceSpot[];
}

function emptyScenery(): FarmScenery {
   return {
      wheatStems: [], wheatHeads: [], trees: [], hayStacks: [],
      crates: [], silos: [], scarecrows: [], troughs: [], planks: [],
   };
}

function pushWheatRow(
   out: FarmScenery,
   x0: number,
   z0: number,
   x1: number,
   z1: number,
   count: number,
   rotY = 0,
) {
   for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const h = 0.85 + (i % 3) * 0.08;
      out.wheatStems.push({ x, y: h / 2, z, rotY, sx: 0.06, sy: h, sz: 0.06 });
      out.wheatHeads.push({ x, y: h + 0.12, z, rotY, sx: 0.22, sy: 0.28, sz: 0.14 });
   }
}

/**
 * Apron scenery outside the fence (visual only, never solids). Level 1 (`yard`) keeps today's
 * four barn-side props only — no extra apron rows. Wheat Field gets crop rows; Orchard gets
 * blossom trees + crate stacks; Mud Farm gets boardwalk planks; Mega Farm densifies everything.
 */
export function scenerySpots(level: FarmLevel): FarmScenery {
   const out = emptyScenery();
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   const gap = APRON_GAP;
   const theme = level.theme;

   if (theme === "yard") return out;

   if (theme === "wheat" || theme === "mega") {
      // South wheat field: parallel rows past the south fence.
      const zRow0 = -halfD - gap - 0.8;
      for (let row = 0; row < (theme === "mega" ? 5 : 4); row++) {
         const z = zRow0 - row * 0.85;
         pushWheatRow(out, -halfW - 1.5, z, halfW + 1.5, z, theme === "mega" ? 22 : 16);
      }
      // East and west flanks.
      for (let row = 0; row < 3; row++) {
         const xL = -halfW - gap - 0.6 - row * 0.75;
         const xR = halfW + gap + 0.6 + row * 0.75;
         pushWheatRow(out, xL, -halfD + 1, xL, halfD - 3, 10, Math.PI / 2);
         pushWheatRow(out, xR, -halfD + 1, xR, halfD - 3, 10, Math.PI / 2);
      }
      out.hayStacks.push(
         { x: -halfW - 4.2, y: 0.55, z: -halfD - 3.2, sx: 1.4, sy: 1.1, sz: 1.4 },
         { x: halfW + 4.0, y: 0.55, z: -halfD - 2.8, sx: 1.3, sy: 1.0, sz: 1.3 },
      );
      if (theme === "wheat") {
         out.scarecrows.push({ x: 0, y: 0, z: -halfD - gap - 2.6, scale: 1 });
      }
   }

   if (theme === "orchard" || theme === "mega") {
      const treeZs = [-halfD - gap - 1.2, -halfD - gap - 3.4, halfD - 8, halfD - 11];
      for (const side of [-1, 1] as const) {
         for (let i = 0; i < treeZs.length; i++) {
            out.trees.push({
               x: side * (halfW + gap + 1.1 + (i % 2) * 0.9),
               y: 0,
               z: treeZs[i],
               scale: 0.9 + (i % 3) * 0.12,
            });
         }
      }
      // Crate stacks beside the barn apron.
      out.crates.push(
         { x: -halfW - 2.2, y: 0.4, z: halfD - 7.2, sx: 0.9, sy: 0.8, sz: 0.9 },
         { x: -halfW - 2.2, y: 1.15, z: halfD - 7.2, sx: 0.85, sy: 0.7, sz: 0.85 },
         { x: halfW + 2.4, y: 0.4, z: halfD - 7.6, sx: 0.9, sy: 0.8, sz: 0.9 },
         { x: halfW + 3.4, y: 0.4, z: halfD - 7.6, sx: 0.9, sy: 0.8, sz: 0.9 },
      );
      if (theme === "orchard") {
         out.troughs.push({ x: -halfW - 2.6, y: 0, z: -halfD - 2.4, scale: 1 });
      }
   }

   if (theme === "mud" || theme === "mega") {
      // Boardwalk strips outside the east/west fence so the grey yard reads as a mud lot.
      for (const side of [-1, 1] as const) {
         for (let i = 0; i < 4; i++) {
            out.planks.push({
               x: side * (halfW + gap + 0.35),
               y: 0.06,
               z: -halfD + 3 + i * 4.2,
               rotY: Math.PI / 2,
               sx: 0.55,
               sy: 0.1,
               sz: 3.6,
            });
         }
      }
      out.hayStacks.push(
         { x: -halfW - 3.6, y: 0.5, z: halfD - 8.5, sx: 1.5, sy: 1.0, sz: 1.5 },
         { x: halfW + 3.4, y: 0.5, z: -halfD - 2.0, sx: 1.4, sy: 0.95, sz: 1.4 },
      );
   }

   if (theme === "mega") {
      out.silos.push(
         { x: halfW + 3.4, y: 0, z: halfD - 0.6, scale: 1 },
         { x: -halfW - 5.2, y: 0, z: halfD - 3.5, scale: 0.85 },
      );
      out.scarecrows.push(
         { x: -halfW - 2.4, y: 0, z: -halfD - 2.2, scale: 1 },
         { x: halfW + 4.5, y: 0, z: halfD - 9, scale: 1 },
      );
      out.crates.push(
         { x: 0, y: 0.4, z: halfD + 2.2, sx: 1.0, sy: 0.8, sz: 1.0 },
         { x: 1.1, y: 0.4, z: halfD + 2.2, sx: 1.0, sy: 0.8, sz: 1.0 },
         { x: 0.55, y: 1.15, z: halfD + 2.2, sx: 0.95, sy: 0.7, sz: 0.95 },
      );
      out.troughs.push({ x: halfW + 2.8, y: 0, z: -halfD - 1.6, scale: 1 });
      out.hayStacks.push(
         { x: 0, y: 0.6, z: -halfD - gap - 5.2, sx: 1.8, sy: 1.2, sz: 1.8 },
         { x: -4, y: 0.5, z: -halfD - gap - 5.0, sx: 1.3, sy: 1.0, sz: 1.3 },
         { x: 4, y: 0.5, z: -halfD - gap - 5.0, sx: 1.3, sy: 1.0, sz: 1.3 },
      );
   }

   return out;
}

/**
 * Drawn mud-pit extras (rim + wet centre) for every gameplay mud rect. Visual only — the rules
 * still use the flat rect. Empty when the level has no mud.
 */
export function mudPitSpots(mud: readonly { x0: number; x1: number; z0: number; z1: number }[]): {
   beds: InstanceSpot[];
   wet: InstanceSpot[];
   rims: InstanceSpot[];
} {
   const beds: InstanceSpot[] = [];
   const wet: InstanceSpot[] = [];
   const rims: InstanceSpot[] = [];
   for (const rect of mud) {
      const x = (rect.x0 + rect.x1) / 2;
      const z = (rect.z0 + rect.z1) / 2;
      const sx = rect.x1 - rect.x0;
      const sz = rect.z1 - rect.z0;
      beds.push({ x, y: 0.04, z, sx, sy: 0.06, sz });
      wet.push({ x, y: 0.07, z, sx: sx * 0.72, sy: 0.04, sz: sz * 0.72 });
      // four rim boards
      rims.push({ x, y: 0.09, z: rect.z0 + 0.12, sx: sx + 0.15, sy: 0.12, sz: 0.22 });
      rims.push({ x, y: 0.09, z: rect.z1 - 0.12, sx: sx + 0.15, sy: 0.12, sz: 0.22 });
      rims.push({ x: rect.x0 + 0.12, y: 0.09, z, sx: 0.22, sy: 0.12, sz: sz + 0.15 });
      rims.push({ x: rect.x1 - 0.12, y: 0.09, z, sx: 0.22, sy: 0.12, sz: sz + 0.15 });
   }
   return { beds, wet, rims };
}

interface FenceDraw { posts: InstanceSpot[]; rails: InstanceSpot[] }

const FENCE = new Map<LevelId, FenceDraw>();

/** Unit-box spots. Posts are 0.18 x 1.05 x 0.18. The gate gap is left open. */
export function fenceDraw(id: LevelId): FenceDraw {
   let draw = FENCE.get(id);
   if (draw) return draw;
   const level = LEVELS[id];
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   const gateZ = gateZOf(level);
   const posts: InstanceSpot[] = [];
   const rails: InstanceSpot[] = [];
   const add = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.15));
      const rotY = Math.atan2(x1 - x0, z1 - z0);
      const at: { x: number; z: number }[] = [];
      for (let i = 0; i <= n; i++) {
         const t = i / n;
         at.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t });
      }
      for (const p of at) posts.push({ x: p.x, y: 0.525, z: p.z, sx: 0.18, sy: 1.05, sz: 0.18 });
      for (let i = 0; i < at.length - 1; i++) {
         const a = at[i];
         const b = at[i + 1];
         const span = Math.hypot(b.x - a.x, b.z - a.z);
         if (span < 0.2) continue;
         rails.push({ x: (a.x + b.x) / 2, y: 0.78, z: (a.z + b.z) / 2, rotY, sx: 0.08, sy: 0.08, sz: span });
         rails.push({ x: (a.x + b.x) / 2, y: 0.38, z: (a.z + b.z) / 2, rotY, sx: 0.07, sy: 0.07, sz: span });
      }
   };
   add(-halfW, -halfD, halfW, -halfD);
   add(halfW, -halfD, halfW, halfD);
   add(halfW, halfD, -halfW, halfD);
   add(-halfW, halfD, -halfW, -halfD);
   add(-halfW, gateZ, -GATE_HALF, gateZ);
   add(GATE_HALF, gateZ, halfW, gateZ);
   draw = { posts, rails };
   FENCE.set(id, draw);
   return draw;
}

/**
 * One GLB segment per span between two posts, standing on the ground. The asset is a unit model
 * (its length 1 m along the fence), so the spot's scale is the span in metres. The rails come in
 * pairs (top, bottom) per span: every second one is a span.
 */
export function fenceGlbSpots(id: LevelId): InstanceSpot[] {
   const rails = fenceDraw(id).rails;
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < rails.length; i += 2) {
      const rail = rails[i];
      spots.push({ x: rail.x, y: 0, z: rail.z, rotY: rail.rotY, scale: rail.sz });
   }
   return spots;
}
