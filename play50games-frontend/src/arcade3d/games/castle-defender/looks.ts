import type { LevelId } from "@/arcade3d/types";
import type { LightingPreset } from "@/arcade3d/core/types";
// Castle Defender's look. Pure data: palette, fog, the flat field, and every decorative
// position. Gameplay places (wall front z 2.5, lanes, cannon, gate, towers) stay put.
// No React, no three.js — the scene uploads these buffers.
import { rngNext } from "@/arcade3d/core/math";
import { CAMERA } from "./camera";

/** The fitted view's far edge must stay unfogged. Fog is measured from this camera. */
export const VIEW_CAMERA = { x: CAMERA.position[0], y: CAMERA.position[1], z: CAMERA.position[2] };

/**
 * Playable picture. Decor instances stay outside this rect (the fitted hull).
 * The wall, gate, towers and cannon are the castle, not decor.
 */
export const FIELD = { x0: -5.6, x1: 5.6, z0: -7.3, z1: 3.5 } as const;

/** Hills stay flat through here, then rise. The field sits inside it. */
export const FLAT = { x: 7.05, z0: -8.05, z1: 4.8 } as const;

/** Far-left river. The water plane covers it; the hill mesh leaves it open. */
export const RIVER = { x0: -15.6, x1: -8.7, z0: -20.5, z1: 9 } as const;
export const WATER = { x: -12.15, y: 0.035, z: -5.5, width: 6.5, depth: 28 } as const;

export const LANES = [-3, 0, 3] as const;
/** Cobble strips on the lanes, z -6.8 to 2. Above the meadow so they win the depth test. */
export const ROAD = { z0: -6.8, z1: 2, y: 0.022, edgeY: 0.012, half: 0.6, edge: 0.28 } as const;

export const WALL_FRONT = 2.5;
const WALL_D = 1.2;
const WALL_Z = WALL_FRONT + WALL_D / 2;

export const TOWERS = [
   { x: -6.5, y: 0, z: 3 },
   { x: 6.5, y: 0, z: 3 },
] as const;

/** Cloth and birds hold still when the player prefers reduced motion. */
export const BIRDS = { count: 5, centerX: 1.2, centerZ: -15.5, radiusX: 3.2, radiusZ: 2.1, y: 8.4 } as const;
export const CLOUD_DRIFT = 1.4;

export const COLORS = {
   skyTop: "#355070",
   sky: "#f6c59a",
   fog: "#f6c59a",
   grass: "#c5d68a",
   grassSun: "#dce8a4",
   grassShade: "#8ea84d",
   grassDeep: "#5f7a34",
   stone: "#e4d2b4",
   cobble: "#cbbba4",
   cobbleEdge: "#a89880",
   banner: "#1e3a8a",
   gold: "#e8b84a",
   wood: "#8a4b24",
   water: "#1a8a96",
   waterDeep: "#0e4c5a",
   foam: "#f8efe4",
   lantern: "#fbbf24",
   lanternBody: "#9a3412",
   cloud: "#fffaf3",
   bird: "#3f2e24",
   pineA: "#6d9a3c",
   pineB: "#3e6b32",
   round: "#8fad4a",
   trunk: "#7a4a2a",
   flowerA: "#e11d48",
   flowerB: "#e8b84a",
   tuft: "#6b8f3a",
   rock: "#b5a48e",
   pennant: "#fb923c",
   shieldWood: "#b45309",
   // per-copy tints MULTIPLY the goblin GLB's own green-grey texture: light values keep the bodies
   // readable (dark ones drew near-black silhouettes in the playtest) while the hue still tells the types
   goblin: {
      walker: "#65a30d",
      shield: "#60a5fa",
      runner: "#fb923c",
      crew: "#a78bfa",
   },
} as const;

/** Core lighting plus matching sky/fog; only scenery changes, never target rules. */
export const LEVEL_LOOKS: Record<LevelId, { top: string; bottom: string; lighting: LightingPreset }> = {
   1: { top: COLORS.skyTop, bottom: COLORS.sky, lighting: "sunset" },
   2: { top: "#5f9ec2", bottom: "#d8edf0", lighting: "day" },
   3: { top: COLORS.skyTop, bottom: COLORS.sky, lighting: "sunset" },
   4: { top: "#081325", bottom: "#15243d", lighting: "night" },
   5: { top: "#352c52", bottom: "#b96a57", lighting: "sunset" },
};

/**
 * The goblin GLB's average texture colour (its light green-grey base, catalog §14), for estimating the
 * DRAWN colour of a tinted copy: drawn = tint x base, per channel.
 */
export const GOBLIN_GLB_BASE = "#a6b08f";

/** Linear fog. `near` is past the far field edge for VIEW_CAMERA, so the meadow stays crisp. */
export const FOG = { near: 46, far: 86 } as const;

export function inField(x: number, z: number): boolean {
   return x >= FIELD.x0 && x <= FIELD.x1 && z >= FIELD.z0 && z <= FIELD.z1;
}

export function inRiver(x: number, z: number): boolean {
   return x >= RIVER.x0 && x <= RIVER.x1 && z >= RIVER.z0 && z <= RIVER.z1;
}

/** Distance from the camera to the far field corners at z = -8 (just past the fitted hull). */
export function farFieldDistance(camera: { x: number; y: number; z: number } = VIEW_CAMERA): number {
   let max = 0;
   for (const x of [FIELD.x0, FIELD.x1]) {
      const d = Math.hypot(x - camera.x, 0 - camera.y, -8 - camera.z);
      if (d > max) max = d;
   }
   return max;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

export function birdPosition(index: number, angle: number): { x: number; y: number; z: number } {
   const spin = angle + index * ((Math.PI * 2) / BIRDS.count);
   return {
      x: BIRDS.centerX + Math.cos(spin) * BIRDS.radiusX,
      y: BIRDS.y,
      z: BIRDS.centerZ + Math.sin(spin) * BIRDS.radiusZ,
   };
}

// ---------- stone ----------

export interface StoneBlock {
   kind: "wall" | "cap" | "merlon" | "arch";
   x: number;
   y: number;
   z: number;
   w: number;
   h: number;
   d: number;
   rz: number;
   /** vertex-colour multiplier on the brick texture (1 = the texture's own colour) */
   shade: number;
}

/** The field-facing side of a block. */
export function blockFrontZ(block: StoneBlock): number {
   return block.z - block.d / 2;
}

function segment(blocks: StoneBlock[], x0: number, x1: number): void {
   const w = x1 - x0;
   const x = (x0 + x1) / 2;
   blocks.push(
      { kind: "wall", x, y: 0.16, z: WALL_Z, w, h: 0.32, d: WALL_D, rz: 0, shade: 0.78 },
      { kind: "wall", x, y: 0.66, z: WALL_Z, w, h: 0.68, d: WALL_D, rz: 0, shade: 1 },
      { kind: "cap", x, y: 1.1, z: WALL_Z + 0.08, w, h: 0.2, d: 1, rz: 0, shade: 1 },
   );
}

/** Coursed wall, set-back cap, merlons, and the gate arch. Wall-body front is z 2.5. */
export function wallBlocks(): StoneBlock[] {
   const blocks: StoneBlock[] = [];
   segment(blocks, -6, -1.05);
   segment(blocks, 1.05, 6);
   for (let i = 0, x = -5.55; x <= 5.55; i++, x += 0.9) {
      if (Math.abs(x) < 1.45) continue;
      blocks.push({
         kind: "merlon", x, y: 1.36, z: 3.2, w: 0.46, h: 0.32, d: 0.55, rz: 0, shade: i % 2 ? 0.92 : 1,
      });
   }
   for (const side of [-1, 1]) {
      blocks.push({
         kind: "arch", x: side * 1.22, y: 1.025, z: 2.48, w: 0.42, h: 2.05, d: 0.48, rz: 0, shade: 0.96,
      });
   }
   const voussoirs = 7;
   for (let i = 0; i < voussoirs; i++) {
      const a = (Math.PI * (i + 0.5)) / voussoirs;
      const radius = 1.22;
      blocks.push({
         kind: "arch",
         x: Math.cos(a) * radius,
         y: 2.05 + Math.sin(a) * radius,
         z: 2.48,
         w: 0.4,
         h: 0.34,
         d: 0.48,
         rz: a - Math.PI / 2,
         shade: i === 3 ? 1 : 0.94,
      });
   }
   return blocks;
}

// ---------- meshes (positions + vertex colours) ----------

export interface ColoredMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

function rgbOf(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const GRASS_TONES = [rgbOf(COLORS.grassSun), rgbOf(COLORS.grass), rgbOf(COLORS.grassShade), rgbOf(COLORS.grassDeep)];
const COBBLE = rgbOf(COLORS.cobble);
const COBBLE_EDGE = rgbOf(COLORS.cobbleEdge);

function flatZone(x: number, z: number): boolean {
   return Math.abs(x) <= FLAT.x && z >= FLAT.z0 && z <= FLAT.z1;
}

/** 0 on the meadow and in the river; a low roll beyond x ±7 and z < -8. */
export function hillHeight(x: number, z: number): number {
   if (flatZone(x, z) || inRiver(x, z)) return 0;
   const dx = Math.max(0, Math.abs(x) - FLAT.x);
   const dz = Math.max(0, FLAT.z0 - z, z - FLAT.z1);
   const dist = Math.hypot(dx, dz);
   const roll = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(x * 0.31) * Math.cos(z * 0.23));
   const rise = Math.min(1, dist / 5);
   return Math.min(3.2, rise * rise * (0.35 + 2.4 * roll));
}

function faceColor(x: number, z: number, y: number): [number, number, number] {
   const i = Math.abs(Math.floor(x * 2) + Math.floor(z * 3) * 5) % 4;
   if (y > 1.7) return GRASS_TONES[0];
   if (y > 0.85) return GRASS_TONES[i % 2];
   return GRASS_TONES[i];
}

export function hillMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const x0 = -22;
   const x1 = 22;
   const z0 = -24;
   const z1 = 9;
   const step = 1.85;
   const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
      const y = (ay + by + cy) / 3;
      const tone = faceColor((ax + bx + cx) / 3, (az + bz + cz) / 3, y);
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      for (let k = 0; k < 3; k++) col.push(tone[0], tone[1], tone[2]);
   };
   for (let z = z0; z < z1 - 1e-6; z += step) {
      for (let x = x0; x < x1 - 1e-6; x += step) {
         const x2 = Math.min(x1, x + step);
         const z2 = Math.min(z1, z + step);
         const h00 = hillHeight(x, z);
         const h10 = hillHeight(x2, z);
         const h01 = hillHeight(x, z2);
         const h11 = hillHeight(x2, z2);
         if (h00 + h10 + h01 + h11 < 1e-4) continue;
         // CCW from above, so the normal points up
         push(x, h00, z, x, h01, z2, x2, h10, z);
         push(x2, h10, z, x, h01, z2, x2, h11, z2);
      }
   }
   return { positions: Float32Array.from(pos), colors: Float32Array.from(col), triangles: pos.length / 9 };
}

function quad(pos: number[], col: number[], x0: number, x1: number, z0: number, z1: number, y: number, tone: [number, number, number]): void {
   const verts = [x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1];
   pos.push(...verts);
   for (let k = 0; k < 6; k++) col.push(tone[0], tone[1], tone[2]);
}

export function roadMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   for (const lane of LANES) {
      quad(pos, col, lane - ROAD.half, lane + ROAD.half, ROAD.z0, ROAD.z1, ROAD.y, COBBLE);
      quad(pos, col, lane - ROAD.half - ROAD.edge, lane - ROAD.half, ROAD.z0, ROAD.z1, ROAD.edgeY, COBBLE_EDGE);
      quad(pos, col, lane + ROAD.half, lane + ROAD.half + ROAD.edge, ROAD.z0, ROAD.z1, ROAD.edgeY, COBBLE_EDGE);
   }
   return { positions: Float32Array.from(pos), colors: Float32Array.from(col), triangles: pos.length / 9 };
}

// ---------- decor outside the field ----------

export interface DecorSpot {
   kind: "pine" | "round" | "rock" | "flower" | "tuft" | "cloud";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

function nearTower(x: number, z: number): boolean {
   for (const t of TOWERS) if ((x - t.x) ** 2 + (z - t.z) ** 2 < 2.7 * 2.7) return true;
   return false;
}

function buildDecor(): DecorSpot[] {
   const rng = { s: 0x5a17c };
   const spots: DecorSpot[] = [];
   const rand = () => rngNext(rng);
   const tooClose = (x: number, z: number, min: number) => {
      for (const s of spots) {
         const dx = s.x - x;
         const dz = s.z - z;
         if (dx * dx + dz * dz < min * min) return true;
      }
      return false;
   };
   const scatter = (
      kind: DecorSpot["kind"],
      count: number,
      box: { x0: number; x1: number; z0: number; z1: number },
      margin: number,
      scale: [number, number],
      gap: number,
      toneOf: (n: number) => number,
      squash = 1,
   ) => {
      let placed = 0;
      for (let guard = 0; placed < count && guard < 4000; guard++) {
         const x = box.x0 + rand() * (box.x1 - box.x0);
         const z = box.z0 + rand() * (box.z1 - box.z0);
         const clear = x < FIELD.x0 - margin || x > FIELD.x1 + margin || z < FIELD.z0 - margin || z > FIELD.z1 + margin;
         if (!clear || inField(x, z) || inRiver(x, z) || nearTower(x, z) || tooClose(x, z, gap)) continue;
         const s = scale[0] + rand() * (scale[1] - scale[0]);
         spots.push({
            kind, tone: toneOf(placed), x, y: 0, z, rotY: rand() * Math.PI * 2,
            sx: s, sy: s * squash, sz: s * (kind === "rock" ? 0.75 + rand() * 0.4 : 1),
         });
         placed++;
      }
      if (placed < count) throw new Error(`castle look: placed ${placed}/${count} ${kind}`);
   };
   // pines and round trees stand well clear of the fitted hull, so a crown cannot cover a lane
   scatter("pine", 8, { x0: 7.6, x1: 16, z0: -8, z1: 5.2 }, 1.7, [0.85, 1.4], 2.2, (n) => n % 2);
   scatter("pine", 6, { x0: -18, x1: -15.9, z0: -6, z1: 5 }, 1.7, [0.9, 1.45], 2.2, (n) => n % 2);
   scatter("round", 5, { x0: -16, x1: 16, z0: -21, z1: -9.3 }, 1.7, [0.8, 1.35], 2.4, () => 0);
   scatter("pine", 4, { x0: -16, x1: 16, z0: -21, z1: -9.3 }, 1.7, [1, 1.6], 2.6, (n) => n % 2);
   scatter("round", 4, { x0: 8.2, x1: 15, z0: 5.4, z1: 8 }, 1.7, [0.75, 1.15], 2.2, () => 0);
   scatter("rock", 10, { x0: 6.2, x1: 14, z0: -8.6, z1: 4.6 }, 0.5, [0.4, 0.85], 1.1, (n) => n % 2, 0.62);
   scatter("rock", 6, { x0: -14, x1: -6.2, z0: -8.2, z1: 4.2 }, 0.5, [0.35, 0.7], 1.1, (n) => n % 2, 0.62);
   scatter("flower", 8, { x0: 6.15, x1: 11, z0: -8.4, z1: 4.2 }, 0.4, [0.75, 1.25], 0.7, (n) => n % 2);
   scatter("flower", 6, { x0: -8.4, x1: -6.15, z0: -7.6, z1: 3.8 }, 0.4, [0.7, 1.2], 0.7, (n) => n % 2);
   scatter("tuft", 12, { x0: 6.1, x1: 12, z0: -8.8, z1: 4.4 }, 0.35, [0.65, 1.25], 0.55, () => 0);
   scatter("tuft", 8, { x0: -10, x1: -6.1, z0: -8, z1: 4 }, 0.35, [0.6, 1.15], 0.55, () => 0);
   scatter("tuft", 6, { x0: -6, x1: 6, z0: -10.5, z1: -8 }, 0.35, [0.7, 1.2], 0.6, () => 0);
   const clouds: Array<[number, number, number, number]> = [
      [-8, 12.2, -16.2, 1],
      [-1.5, 13, -18.4, 1.15],
      [6.5, 11.8, -15.6, 0.9],
      [13, 12.6, -17.2, 1.05],
   ];
   for (const [x, y, z, s] of clouds) {
      spots.push({ kind: "cloud", tone: 0, x, y, z, rotY: 0, sx: 2.8 * s, sy: 0.72 * s, sz: 1.7 * s });
   }
   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind && (tone === undefined || spot.tone === tone));
}
