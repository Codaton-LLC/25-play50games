// Dino Egg Rescue look. Pure data: palette, fog, valley terrain, and every decorative position.
// Gameplay places (valley bounds, nest, mud pits, boulder lanes, trees) stay put.
// No React, no three.js — Scene.tsx and Valley.tsx upload these buffers.
import { rngNext } from "@/arcade3d/core/math";

/** Playable valley bounds. Decor instances stay strictly outside this rect. */
export const VALLEY_FIELD = { x0: -15, x1: 15, z0: -11, z1: 11 } as const;

/** Hills and perimeter ridges stay flat through here (height 0), then rise outside. */
export const VALLEY_FLAT = { x0: -15.3, x1: 15.3, z0: -11.3, z1: 11.3 } as const;

/** Main volcano backdrop position outside valley bounds at NE. */
export const MAIN_VOLCANO = { x: 16, y: 0, z: -13, radius: 5.5 } as const;

/** Default follow camera position relative to target (pitch 50 deg). */
export const CAMERA_OFFSET = { x: 0, y: 16, z: 13.4 } as const;

/** Pterosaurs soaring in the northern sky distance. */
export const PTEROSAURS = {
   count: 3,
   centerX: 0,
   centerZ: -22,
   radiusX: 14,
   radiusZ: 4.5,
   y: 13.5,
} as const;

export const CLOUD_DRIFT = 2.0;

/** One unified prehistoric jungle sunset palette. */
export const COLORS = {
   // Sky & Haze (warm prehistoric sunset)
   skyTop: "#312e81",
   skyBottom: "#ea580c",
   skyHorizon: "#f97316",
   fog: "#ea580c",
   sun: "#fed7aa",

   // Valley Terrain & Grass (lush prehistoric jungle)
   grass: "#65a30d",
   grassSun: "#84cc16",
   grassShade: "#4d7c0f",
   grassDeep: "#365314",
   soil: "#78350f",
   soilWarm: "#92400e",

   // Perimeter Rock & Knolls
   ridgeRock: "#57534e",
   ridgeRockDark: "#44403c",
   ridgeGrass: "#4d7c0f",

   // Mud Pits (rich layered wet mud)
   mudDark: "#381e09",
   mud: "#582f0e",
   mudRim: "#78350f",
   mudBubble: "#854d0e",

   // Gully Lanes & Danger Warning
   gullyBed: "#451a03",
   gullyEdge: "#713f12",
   telegraphWarn: "#ef4444",
   telegraphGlow: "#dc2626",

   // Nest (warm braided golden straw)
   straw: "#eab308",
   strawLight: "#fef08a",
   strawDark: "#ca8a04",
   strawRim: "#b45309",
   nestRing: "#facc15",

   // Volcano & Magma
   volcanoRock: "#292524",
   volcanoDark: "#1c1917",
   volcanoAsh: "#44403c",
   volcanoWarm: "#78350f",
   lavaGlow: "#f97316",
   lavaCore: "#fbbf24",
   lavaCrust: "#9a3412",

   // Dino (Player - baby dino with high readability)
   dinoSkin: "#84cc16",
   dinoBelly: "#bef264",
   dinoFrill: "#f97316",
   dinoEye: "#0f172a",
   dinoEyeWhite: "#f8fafc",

   // Boulders (faceted volcanic rock)
   boulder: "#57534e",
   boulderDark: "#292524",
   boulderWarm: "#78716c",
   boulderVein: "#c2410c",

   // Eggs (regular spotted & golden high-value)
   eggShell: "#fef08a",
   eggSpots: "#ca8a04",
   eggGlow: "#a3e635",
   eggGlowCore: "#65a30d",
   goldenEgg: "#facc15",
   goldenEggGlow: "#fde047",
   goldenEggCore: "#eab308",

   // Trees & Surroundings Foliage
   bark: "#78350f",
   barkDark: "#451a03",
   leafLight: "#84cc16",
   leafMedium: "#65a30d",
   leafDark: "#3f6212",

   // Instanced Decor
   fernA: "#4ade80",
   fernB: "#16a34a",
   fernStem: "#15803d",
   palmTrunk: "#854d0e",
   palmLeafA: "#65a30d",
   palmLeafB: "#365314",
   rock: "#78716c",
   rockMoss: "#4d7c0f",
   volcanoSilhouette: "#1c1917",
   volcanoSilhouetteGlow: "#ea580c",
   cloud: "#fed7aa",
   cloudSunset: "#fb923c",
   pterosaur: "#431407",
   pterosaurCrest: "#ea580c",

   // UI & FX Accents
   dashReady: "#38bdf8",
   dashCooldown: "#94a3b8",
   stunStar: "#fde047",
   graceShield: "#38bdf8",
} as const;

/** Linear fog: near is past the furthest valley distance so the valley stays crisp and unfogged. */
export const FOG = { near: 52, far: 105 } as const;

/** True if (x, z) is inside the playable valley area, plus an optional margin. */
export function inValley(x: number, z: number, margin = 0): boolean {
   return (
      x >= VALLEY_FIELD.x0 - margin &&
      x <= VALLEY_FIELD.x1 + margin &&
      z >= VALLEY_FIELD.z0 - margin &&
      z <= VALLEY_FIELD.z1 + margin
   );
}

/** True if (x, z) is within the main volcano base circle. */
export function nearMainVolcano(x: number, z: number, clearance = 1.0): boolean {
   const dx = x - MAIN_VOLCANO.x;
   const dz = z - MAIN_VOLCANO.z;
   const radius = MAIN_VOLCANO.radius + clearance;
   return dx * dx + dz * dz < radius * radius;
}

/**
 * Maximum distance from the follow camera to any corner of the valley at any valid target position.
 * Used to ensure FOG.near keeps the entire valley crisp and unfogged.
 */
export function farValleyDistance(): number {
   let max = 0;
   // Test worst-case camera positions where dino is at valley bounds
   for (const dinoX of [VALLEY_FIELD.x0, VALLEY_FIELD.x1]) {
      for (const dinoZ of [VALLEY_FIELD.z0, VALLEY_FIELD.z1]) {
         const camX = dinoX + CAMERA_OFFSET.x;
         const camY = CAMERA_OFFSET.y;
         const camZ = dinoZ + CAMERA_OFFSET.z;
         for (const cornerX of [VALLEY_FIELD.x0, VALLEY_FIELD.x1]) {
            for (const cornerZ of [VALLEY_FIELD.z0, VALLEY_FIELD.z1]) {
               const d = Math.hypot(cornerX - camX, 0 - camY, cornerZ - camZ);
               if (d > max) max = d;
            }
         }
      }
   }
   return max;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return (
         0.2126 * channel((n >> 16) & 255) +
         0.7152 * channel((n >> 8) & 255) +
         0.0722 * channel(n & 255)
      );
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

/** Deterministic flight position of pterosaur index at orbit angle. */
export function pterosaurPosition(
   index: number,
   angle: number
): { x: number; y: number; z: number } {
   const spin = angle + index * ((Math.PI * 2) / PTEROSAURS.count);
   return {
      x: PTEROSAURS.centerX + Math.cos(spin) * PTEROSAURS.radiusX,
      y: PTEROSAURS.y,
      z: PTEROSAURS.centerZ + Math.sin(spin) * PTEROSAURS.radiusZ,
   };
}

// ---------- Terrain perimeter ridges (BufferGeometry data) ----------

export interface ColoredMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

function rgbOf(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const RIDGE_GRASS = rgbOf(COLORS.grassShade);
const RIDGE_ROCK = rgbOf(COLORS.ridgeRock);
const RIDGE_DARK = rgbOf(COLORS.ridgeRockDark);

/**
 * Ridge height: strictly 0 inside the valley flat zone, rising outside into gentle prehistoric cliffs.
 */
export function ridgeHeight(x: number, z: number): number {
   if (
      x >= VALLEY_FLAT.x0 &&
      x <= VALLEY_FLAT.x1 &&
      z >= VALLEY_FLAT.z0 &&
      z <= VALLEY_FLAT.z1
   ) {
      return 0;
   }
   // Main volcano location stays flat on the terrain mesh (the volcano GLB sits there)
   if (nearMainVolcano(x, z, 0.5)) return 0;

   const dx = Math.max(0, VALLEY_FLAT.x0 - x, x - VALLEY_FLAT.x1);
   const dz = Math.max(0, VALLEY_FLAT.z0 - z, z - VALLEY_FLAT.z1);
   const dist = Math.hypot(dx, dz);
   const roll = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(x * 0.28) * Math.cos(z * 0.22));
   const rise = Math.min(1, dist / 6.5);
   return Math.min(4.2, rise * rise * (0.6 + 3.2 * roll));
}

function ridgeColor(y: number): [number, number, number] {
   if (y > 2.5) return RIDGE_DARK;
   if (y > 1.2) return RIDGE_ROCK;
   return RIDGE_GRASS;
}

/** Generates low-poly perimeter ridges surrounding the valley. Zero triangles inside valley. */
export function valleyRidgeMesh(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const x0 = -26;
   const x1 = 26;
   const z0 = -25;
   const z1 = 16;
   const step = 2.0;

   const push = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number
   ) => {
      const avgY = (ay + by + cy) / 3;
      const tone = ridgeColor(avgY);
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      for (let k = 0; k < 3; k++) col.push(tone[0], tone[1], tone[2]);
   };

   for (let z = z0; z < z1 - 1e-5; z += step) {
      for (let x = x0; x < x1 - 1e-5; x += step) {
         const x2 = Math.min(x1, x + step);
         const z2 = Math.min(z1, z + step);
         const h00 = ridgeHeight(x, z);
         const h10 = ridgeHeight(x2, z);
         const h01 = ridgeHeight(x, z2);
         const h11 = ridgeHeight(x2, z2);

         if (h00 + h10 + h01 + h11 < 1e-4) continue;

         // CCW from above, normal pointing up
         push(x, h00, z, x, h01, z2, x2, h10, z);
         push(x2, h10, z, x, h01, z2, x2, h11, z2);
      }
   }

   return {
      positions: Float32Array.from(pos),
      colors: Float32Array.from(col),
      triangles: pos.length / 9,
   };
}

// ---------- Decor spots outside the valley ----------

export interface DecorSpot {
   kind: "fern" | "palm" | "rock" | "volcanoSilhouette" | "cloud";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

function buildDecor(): DecorSpot[] {
   const rng = { s: 0xd170 };
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
      squash = 1
   ) => {
      let placed = 0;
      for (let guard = 0; placed < count && guard < 4000; guard++) {
         const x = box.x0 + rand() * (box.x1 - box.x0);
         const z = box.z0 + rand() * (box.z1 - box.z0);
         const clearOfValley = !inValley(x, z, margin);
         if (!clearOfValley || nearMainVolcano(x, z) || tooClose(x, z, gap)) continue;
         const s = scale[0] + rand() * (scale[1] - scale[0]);
         spots.push({
            kind,
            tone: toneOf(placed),
            x,
            y: 0,
            z,
            rotY: rand() * Math.PI * 2,
            sx: s,
            sy: s * squash,
            sz: s * (kind === "rock" ? 0.75 + rand() * 0.4 : 1),
         });
         placed++;
      }
      if (placed < count) {
         throw new Error(`dino look: placed ${placed}/${count} ${kind}`);
      }
   };

   // 1. Palms: tall prehistoric palms in north background and side flanks (NEVER south)
   scatter("palm", 4, { x0: -20, x1: 9, z0: -19, z1: -13.5 }, 1.2, [0.9, 1.3], 2.8, (n) => n % 2);
   scatter("palm", 4, { x0: -23, x1: -17, z0: -9, z1: 9 }, 1.2, [0.85, 1.25], 2.8, (n) => n % 2);
   scatter("palm", 4, { x0: 17.5, x1: 23, z0: -9, z1: 9 }, 1.2, [0.85, 1.25], 2.8, (n) => n % 2);

   // 2. Ferns: lush prehistoric fronds clustering in background and flanks
   scatter("fern", 6, { x0: -22, x1: 10, z0: -18, z1: -12.5 }, 0.8, [0.75, 1.3], 1.8, (n) => n % 2);
   scatter("fern", 6, { x0: -23, x1: -16.8, z0: -9.5, z1: 9.5 }, 0.8, [0.7, 1.2], 1.8, (n) => n % 2);
   scatter("fern", 6, { x0: 16.8, x1: 23, z0: -9.5, z1: 9.5 }, 0.8, [0.7, 1.2], 1.8, (n) => n % 2);

   // 3. Volcanic Rocks: low-poly faceted boulders outside valley perimeter
   scatter("rock", 6, { x0: -22, x1: 10, z0: -17, z1: -12.5 }, 0.6, [0.5, 1.1], 1.4, (n) => n % 2, 0.7);
   scatter("rock", 5, { x0: -23, x1: -16.5, z0: -9.5, z1: 9.5 }, 0.6, [0.45, 0.95], 1.4, (n) => n % 2, 0.7);
   scatter("rock", 5, { x0: 16.5, x1: 23, z0: -9.5, z1: 9.5 }, 0.6, [0.45, 0.95], 1.4, (n) => n % 2, 0.7);

   // 4. Distant volcano silhouettes in the northern horizon (fading into sunset haze)
   const volcanoPeaks: Array<[number, number, number, number]> = [
      [-22, 0, -33, 1.4],
      [-8, 0, -36, 1.8],
      [8, 0, -34, 1.5],
      [22, 0, -31, 1.3],
   ];
   for (const [x, y, z, s] of volcanoPeaks) {
      spots.push({
         kind: "volcanoSilhouette",
         tone: 0,
         x,
         y,
         z,
         rotY: 0.5,
         sx: s,
         sy: s * 1.1,
         sz: s,
      });
   }

   // 5. Sunset clouds in the upper sky
   const clouds: Array<[number, number, number, number]> = [
      [-14, 17.5, -20, 1.1],
      [-3, 19.0, -23, 1.3],
      [8, 17.0, -19, 1.0],
      [18, 18.5, -22, 1.2],
   ];
   for (const [x, y, z, s] of clouds) {
      spots.push({
         kind: "cloud",
         tone: 0,
         x,
         y,
         z,
         rotY: 0,
         sx: 2.6 * s,
         sy: 0.75 * s,
         sz: 1.8 * s,
      });
   }

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter(
      (spot) => spot.kind === kind && (tone === undefined || spot.tone === tone)
   );
}
