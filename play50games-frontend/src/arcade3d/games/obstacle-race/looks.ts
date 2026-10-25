// Obstacle Race look. Pure data: palette, fog, stadium turf, stands and decor spots.
// No React, no three.js — the scene uploads these buffers.
import type { LevelId } from "../../types";
import type { LightingPreset } from "@/arcade3d/core/types";

export const COLORS = {
   // Sky & Atmosphere
   sky: "#bae6fd",
   skyTop: "#0284c7",
   skyBottom: "#bae6fd",
   fog: "#bae6fd",

   // Stadium & Field
   turf: "#15803d",
   turfLight: "#22c55e",
   turfDark: "#166534",
   deck: "#f8fafc",
   deckEdge: "#e2e8f0",
   coping: "#ffffff",
   deckTile: "#cbd5e1",
   water: "#0ea5e9",
   waterDeep: "#0284c7",

   // Inflatable Obstacles
   padSide: "#2563eb",
   padTop: "#eff6ff",
   checkpointTop: "#c7d2fe",
   checkpointSide: "#4338ca",
   finishTop: "#bbf7d0",
   finishSide: "#15803d",
   rim: "#f59e0b",
   rimHighlight: "#fde047",

   // Sweeper
   discSide: "#dc2626",
   discStripeA: "#ffffff",
   discStripeB: "#fee2e2",
   hub: "#eab308",
   hubCap: "#ea580c",
   barRed: "#dc2626",
   barWhite: "#ffffff",
   barPad: "#b91c1c",

   // Platforms & Blocks
   slab: "#16a34a",
   cushion: "#86efac",
   pillar: "#f8fafc",
   pillarCollar: "#2563eb",
   block: "#f59e0b",
   blockTop: "#fef08a",
   blockTrim: "#d97706",
   rail: "#94a3b8",

   // Balance Beam
   beam: "#9333ea",
   beamTop: "#f3e8ff",
   beamCap: "#7e22ce",

   // Checkpoints & Finish
   line: "#ffffff",
   accent: "#6366f1",
   reached: "#22c55e",
   post: "#f8fafc",
   archLeg: "#dc2626",
   archTop: "#facc15",
   archCap: "#ea580c",

   // Lane Ropes & Effects
   ropeA: "#ef4444",
   ropeB: "#ffffff",
   ropeC: "#2563eb",
   splash: "#e0f2fe",

   // Stand-in Runner
   hoodie: "#f97316",
   hood: "#ea580c",
   pants: "#1e293b",
   shoes: "#f8fafc",
   skin: "#f5c9a3",
   hair: "#3f2a1d",
   band: "#14b8a6",
   pack: "#1d4ed8",
   eye: "#0f172a",

   // Surroundings (Decor)
   standStructure: "#e2e8f0",
   standRoof: "#cbd5e1",
   crowdBlue: "#3b82f6",
   crowdRed: "#ef4444",
   crowdYellow: "#f59e0b",
   crowdGreen: "#10b981",
   flagPole: "#94a3b8",
   flagA: "#3b82f6",
   flagB: "#ef4444",
   flagC: "#f59e0b",
   flagD: "#10b981",
   treeTrunk: "#78350f",
   treePine: "#15803d",
   treeRound: "#22c55e",
   hillA: "#4ade80",
   hillB: "#22c55e",
   cloud: "#ffffff",
} as const;

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", skyTop: COLORS.skyTop, skyBottom: COLORS.skyBottom, fog: COLORS.fog },
   2: { lighting: "day", skyTop: "#0369a1", skyBottom: "#bae6fd", fog: "#bae6fd" },
   3: { lighting: "day", skyTop: "#0284c7", skyBottom: "#e0f2fe", fog: "#e0f2fe" },
   4: { lighting: "night", skyTop: "#020617", skyBottom: "#0f172a", fog: "#0f172a" },
   5: { lighting: "sunset", skyTop: "#2e1065", skyBottom: "#f97316", fog: "#431f30" },
};

/**
 * Play area bounds (world coords).
 * Course runs along progress p from -4 to 122 (z = +4 to -122).
 * Course width is within |x| <= 7.0 (with sweeper radius 6.0 and knock flung up to 6.35).
 * Generous safety hull: |x| <= 15, z between -135 and +15.
 */
export const PLAY_BOUNDS = {
   xMin: -15,
   xMax: 15,
   zMin: -135,
   zMax: 15,
   yMin: -3,
   yMax: 5,
} as const;

export function inPlayBounds(x: number, z: number): boolean {
   return x >= PLAY_BOUNDS.xMin && x <= PLAY_BOUNDS.xMax && z >= PLAY_BOUNDS.zMin && z <= PLAY_BOUNDS.zMax;
}

export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   sx?: number;
   sy?: number;
   sz?: number;
   rotY?: number;
   kind: "stand" | "crowd" | "flagPole" | "flagPennant" | "tree" | "cloud";
   variant?: number;
}

/** Stand module dimensions: 3 stepped tiers. Length along z: 12m, depth along x: 7m. */
export const STAND = {
   length: 12,
   depth: 7,
   height: 3.6,
   leftX: -32,
   rightX: 32,
   backZ: 50,
   farZ: -180,
} as const;

/** Generate stadium stands outside the pool and course. */
export function buildStandSpots(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // Left stands along z = 30 down to -160 (step 14m)
   for (let z = 30; z >= -160; z -= 14) {
      spots.push({ x: STAND.leftX, y: 0.8, z, sx: STAND.depth, sy: STAND.height, sz: STAND.length, rotY: 0, kind: "stand" });
   }

   // Right stands along z = 30 down to -160 (step 14m)
   for (let z = 30; z >= -160; z -= 14) {
      spots.push({ x: STAND.rightX, y: 0.8, z, sx: STAND.depth, sy: STAND.height, sz: STAND.length, rotY: Math.PI, kind: "stand" });
   }

   // Back stands behind start (z = +50), spanning x = -21 to +21
   for (let x = -21; x <= 21; x += 14) {
      spots.push({ x, y: 0.8, z: STAND.backZ, sx: STAND.length, sy: STAND.height, sz: STAND.depth, rotY: Math.PI / 2, kind: "stand" });
   }

   // Far stands beyond finish (z = -180), spanning x = -21 to +21
   for (let x = -21; x <= 21; x += 14) {
      spots.push({ x, y: 0.8, z: STAND.farZ, sx: STAND.length, sy: STAND.height, sz: STAND.depth, rotY: -Math.PI / 2, kind: "stand" });
   }

   return spots;
}

/** Generate spectator spots on each tier of each stand. */
export function buildCrowdSpots(standSpots: readonly DecorSpot[]): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const tiers = [
      { dy: 0.5, offset: -1.6 },
      { dy: 1.5, offset: 0.0 },
      { dy: 2.5, offset: 1.6 },
   ];

   for (let sIdx = 0; sIdx < standSpots.length; sIdx++) {
      const stand = standSpots[sIdx];
      const rot = stand.rotY ?? 0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      for (let t = 0; t < tiers.length; t++) {
         const tier = tiers[t];
         for (let k = -2; k <= 2; k++) {
            const along = k * 2.2;
            const across = tier.offset;
            const wx = stand.x + across * cosR - along * sinR;
            const wz = stand.z + across * sinR + along * cosR;
            const variant = (sIdx * 7 + t * 5 + k + 10) % 4;
            spots.push({
               x: wx,
               y: stand.y + tier.dy,
               z: wz,
               sx: 0.45,
               sy: 0.55,
               sz: 0.45,
               rotY: rot,
               kind: "crowd",
               variant,
            });
         }
      }
   }
   return spots;
}

/** Generate flag poles and pennants along the back wall of each stand. */
export function buildFlagSpots(): { poles: DecorSpot[]; pennants: DecorSpot[] } {
   const poles: DecorSpot[] = [];
   const pennants: DecorSpot[] = [];

   // Flags on the side stands
   for (const side of [-1, 1]) {
      const x = side * (Math.abs(STAND.leftX) + 3.2);
      for (let z = 24; z >= -150; z -= 28) {
         poles.push({ x, y: 3.5, z, sx: 0.08, sy: 2.4, sz: 0.08, kind: "flagPole" });
         pennants.push({ x: x - side * 0.45, y: 4.4, z, sx: 0.9, sy: 0.5, sz: 0.04, kind: "flagPennant", variant: ((Math.abs(z) % 4) + (side > 0 ? 1 : 0)) % 4 });
      }
   }

   // Flags on back and far stands
   for (const x of [-14, 0, 14]) {
      poles.push({ x, y: 3.5, z: STAND.backZ + 3.2, sx: 0.08, sy: 2.4, sz: 0.08, kind: "flagPole" });
      pennants.push({ x, y: 4.4, z: STAND.backZ + 2.75, sx: 0.04, sy: 0.5, sz: 0.9, kind: "flagPennant", variant: (Math.abs(x) % 4) });

      poles.push({ x, y: 3.5, z: STAND.farZ - 3.2, sx: 0.08, sy: 2.4, sz: 0.08, kind: "flagPole" });
      pennants.push({ x, y: 4.4, z: STAND.farZ - 2.75, sx: 0.04, sy: 0.5, sz: 0.9, kind: "flagPennant", variant: (Math.abs(x) + 2) % 4 });
   }

   return { poles, pennants };
}

/** Generate low-poly trees on the outer hills. */
export function buildTreeSpots(): DecorSpot[] {
   const spots: DecorSpot[] = [];
   const addTree = (x: number, z: number, y: number, variant: number, scale = 1) => {
      spots.push({ x, y, z, sx: scale, sy: scale, sz: scale, kind: "tree", variant });
   };

   // Left hills
   for (let z = 50; z >= -190; z -= 22) {
      addTree(-52, z, 1.2, 0, 1.1);
      addTree(-68, z + 7, 3.4, 1, 1.3);
      addTree(-86, z - 5, 5.8, 0, 1.4);
   }

   // Right hills
   for (let z = 50; z >= -190; z -= 22) {
      addTree(52, z, 1.2, 1, 1.1);
      addTree(68, z + 7, 3.4, 0, 1.3);
      addTree(86, z - 5, 5.8, 1, 1.4);
   }

   // Far hills behind finish
   for (let x = -70; x <= 70; x += 24) {
      addTree(x, -215, 4.5, (x % 2 === 0 ? 0 : 1), 1.3);
      addTree(x + 10, -240, 7.8, (x % 2 === 0 ? 1 : 0), 1.5);
   }

   return spots;
}

/** Low-poly fluffy clouds high in the sky. */
export function buildCloudSpots(): DecorSpot[] {
   return [
      { x: -35, y: 34, z: 20, sx: 14, sy: 5, sz: 8, kind: "cloud" },
      { x: 42, y: 36, z: -10, sx: 16, sy: 6, sz: 9, kind: "cloud" },
      { x: -48, y: 38, z: -60, sx: 18, sy: 5.5, sz: 10, kind: "cloud" },
      { x: 38, y: 35, z: -110, sx: 15, sy: 5, sz: 8, kind: "cloud" },
      { x: -30, y: 37, z: -150, sx: 17, sy: 6, sz: 9, kind: "cloud" },
      { x: 25, y: 39, z: -190, sx: 19, sy: 6, sz: 11, kind: "cloud" },
   ];
}

export const STAND_SPOTS = buildStandSpots();
export const CROWD_SPOTS = buildCrowdSpots(STAND_SPOTS);
export const FLAG_SPOTS = buildFlagSpots();
export const TREE_SPOTS = buildTreeSpots();
export const CLOUD_SPOTS = buildCloudSpots();

export const ALL_DECOR_SPOTS: readonly DecorSpot[] = [
   ...STAND_SPOTS,
   ...CROWD_SPOTS,
   ...FLAG_SPOTS.poles,
   ...FLAG_SPOTS.pennants,
   ...TREE_SPOTS,
   ...CLOUD_SPOTS,
];

export interface ColoredMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

function hexToRgb(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Builds the stadium ground terrain: flat turf with mower stripes around the pool,
 * rising into low-poly hills at the perimeter. The pool hole is left open.
 */
export function stadiumTerrainMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];

   const cLight = hexToRgb(COLORS.turfLight);
   const cDark = hexToRgb(COLORS.turfDark);
   const cHillA = hexToRgb(COLORS.hillA);
   const cHillB = hexToRgb(COLORS.hillB);

   // Stadium terrain extends from x = -180 to 180, z = -300 to 120
   // Pool hole: x in [-24.5, 24.5], z in [-170.5, 40.5]
   const xMin = -180;
   const xMax = 180;
   const zMin = -300;
   const zMax = 120;
   const stepX = 12;
   const stepZ = 12;

   const poolX0 = -24.5;
   const poolX1 = 24.5;
   const poolZ0 = -170.5;
   const poolZ1 = 40.5;

   const elevationAt = (x: number, z: number): number => {
      const ax = Math.abs(x);
      let y = -1.0;
      if (ax > 46) {
         const k = Math.min(1, (ax - 46) / 90);
         y += k * k * (14 + 4 * Math.sin(x * 0.05 + z * 0.03));
      }
      if (z < -170) {
         const k = Math.min(1, (-170 - z) / 100);
         y += k * k * 16;
      } else if (z > 42) {
         const k = Math.min(1, (z - 42) / 70);
         y += k * k * 12;
      }
      return y;
   };

   const pushTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      rgb: [number, number, number]
   ) => {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      for (let k = 0; k < 3; k++) col.push(rgb[0], rgb[1], rgb[2]);
   };

   for (let z = zMin; z < zMax; z += stepZ) {
      const z0 = z;
      const z1 = z + stepZ;
      const stripe = Math.floor(z0 / 4) % 2 === 0;

      for (let x = xMin; x < xMax; x += stepX) {
         const x0 = x;
         const x1 = x + stepX;

         // Check if this cell is inside the pool cutout
         const inPool = (x0 >= poolX0 && x1 <= poolX1 && z0 >= poolZ0 && z1 <= poolZ1);
         if (inPool) continue;

         const y00 = elevationAt(x0, z0);
         const y10 = elevationAt(x1, z0);
         const y01 = elevationAt(x0, z1);
         const y11 = elevationAt(x1, z1);

         const isHill = (Math.abs(x0 + x1) / 2 > 48 || z0 < -175 || z1 > 48);
         let rgb: [number, number, number];
         if (isHill) {
            rgb = ((Math.floor(x0 / stepX) + Math.floor(z0 / stepZ)) % 2 === 0) ? cHillA : cHillB;
         } else {
            rgb = stripe ? cLight : cDark;
         }

         // Two triangles per quad
         pushTri(x0, y00, z0, x1, y10, z0, x1, y11, z1, rgb);
         pushTri(x0, y00, z0, x1, y11, z1, x0, y01, z1, rgb);
      }
   }

   const triangles = pos.length / 9;
   return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
      triangles,
   };
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
