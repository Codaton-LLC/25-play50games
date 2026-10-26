// One palette, the chase camera, and the fence spots. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type FarmLevel } from "./levels";
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
} as const;

export const PITCH = (46 * Math.PI) / 180;
export const YAWS = [Math.PI, Math.PI / 2] as const;
export const FOV = 46;
export const FOLLOW = 1;
/** What must stay on screen around the tractor (m): the yard scrolls under the camera. */
export const WINDOW = { w: 20, d: 14 } as const;
export const LOOK_AHEAD = 3.5;
export const DAMPING = 4.5;

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

/** Grey weather on the mud farm. Other levels fog toward their own sky. */
export function fogFor(level: FarmLevel): [string, number, number] {
   const reach = Math.max(level.width, level.depth);
   if (level.background === "#a8a29e") return ["#a8a29e", 22, 58];
   return [level.background, 48, 120 + reach];
}

/** Decor sits outside the fence, on the barn side, so it does not cover the tractor. */
export function decorAt(level: FarmLevel) {
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   return {
      silo: { x: -halfW - 2.6, z: halfD - 0.4 },
      trough: { x: halfW + 2.4, z: halfD - 1.6 },
      scarecrow: { x: halfW + 2.3, z: halfD - 5.2 },
      crate: { x: -halfW - 2.4, z: halfD - 4.4 },
      barn: { x: 0, z: halfD - 0.8 },
   };
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
