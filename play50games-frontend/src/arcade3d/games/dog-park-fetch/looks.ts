// One palette, the follow camera and the lawn decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type DogLevel } from "./levels";
import { blanketOf, type Prop } from "./rules";

export const COLORS = {
   // a rich, quiet lawn (the grass texture carries the detail), mowing stripes only a shade lighter
   lawn: "#ffffff",
   lawnBase: "#4f8a2b",
   lawnDark: "#457a25",
   lawnLight: "#5b9832",
   parkGrass: "#3f6f22",
   stripe: "#9ccc65",
   path: "#d6d3d1",
   blanket: "#f59e0b",
   blanketEdge: "#fde68a",
   sand: "#f2d7a6",
   fence: "#f5f5f4",
   fenceCap: "#d6d3d1",
   dog: "#d6a15b",
   dogDark: "#92400e",
   dogNose: "#1c1917",
   owner: "#e7e5e4",
   ball: "#d9f99d",
   ballLine: "#f8fafc",
   stick: "#a16207",
   frisbee: "#f97316",
   frisbeeRim: "#fdba74",
   mower: "#dc2626",
   mowerDark: "#7f1d1d",
   fountain: "#cbd5e1",
   fountainWater: "#7dd3fc",
   bench: "#92400e",
   tree: "#166534",
   trunk: "#78350f",
   target: "#fbbf24",
   dogRing: "#ffffff",
   gingham: "#dc2626",
   ginghamLight: "#fca5a5",
   ginghamWhite: "#fff7ed",
} as const;

/** Per-level lawn and sky palette: every park reads as its own place (L1 is the original palette). */
export interface LawnPalette {
   /** the lawn texture's mottled base */
   lawnBase: string;
   lawnDark: string;
   lawnLight: string;
   /** the wide park grass (or the beach park's sand) running out under the fog */
   parkGrass: string;
   /** the mowing stripes' tint */
   stripe: string;
   /** the SkyDome's top colour */
   sky: string;
}

export const PALETTES: Record<LevelId, LawnPalette> = {
   // Small Park: the original sunny lawn.
   1: { lawnBase: COLORS.lawnBase, lawnDark: COLORS.lawnDark, lawnLight: COLORS.lawnLight, parkGrass: COLORS.parkGrass, stripe: COLORS.stripe, sky: "#38bdf8" },
   // City Park: a cooler, kempt city lawn under a bright sky.
   2: { lawnBase: "#5d9433", lawnDark: "#528a2d", lawnLight: "#6aa23c", parkGrass: "#4a7e2b", stripe: "#aed581", sky: "#4cc0f7" },
   // Forest Park: deep shade greens in dusk light, the trees closing in.
   3: { lawnBase: "#3c7023", lawnDark: "#32601d", lawnLight: "#47812a", parkGrass: "#2b5217", stripe: "#86a862", sky: "#7c2d12" },
   // Beach Park: sun-bleached grass on warm sand, a sunset dome.
   4: { lawnBase: "#7f9a45", lawnDark: "#748d3c", lawnLight: "#8aa54e", parkGrass: COLORS.sand, stripe: "#d4e157", sky: "#7c2d12" },
   // Dog Festival: a rich summer lawn under bunting.
   5: { lawnBase: "#57922f", lawnDark: "#4c8529", lawnLight: "#62a038", parkGrass: "#457626", stripe: "#cddc39", sky: "#38bdf8" },
};

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
export const LOOK_AHEAD = 1.4;
/** the player's zoom (wheel, pinch, + / -): a factor on the fitted camera distance */
export const ZOOM = { min: 0.55, max: 1.8 } as const;
export const DAMPING = 4;
/** Fog depth past its start; the start follows the fitted camera distance (fogFor). */
export const FOG_DEPTH = 45;
export const FOG_MIN_NEAR = 18;

export function lawnBox(level: DogLevel): AABB {
   return {
      min: { x: -level.width / 2 - 0.4, y: 0, z: -level.depth / 2 - 0.4 },
      max: { x: level.width / 2 + 0.4, y: 2.5, z: level.depth / 2 + 0.4 },
   };
}

export function lookAtFor(level: DogLevel): [number, number, number] {
   return [0, 0.4, blanketOf(level).z / 2];
}

/**
 * Half size of the window the follow camera keeps on screen around its aim: close enough that the
 * dog is a clear size (portrait phone 3.4 x 4.6 m, landscape 5.2 x 3.8 m). Throws land outside it;
 * the edge arrow and the beacon show where. The player zooms out (or in) with ZOOM.
 */
export function viewWindow(level: DogLevel, portrait: boolean): { x: number; z: number } {
   return { x: Math.min(level.width / 2, portrait ? 3.4 : 5.2), z: Math.min(level.depth / 2, portrait ? 4.6 : 3.8) };
}

const VIEWS = new Map<string, FittedViewOptions>();

/** A window around the aim (the camera follows the dog with it), one yaw, clear of the HUD and the controls. */
export function viewFor(id: LevelId, portrait = false): FittedViewOptions {
   const key = `${id}:${portrait}`;
   let view = VIEWS.get(key);
   if (!view) {
      const w = viewWindow(LEVELS[id], portrait);
      view = {
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: 1.2, z: w.z } },
         pitch: PITCH,
         yaws: [0],
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}

/** Where the aim may go: the lawn less the window, plus a little, so the view never runs far past the fence. */
export function aimBounds(level: DogLevel, portrait: boolean): AABB {
   const w = viewWindow(level, portrait);
   const hx = Math.max(0, level.width / 2 - w.x + 1.5);
   const hz = Math.max(0, level.depth / 2 - w.z + 1.5);
   return { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 2, z: hz } };
}

/** The fog starts half a window past the aim at the fitted distance, never nearer than FOG_MIN_NEAR. */
export function fogFor(level: DogLevel, distance: number, portrait: boolean): { near: number; far: number } {
   const near = Math.max(FOG_MIN_NEAR, distance + viewWindow(level, portrait).z * 0.5);
   return { near, far: near + FOG_DEPTH };
}

// ---------- decor: outside the fence, never between the camera and the lawn ----------
// The camera looks north (-z) from the south: south of the fence only low things stand.

export const SOUTH_DECOR_MAX_H = 0.7;

export interface DecorSpots {
   trees: InstanceSpot[];
   bushes: InstanceSpot[];
   tents: InstanceSpot[];
   tunnels: InstanceSpot[];
   hurdles: InstanceSpot[];
   /** City Park (L2): lamp posts outside the east / west fence (pole + glowing head). */
   lamps: InstanceSpot[];
   /** City Park (L2): skyline blocks behind the north fence (per-axis size). */
   blocks: InstanceSpot[];
   /** Forest Park (L3): tree stumps outside the fence. */
   stumps: InstanceSpot[];
   /** Forest Park (L3) / Beach Park (L4): boulders, flat ones on the south sand. */
   rocks: InstanceSpot[];
   /** Beach Park (L4): umbrellas outside the east / west fence (pole + canopy), two colours. */
   umbrellasA: InstanceSpot[];
   umbrellasB: InstanceSpot[];
   /** Dog Festival (L5): bunting strings and pennants along the fence, two colours. */
   flagLines: InstanceSpot[];
   flagsA: InstanceSpot[];
   flagsB: InstanceSpot[];
   /** Dog Festival (L5): floating balloons behind the north fence, two colours. */
   balloonsA: InstanceSpot[];
   balloonsB: InstanceSpot[];
}

/** Seeded per level; every decor GLB is fitted to 1 m, so a spot's `scale` is its size. */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const rng = createRng(7100 + id);
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const out: DecorSpots = { trees: [], bushes: [], tents: [], tunnels: [], hurdles: [], lamps: [], blocks: [], stumps: [], rocks: [], umbrellasA: [], umbrellasB: [], flagLines: [], flagsA: [], flagsB: [], balloonsA: [], balloonsB: [] };
   // a tree line behind the north fence and down both sides (not the south: the camera side)
   for (let x = -hw - 4; x <= hw + 4; x += 4.5) out.trees.push({ x: x + (rng() - 0.5), y: 0, z: -hd - 3 - rng() * 2, rotY: rng() * 6.28, scale: 3.2 + rng() * 1.4 });
   for (let z = -hd; z <= hd - 4; z += 5) {
      out.trees.push({ x: -hw - 3.2 - rng() * 1.5, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 3 + rng() * 1.2 });
      out.trees.push({ x: hw + 3.2 + rng() * 1.5, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 3 + rng() * 1.2 });
   }
   // low bushes along the outside of the fence, the south row included (they stay under 0.7 m)
   // (not on the beach park, whose south side is sand and then water)
   if (id !== 4) for (let x = -hw + 1; x <= hw - 1; x += 3) out.bushes.push({ x: x + rng() * 0.6, y: 0, z: hd + 1.4, rotY: rng() * 6.28, scale: 1.1 + rng() * 0.3 });
   for (let z = -hd + 2; z <= hd - 2; z += 4) {
      out.bushes.push({ x: -hw - 1.3, y: 0, z, rotY: rng() * 6.28, scale: 1.4 + rng() * 0.4 });
      out.bushes.push({ x: hw + 1.3, y: 0, z, rotY: rng() * 6.28, scale: 1.4 + rng() * 0.4 });
   }
   if (id === 2) {
      // the city park: lamps along both sides and a skyline behind the north fence
      for (let z = -hd + 2; z <= hd - 2; z += 5.5) {
         out.lamps.push({ x: -hw - 1.7, y: 0, z: z + rng() * 0.8, rotY: 0, scale: 1 });
         out.lamps.push({ x: hw + 1.7, y: 0, z: z + rng() * 0.8, rotY: 0, scale: 1 });
      }
      for (let x = -hw - 6; x <= hw + 6; x += 4.5 + rng() * 2) {
         const w = 2.5 + rng() * 2.5;
         const h = 3.5 + rng() * 5.5;
         out.blocks.push({ x: x + rng() * 1.5, y: h / 2, z: -hd - 9 - rng() * 5, sx: w, sy: h, sz: 3 });
      }
   }
   if (id === 3) {
      // the forest park: a second, taller tree wall closes in behind the fence, with stumps and boulders
      for (let x = -hw - 5; x <= hw + 5; x += 4) out.trees.push({ x: x + (rng() - 0.5) * 1.5, y: 0, z: -hd - 7.5 - rng() * 3, rotY: rng() * 6.28, scale: 4.6 + rng() * 2 });
      for (let z = -hd + 1; z <= hd - 5; z += 6.5) {
         out.trees.push({ x: -hw - 6.5 - rng() * 2, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 4.2 + rng() * 1.8 });
         out.trees.push({ x: hw + 6.5 + rng() * 2, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 4.2 + rng() * 1.8 });
      }
      for (const [x, z] of [[-hw - 2.2, -hd * 0.4], [hw + 2.4, -hd * 0.1], [-hw - 3, hd * 0.4], [hw + 3.2, hd * 0.55], [-hw * 0.5, -hd - 4.5]] as const)
         out.stumps.push({ x: x + rng() * 0.6, y: 0, z: z + rng() * 0.6, rotY: rng() * 6.28, scale: 0.8 + rng() * 0.5 });
      for (const [x, z, s] of [[-hw - 1.8, -hd + 1.5, 1.2], [hw + 2, -hd + 3, 1.5], [hw + 1.8, hd * 0.3, 1.1], [-hw - 2.5, hd * 0.15, 0.9]] as const)
         out.rocks.push({ x, y: 0, z, rotY: rng() * 6.28, scale: s });
   }
   if (id === 4) {
      // the beach park: umbrellas along both sides, boulders on the sand and by the paths
      for (let z = -hd + 2.5; z <= hd - 3; z += 6.5) {
         out.umbrellasA.push({ x: -hw - 2.4, y: 0, z: z + rng() * 0.8, rotY: rng() * 6.28, scale: 0.9 + rng() * 0.25 });
         out.umbrellasB.push({ x: hw + 2.4, y: 0, z: z + rng() * 0.8, rotY: rng() * 6.28, scale: 0.9 + rng() * 0.25 });
      }
      for (const [x, z, s] of [[-hw - 2, -hd + 2, 1.4], [hw + 2.2, -hd + 1.5, 1.2], [-hw - 2.2, 0, 1.3], [hw + 2, hd * 0.35, 1]] as const)
         out.rocks.push({ x, y: 0, z, rotY: rng() * 6.28, scale: s });
      // flat rocks on the outer beach (the south side stays low for the camera)
      for (let x = -hw + 2; x <= hw - 2; x += 7) out.rocks.push({ x: x + rng() * 1.5, y: 0, z: hd + 1.6 + rng() * 0.8, rotY: rng() * 6.28, scale: 0.7 + rng() * 0.3 });
   }
   if (id === 5) {
      // the festival: striped tents and an agility course behind the north fence
      for (const x of [-hw * 0.6, 0, hw * 0.6]) out.tents.push({ x, y: 0, z: -hd - 2.2, rotY: 0, scale: 2.6 });
      out.tunnels.push({ x: -hw * 0.3, y: 0, z: -hd - 5.5, rotY: Math.PI / 2, scale: 2.4 });
      out.hurdles.push({ x: hw * 0.3, y: 0, z: -hd - 5.5, rotY: 0, scale: 1.4 });
      out.hurdles.push({ x: hw * 0.3 + 2.2, y: 0, z: -hd - 5.5, rotY: 0, scale: 1.4 });
      // bunting along the fence (outside it, high enough never to hide the dog), balloons behind the tents
      const bunting = (x0: number, z0: number, x1: number, z1: number, rotY: number) => {
         const len = Math.hypot(x1 - x0, z1 - z0);
         out.flagLines.push({ x: (x0 + x1) / 2, y: 2.05, z: (z0 + z1) / 2, rotY, sx: len, sy: 0.018, sz: 0.018 });
         const n = Math.floor(len / 1.1);
         for (let i = 0; i <= n; i++) {
            const t = n === 0 ? 0.5 : i / n;
            const sag = 0.12 * Math.sin(Math.PI * t);
            const spot = { x: x0 + (x1 - x0) * t, y: 2.03 - sag, z: z0 + (z1 - z0) * t, rotY, sx: 0.5, sy: 0.62, sz: 1 };
            (i % 2 === 0 ? out.flagsA : out.flagsB).push(spot);
         }
      };
      bunting(-hw - 1.0, -hd - 1.0, hw + 1.0, -hd - 1.0, 0);
      bunting(-hw - 1.0, -hd - 1.0, -hw - 1.0, hd * 0.45, Math.PI / 2);
      bunting(hw + 1.0, -hd - 1.0, hw + 1.0, hd * 0.45, Math.PI / 2);
      for (const cx of [-hw * 0.55, 0, hw * 0.55]) {
         for (let i = 0; i < 4; i++) {
            const spot = { x: cx + (rng() - 0.5) * 1.6, y: 2.5 + rng() * 0.9, z: -hd - 1.6 - rng() * 1.4, rotY: 0, scale: 0.45 + rng() * 0.15 };
            (i % 2 === 0 ? out.balloonsA : out.balloonsB).push(spot);
         }
      }
   }
   return out;
}

/** The picket fence: one instanced picket every metre and a half around the lawn. */
export function fenceSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const h = 1.1;
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const step = 1.2;
   const add = (x: number, z: number) => spots.push({ x, y: h / 2, z, sx: 0.08, sy: h, sz: 0.08 });
   for (let x = -hw; x <= hw + 1e-9; x += step) {
      add(x, -hd);
      add(x, hd);
   }
   for (let z = -hd; z <= hd + 1e-9; z += step) {
      add(-hw, z);
      add(hw, z);
   }
   return spots;
}

/** Two rails between the pickets on every side (unit boxes scaled per spot). */
export function railSpots(level: DogLevel): InstanceSpot[] {
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const spots: InstanceSpot[] = [];
   for (const y of [0.45, 0.9]) {
      spots.push({ x: 0, y, z: -hd, sx: level.width, sy: 0.06, sz: 0.05 });
      spots.push({ x: 0, y, z: hd, sx: level.width, sy: 0.06, sz: 0.05 });
      spots.push({ x: -hw, y, z: 0, sx: 0.05, sy: 0.06, sz: level.depth });
      spots.push({ x: hw, y, z: 0, sx: 0.05, sy: 0.06, sz: level.depth });
   }
   return spots;
}

/** Mowing stripes: thin lighter strips along z, one per two metres. */
export function stripeSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let x = -level.width / 2 + 1; x < level.width / 2; x += 2) {
      spots.push({ x, y: 0.004, z: 0, sx: 0.9, sy: 0.008, sz: level.depth });
   }
   return spots;
}

/** The sand strip along the south edge on the beach park (L4). */
export function sandSpots(level: DogLevel): InstanceSpot[] {
   // inside the fence, and a beach outside it that runs down to the water
   return [
      { x: 0, y: 0.006, z: level.depth / 2 - 0.9, sx: level.width, sy: 0.012, sz: 1.8 },
      { x: 0, y: 0.006, z: level.depth / 2 + 0.5, sx: level.width + 8, sy: 0.012, sz: 1.0 },
   ];
}

/** A flat blanket disc at the south centre, drawn as a unit cylinder scaled to the pad. */
export function blanketSpot(level: DogLevel): InstanceSpot {
   const b = blanketOf(level);
   return { x: b.x, y: 0.01, z: b.z, sx: 1.5 * 2, sy: 0.02, sz: 1.5 * 2 };
}

export function propSpots(props: readonly Prop[]): InstanceSpot[] {
   return props.map((p) => ({ x: p.x, y: 0, z: p.z, sx: p.r * 2, sy: 0.6, sz: p.r * 2 }));
}

// ---------- canvas textures (drawn once) ----------

/** Lawn grass in a level's palette: a mottled base with short blade strokes, tiled every 4 m. */
export function paintGrass(palette: LawnPalette, ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = palette.lawnBase;
   ctx.fillRect(0, 0, w, h);
   const rng = createRng(4141);
   for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = rng() < 0.5 ? palette.lawnDark : palette.lawnLight;
      const r = 8 + rng() * 22;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.globalAlpha = 0.5;
   ctx.lineWidth = 1;
   for (let i = 0; i < 1400; i++) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.strokeStyle = rng() < 0.5 ? palette.lawnDark : palette.lawnLight;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 3, y - 3 - rng() * 4);
      ctx.stroke();
   }
   ctx.globalAlpha = 1;
}

/** The L1 lawn grass (the original palette), kept as a ready CanvasDraw. */
export function drawGrass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   paintGrass(PALETTES[1], ctx, w, h);
}

/** The picnic blanket: red gingham with a cream border. */
export function drawBlanket(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = COLORS.ginghamWhite;
   ctx.fillRect(0, 0, w, h);
   const n = 8;
   const s = (w - 24) / n;
   for (let i = 0; i < n; i++) {
      ctx.fillStyle = COLORS.ginghamLight;
      ctx.fillRect(12 + i * s, 12, s / 2, h - 24);
      ctx.fillRect(12, 12 + i * s, w - 24, s / 2);
   }
   for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
         ctx.fillStyle = COLORS.gingham;
         ctx.fillRect(12 + i * s, 12 + j * s, s / 2, s / 2);
      }
   ctx.strokeStyle = COLORS.gingham;
   ctx.lineWidth = 6;
   ctx.strokeRect(6, 6, w - 12, h - 12);
}
