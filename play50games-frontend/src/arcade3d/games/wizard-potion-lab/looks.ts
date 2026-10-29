// One palette, the follow camera, and the lab ring. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type LabTheme, type WizardLevel } from "./levels";
import { TABLE_HEIGHT } from "./assets";
import { CAULDRON_BODY, SHELF_R, TABLE_R, type Ingredient, type Run } from "./rules";

export const COLORS = {
   floor: "#4b46a8",
   floorIn: "#5b55c4",
   apron: "#1e1b4b",
   wall: "#6b5f57",
   wallTrim: "#8a7d72",
   shelf: "#6b5f57",
   shelfTrim: "#78716c",
   glow: "#a78bfa",
   accent: "#c4b5fd",
   pot: "#334155",
   potDark: "#1e293b",
   potRim: "#64748b",
   robe: "#5b21b6",
   robeDark: "#3b0764",
   hat: "#312e81",
   skin: "#f1d0b4",
   beard: "#44403c",
   boot: "#1e1b4b",
   table: "#44403c",
   tableTop: "#57534e",
   book: "#7c3aed",
   bookPage: "#e7e5e4",
   candle: "#f5f5f4",
   candleWax: "#fde68a",
   rune: "#c4b5fd",
   brewIdle: "#4c1d95",
} as const;

/**
 * One room per level (levels.ts `theme`). The ingredients, the cauldron, the beacons and the HUD keep
 * COLORS / INGREDIENT_LOOK everywhere; the floor, walls, glow and the props round the room change.
 */
export interface LabLook {
   floorGlow: string;
   floorIn: string;
   wall: string;
   wallTrim: string;
   rune: string;
   glow: string;
   /** the theme's props (Room.tsx) */
   props: "none" | "mushrooms" | "crystals" | "forest" | "tower";
}

export const LAB_THEMES: Record<LabTheme, LabLook> = {
   beginner: { floorGlow: COLORS.floor, floorIn: COLORS.floorIn, wall: COLORS.wall, wallTrim: COLORS.wallTrim, rune: COLORS.rune, glow: COLORS.glow, props: "none" },
   // a damp cellar: mossy flagstones, green glow, giant glowing mushrooms over the walls
   mushroom: { floorGlow: "#2f6b3a", floorIn: "#3f7d43", wall: "#4a3b2c", wallTrim: "#6b5440", rune: "#bef264", glow: "#84cc16", props: "mushrooms" },
   // an ice-crystal cave: icy floor, cyan glow, crystal spires, a crystal rail under the sliding ingredient
   crystal: { floorGlow: "#1e5a8a", floorIn: "#2b78b0", wall: "#334a6b", wallTrim: "#7dd3fc", rune: "#a5f3fc", glow: "#22d3ee", props: "crystals" },
   // a lab grown into the forest: warm wood floor, amber glow, trees over the walls, drifting leaves
   forest: { floorGlow: "#7a4a22", floorIn: "#8f5a2b", wall: "#4d3a24", wallTrim: "#65a30d", rune: "#fcd34d", glow: "#f59e0b", props: "forest" },
   // the master's tower: midnight floor with gold runes, gold trim, books orbiting over the walls
   master: { floorGlow: "#3b2a8a", floorIn: "#4c3aa8", wall: "#2e2a4f", wallTrim: "#eab308", rune: "#fde047", glow: "#c084fc", props: "tower" },
};

/** HUD shape and stand-in, one per shelf mesh, in TYPES order. */
export const INGREDIENT_LOOK: Record<Ingredient, { shape: "circle" | "square" | "triangle" | "diamond" | "star" | "drop"; color: string }> = {
   mushroom: { shape: "circle", color: "#fb923c" },
   crystal: { shape: "square", color: "#67e8f9" },
   berry: { shape: "triangle", color: "#fb7185" },
   flower: { shape: "diamond", color: "#f0abfc" },
   herb: { shape: "star", color: "#86efac" },
   bottle: { shape: "drop", color: "#c4b5fd" },
};

export const PITCH = (52 * Math.PI) / 180;
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 46;
export const FOLLOW = 1;
/** What must stay on screen around the wizard (m): a big lab scrolls under the camera. */
export const WINDOW = { w: 13, d: 9 } as const;
export const DAMPING = 4;

export function fogFor(level: WizardLevel): [string, number, number] {
   return [level.background, level.radius * 3.4, level.radius * 8];
}

export function labBox(level: WizardLevel): AABB {
   const s = level.radius + 0.9;
   return { min: { x: -s, y: 0, z: -s }, max: { x: s, y: 2.6, z: s } };
}

/** The window round the camera aim that the fit keeps on screen. */
export function windowBox(level: WizardLevel): AABB {
   const s = level.radius + 0.9;
   const w = Math.min(s, WINDOW.w / 2);
   const d = Math.min(s, WINDOW.d / 2);
   return { min: { x: -w, y: 0, z: -d }, max: { x: w, y: 2.6, z: d } };
}

/** Where the camera aim may go: the lab shrunk by half the window, so the lab edge never leaves the frame. */
export function aimBounds(level: WizardLevel): AABB {
   const s = level.radius + 0.9;
   const w = Math.min(s, WINDOW.w / 2);
   const d = Math.min(s, WINDOW.d / 2);
   return { min: { x: -(s - w), y: 0, z: -(s - d) }, max: { x: s - w, y: 2.6, z: s - d } };
}

export function lookAtFor(): [number, number, number] {
   return [0, 0.45, 0];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The whole lab stays in frame. The look point is the cauldron, biased a little toward the wizard. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = windowBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: [{ x: 0, y: 0.45, z: 0 }],
         margin: { top: 0.06, right: 0.03, bottom: 0.07, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Ring of wall slabs. Unit boxes; the spot scale is the size. */
export function wallSpots(level: WizardLevel): InstanceSpot[] {
   const n = 18;
   const t = 0.26;
   const h = 2.35;
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = 2 * level.radius * Math.sin(Math.PI / n) * 1.04;
      spots.push({
         x: Math.sin(a) * (level.radius + t * 0.2),
         y: h / 2,
         z: Math.cos(a) * (level.radius + t * 0.2),
         rotY: a,
         sx: len,
         sy: h,
         sz: t,
      });
   }
   return spots;
}

/**
 * The wall ring as axis-aligned boxes for the camera collision (core/camera). A segment is turned
 * by rotY, so its box is the bounds of its turned footprint (a little wider than the wall at the
 * diagonals, which only makes the camera stop a touch earlier).
 */
export function wallBoxes(walls: readonly InstanceSpot[], out: AABB[]): number {
   let n = 0;
   for (const w of walls) {
      if (n >= out.length) break;
      const a = w.rotY ?? 0;
      const half = (w.sx ?? 1) / 2;
      const thick = (w.sz ?? 1) / 2;
      const hx = half * Math.abs(Math.cos(a)) + thick * Math.abs(Math.sin(a));
      const hz = half * Math.abs(Math.sin(a)) + thick * Math.abs(Math.cos(a));
      const hy = (w.sy ?? 1) / 2;
      const b = out[n++];
      b.min.x = w.x - hx; b.max.x = w.x + hx;
      b.min.y = w.y - hy; b.max.y = w.y + hy;
      b.min.z = w.z - hz; b.max.z = w.z + hz;
   }
   return n;
}

/** Tops (m) of the round obstacles for the camera solids. The cauldron and the shelves are not measured: a box to these heights. */
const CAULDRON_TOP = 1.0;
const SHELF_TOP = 1.6;

/**
 * The round obstacles rules.ts pushes the hero off (resolve), as boxes for the camera solids: the
 * cauldron at the centre, every shelf, the table. Each box is the circle's bounds.
 */
export function obstacleBoxes(run: Run): AABB[] {
   const boxes: AABB[] = [];
   const add = (x: number, z: number, r: number, top: number) => {
      boxes.push({ min: { x: x - r, y: 0, z: z - r }, max: { x: x + r, y: top, z: z + r } });
   };
   add(0, 0, CAULDRON_BODY, CAULDRON_TOP);
   for (const shelf of run.shelves) add(shelf.x, shelf.z, SHELF_R, SHELF_TOP);
   add(run.table.x, run.table.z, TABLE_R, TABLE_HEIGHT);
   return boxes;
}

/** The top view's distance (m): the default 15 m, or half the fog's start where the lab is smaller, so the top view stays inside the clear part of the fog. */
export const TOP_DISTANCE = 15;
export function topDistanceFor(level: WizardLevel): number {
   return Math.min(TOP_DISTANCE, fogFor(level)[1] * 0.5);
}

export function wallCapSpots(walls: readonly InstanceSpot[]): InstanceSpot[] {
   return walls.map((spot) => ({ ...spot, y: 2.35, sy: 0.1 }));
}

/** Short candles against the wall. Count follows the quality tier. */
export function candleSpots(level: WizardLevel, decor: number): InstanceSpot[] {
   const n = Math.max(4, Math.round(10 * decor));
   const spots: InstanceSpot[] = [];
   const orbit = level.radius - 0.42;
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.17;
      spots.push({ x: Math.sin(a) * orbit, y: 0, z: Math.cos(a) * orbit, rotY: a });
   }
   return spots;
}

/** Flat runes on the floor, inside the walk. Never between the camera and the wizard's torso. */
export function runeSpots(level: WizardLevel, decor: number): InstanceSpot[] {
   const n = Math.max(0, Math.round(8 * decor));
   const spots: InstanceSpot[] = [];
   const orbit = level.radius * 0.55;
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spots.push({
         x: Math.sin(a) * orbit,
         y: 0.02,
         z: Math.cos(a) * orbit,
         rotY: a,
         sx: 0.34,
         sy: 0.02,
         sz: 0.34,
      });
   }
   return spots;
}

/** A flagstone floor drawn once: grey-violet slabs with mortar lines and a little grain (one tile = one metre). */
export function drawFlagstones(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = "#8d86c9";
   ctx.fillRect(0, 0, w, h);
   const n = 2;
   const cw = w / n;
   const ch = h / n;
   for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
         const v = Math.imul(r * 7 + c + 3, 2654435761) >>> 0;
         const shade = 150 + (v % 40);
         ctx.fillStyle = `rgb(${shade - 12}, ${shade - 16}, ${shade + 38})`;
         ctx.fillRect(c * cw + 4, r * ch + 4, cw - 8, ch - 8);
      }
   }
   for (let i = 0; i < 900; i++) {
      const v = Math.imul(i + 1, 2246822519) >>> 0;
      ctx.fillStyle = v % 3 === 0 ? "rgba(255,255,255,0.07)" : "rgba(30,20,80,0.10)";
      ctx.fillRect(v % w, (v >>> 9) % h, 1 + (v % 2), 1 + ((v >>> 4) % 2));
   }
   ctx.strokeStyle = "rgba(30,20,80,0.55)";
   ctx.lineWidth = 6;
   ctx.strokeRect(0, 0, w, h);
   ctx.beginPath();
   ctx.moveTo(cw, 0);
   ctx.lineTo(cw, h);
   ctx.moveTo(0, ch);
   ctx.lineTo(w, ch);
   ctx.stroke();
}

export interface LabDecor {
   shelves: InstanceSpot[];
   cauldrons: InstanceSpot[];
   candles: InstanceSpot[];
}

/** Lab dressing beyond the wall ring (never inside the play area): bookshelves, cauldrons and tall candles. */
export function labDecor(level: WizardLevel): LabDecor {
   const out: LabDecor = { shelves: [], cauldrons: [], candles: [] };
   const nShelves = Math.round(level.radius * 1.7);
   for (let i = 0; i < nShelves; i++) {
      const a = (i / nShelves) * Math.PI * 2 + 0.1;
      const r = level.radius + 1.5;
      out.shelves.push({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, rotY: a + Math.PI, scale: 1.5 });
   }
   for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const r = level.radius + 3.2;
      out.cauldrons.push({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, rotY: a, scale: 1.6 });
   }
   for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const r = level.radius + 2.4;
      out.candles.push({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, rotY: a, scale: 3 });
   }
   return out;
}
