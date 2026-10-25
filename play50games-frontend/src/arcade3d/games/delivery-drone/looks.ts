// Delivery Drone's visual look definition. Pure data: palette, play bounds,
// surroundings, and decor spots outside the play area.
// No React, no three.js — Scene, City and Decor upload these buffers.

import type { AABB } from "@/arcade3d/core/collision";

/** Cohesive modern-look palette: bright daylight city, vibrant parks, clean water, high-contrast pads. */
export const COLORS = {
   // Sky & Atmosphere
   skyTop: "#0284c7",          // deep sky blue
   skyBottom: "#bae6fd",       // soft daylight horizon
   fog: "#dbeafe",             // gentle daylight distance fog
   sun: "#ffffff",

   // Ground, Streets & Urban Infrastructure
   ground: "#1e293b",          // deep base terrain
   asphalt: "#334155",         // clean roadway asphalt
   asphaltMarking: "#f8fafc",  // crisp white lane lines
   crosswalk: "#f8fafc",       // zebra crossing stripes
   curb: "#94a3b8",            // sidewalk curb border
   sidewalk: "#cbd5e1",        // pedestrian concrete
   suburbanGround: "#3f4d63",  // outskirts ground tone

   // Central Depot Park & Urban Greenery
   grass: "#22c55e",           // vibrant park lawn
   grassSun: "#4ade80",        // sunlit grass highlights
   grassShade: "#16a34a",      // shaded grass
   grassDeep: "#15803d",       // park edge perimeter
   parkPath: "#f1f5f9",        // light gravel walking paths
   parkPlaza: "#e2e8f0",       // depot plaza paving
   treeTrunk: "#78350f",       // warm wood bark
   treeFoliageA: "#16a34a",    // rich green foliage
   treeFoliageB: "#22c55e",    // bright green foliage
   treeFoliageC: "#15803d",    // deep pine foliage

   // River & Water
   water: "#0284c7",           // sparkling river surface
   waterDeep: "#0369a1",       // river channel depth
   foam: "#f0fdfa",            // shoreline foam
   quayStone: "#64748b",       // river embankment stonework
   quayTrim: "#475569",        // embankment top cap

   // Playable City Buildings (2-3 coordinated tones per building)
   facades: [
      { wall: "#f8fafc", trim: "#cbd5e1", base: "#64748b" }, // clean modern white tower
      { wall: "#f1f5f9", trim: "#94a3b8", base: "#475569" }, // sleek corporate slate
      { wall: "#fed7aa", trim: "#fb923c", base: "#9a3412" }, // warm terracotta brick
      { wall: "#e2e8f0", trim: "#64748b", base: "#334155" }, // cool architectural grey
      { wall: "#bae6fd", trim: "#38bdf8", base: "#0284c7" }, // tinted glass & steel
   ],
   roofDeck: "#64748b",        // roof gravel membrane
   roofTrim: "#475569",        // raised parapet border
   roofDeckDark: "#525e75",    // recessed roof well
   roofHvac: "#94a3b8",        // AC compressor bodies
   roofMetal: "#e2e8f0",       // vents, ducts & housings
   solarPanel: "#1e3a8a",      // dark photovoltaic array
   solarGrid: "#60a5fa",       // solar cell line
   windowWarm: "#fef08a",      // lit warm office window
   windowCool: "#93c5fd",      // sky reflection glass window
   windowFrame: "#475569",     // window mullion frame

   // Towers (Height 16m hazards)
   towerWall: "#334155",       // dark skyscraper facade
   towerAccent: "#0f172a",     // structural corner pilasters
   towerHazardA: "#f43f5e",    // bold coral warning band
   towerHazardB: "#fbbf24",    // amber caution stripe
   towerBeacon: "#ef4444",     // flashing aviation warning light
   towerCrown: "#1e293b",      // architectural crown trim

   // Delivery Pads, Beacons & Depot
   padActive: "#38bdf8",       // electric blue active target
   padCompleted: "#22c55e",    // emerald green delivered pad
   padRing: "#ffffff",         // high contrast target boundary
   padBeam: "#38bdf8",         // holographic beacon pillar
   depotRing: "#38bdf8",       // central depot helipad ring
   depotAccent: "#f8fafc",     // depot landing chevron markings
   depotLoading: "#22c55e",    // circular loading progress ring

   // Traffic & Vehicles (Fallbacks and Models)
   carBody: "#f43f5e",         // sporty crimson red
   carRoof: "#f8fafc",         // contrasting white roof
   taxiBody: "#eab308",        // classic bright yellow
   taxiSign: "#1e293b",        // dark roof sign
   vanBody: "#f8fafc",         // crisp delivery white
   vanStripe: "#0284c7",       // cyan delivery accent stripe
   vehicleGlass: "#1e293b",    // dark tinted windshield
   headlight: "#fef08a",       // warm headlights
   taillight: "#ef4444",       // bright red taillights

   // Drone & Flight Visuals
   droneBody: "#f8fafc",       // clean white polymer hull
   droneBlue: "#38bdf8",       // electric cyan accent visor
   droneDark: "#1e293b",       // carbon fiber landing gear / motor arms
   rotorBlade: "#64748b",      // semi-transparent rotor blur
   rotorTip: "#38bdf8",        // cyan rotor tip accent
   cable: "#0f172a",           // winch tether
   shadow: "#0f172a",          // soft ambient blob shadow
   downwashPuff: "#e0f2fe",    // rotor downwash air puff

   // Surroundings Decor (Outside Play Area)
   skylineTowerA: "#64748b",   // distant mid-rise building
   skylineTowerB: "#475569",   // distant high-rise building
   skylineTowerC: "#94a3b8",   // distant bright tower
   skylineRoof: "#334155",     // distant roof cap
   cloud: "#ffffff",           // fluffy low-poly cumulus
   cloudShade: "#e0f2fe",      // soft blue cloud underside
} as const;

/** Playable bounds: bounds of the 60m x 60m playable city. */
export const PLAY_BOUNDS: AABB = {
   min: { x: -30, y: 0, z: -30 },
   max: { x: 30, y: 16, z: 30 },
};

/** Ground plane dimensions: 280m x 280m covers the viewport at all angles and sizes. */
export const GROUND_PLANE = {
   size: 280,
   minX: -140,
   maxX: 140,
   minZ: -140,
   maxZ: 140,
   y: -0.01,
} as const;

/** River bounds outside the play area along the west edge. */
export const RIVER = {
   x: -43,
   y: 0.02,
   z: -10,
   width: 14,
   depth: 220,
   minX: -50,
   maxX: -36,
   minZ: -120,
   maxZ: 100,
} as const;

/** Central park / depot plaza bounds. */
export const PARK = {
   minX: -7.5,
   maxX: 7.5,
   minZ: -7.5,
   maxZ: 7.5,
   y: 0.005,
} as const;

export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   w: number;
   h: number;
   d: number;
   rotY?: number;
   tone?: number;
}

export interface CloudSpot {
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   speed: number;
   drift: number;
}

/** Check if an XZ circle is strictly outside the play area bounds with a safety margin. */
export function isOutsidePlayArea(x: number, z: number, margin = 1.0): boolean {
   const xOut = x < PLAY_BOUNDS.min.x - margin || x > PLAY_BOUNDS.max.x + margin;
   const zOut = z < PLAY_BOUNDS.min.z - margin || z > PLAY_BOUNDS.max.z + margin;
   return xOut || zOut;
}

/** Distant skyline and outer city buildings (strictly outside play area bounds). */
export function buildOuterBuildings(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // --- NORTH SKYLINE (z < -32): directly in front of the north-facing camera ---
   // Distant high-rise towers and office blocks against the sky dome
   const northRows = [
      { z: -37, step: 8, hMin: 6, hMax: 14, w: 5.5, d: 5.5 },
      { z: -48, step: 9, hMin: 8, hMax: 18, w: 6.5, d: 6.5 },
      { z: -62, step: 11, hMin: 12, hMax: 24, w: 8, d: 8 },
      { z: -78, step: 14, hMin: 16, hMax: 28, w: 10, d: 10 },
   ];

   for (const row of northRows) {
      for (let x = -85; x <= 85; x += row.step) {
         // Pseudo-random deterministic variation based on grid position
         const hash = Math.abs(Math.sin(x * 12.9898 + row.z * 78.233)) * 43758.5453;
         const frac = hash - Math.floor(hash);
         const h = row.hMin + frac * (row.hMax - row.hMin);
         const tone = Math.floor(frac * 3);
         spots.push({
            x: x + (frac - 0.5) * 1.5,
            y: h / 2,
            z: row.z,
            w: row.w,
            h,
            d: row.d,
            tone,
         });
      }
   }

   // --- EAST DISTRICT (x > 33): commercial and residential outer blocks ---
   const eastCols = [
      { x: 37, step: 8, hMin: 4, hMax: 12, w: 5.5, d: 5.5 },
      { x: 48, step: 9, hMin: 5, hMax: 14, w: 6.5, d: 6.5 },
      { x: 62, step: 12, hMin: 6, hMax: 16, w: 8, d: 8 },
   ];

   for (const col of eastCols) {
      for (let z = -32; z <= 45; z += col.step) {
         const hash = Math.abs(Math.sin(col.x * 37.123 + z * 53.456)) * 28912.12;
         const frac = hash - Math.floor(hash);
         const h = col.hMin + frac * (col.hMax - col.hMin);
         const tone = Math.floor(frac * 3);
         spots.push({
            x: col.x,
            y: h / 2,
            z: z + (frac - 0.5) * 1.5,
            w: col.w,
            h,
            d: col.d,
            tone,
         });
      }
   }

   // --- WEST DISTRICT (Beyond the river, x < -52): riverbank district ---
   const westCols = [
      { x: -57, step: 9, hMin: 5, hMax: 12, w: 6, d: 6 },
      { x: -70, step: 12, hMin: 6, hMax: 16, w: 8, d: 8 },
      { x: -85, step: 14, hMin: 8, hMax: 20, w: 10, d: 10 },
   ];

   for (const col of westCols) {
      for (let z = -32; z <= 45; z += col.step) {
         const hash = Math.abs(Math.sin(col.x * 23.45 + z * 67.89)) * 34567.89;
         const frac = hash - Math.floor(hash);
         const h = col.hMin + frac * (col.hMax - col.hMin);
         const tone = Math.floor(frac * 3);
         spots.push({
            x: col.x,
            y: h / 2,
            z: z + (frac - 0.5) * 1.5,
            w: col.w,
            h,
            d: col.d,
            tone,
         });
      }
   }

   // --- SOUTH FOREGROUND (z > 33): MUST REMAIN LOW (h <= 1.2m) ---
   // Kept very low so they NEVER sit between the camera and the play area
   for (let x = -30; x <= 30; x += 9) {
      for (let z = 35; z <= 55; z += 9) {
         spots.push({
            x,
            y: 0.5,
            z,
            w: 6,
            h: 1.0, // Low suburban pavilions / parking structures
            d: 6,
            tone: 0,
         });
      }
   }

   return spots;
}

/** Outer trees along boulevards, river quayside and outer parks (strictly outside play area). */
export function buildOuterTrees(): DecorSpot[] {
   const trees: DecorSpot[] = [];

   // River embankment promenade trees (along x = -34.5)
   for (let z = -80; z <= 60; z += 5) {
      trees.push({
         x: -34.5,
         y: 0,
         z,
         w: 0.8,
         h: 2.8,
         d: 0.8,
         tone: z % 2 === 0 ? 0 : 1,
      });
   }

   // East boulevard trees (along x = 31.5)
   for (let z = -30; z <= 40; z += 6) {
      trees.push({
         x: 31.5,
         y: 0,
         z,
         w: 0.8,
         h: 2.6,
         d: 0.8,
         tone: 1,
      });
   }

   // North parkway trees (along z = -32)
   for (let x = -32; x <= 32; x += 6) {
      trees.push({
         x,
         y: 0,
         z: -32,
         w: 0.8,
         h: 2.8,
         d: 0.8,
         tone: 0,
      });
   }

   return trees;
}

/**
 * Distant low-poly clouds: placed far away from the play area (z <= -55 or |x| >= 55)
 * so they can NEVER sit between the camera and the play area at ANY drift phase.
 */
export const OUTER_CLOUDS: readonly CloudSpot[] = [
   // North distant clouds (well behind play area, z <= -55)
   { x: -35, y: 16, z: -60, sx: 10, sy: 2.5, sz: 6, speed: 0.08, drift: 2.0 },
   { x: 5, y: 18, z: -70, sx: 14, sy: 3.2, sz: 8, speed: 0.06, drift: 2.5 },
   { x: 42, y: 17, z: -65, sx: 12, sy: 2.8, sz: 7, speed: 0.07, drift: 2.2 },
   { x: -15, y: 20, z: -85, sx: 18, sy: 3.8, sz: 9, speed: 0.05, drift: 3.0 },

   // West distant clouds (well to the left, x <= -60)
   { x: -65, y: 16, z: -10, sx: 11, sy: 2.6, sz: 6, speed: 0.08, drift: 2.0 },
   { x: -75, y: 19, z: 20, sx: 13, sy: 3.0, sz: 7, speed: 0.06, drift: 2.4 },

   // East distant clouds (well to the right, x >= 60)
   { x: 65, y: 16, z: -15, sx: 12, sy: 2.8, sz: 6, speed: 0.07, drift: 2.2 },
   { x: 72, y: 18, z: 25, sx: 14, sy: 3.1, sz: 7, speed: 0.06, drift: 2.5 },
] as const;

/** Precomputed spots for quick access and tests. */
export const OUTER_BUILDING_SPOTS = buildOuterBuildings();
export const OUTER_TREE_SPOTS = buildOuterTrees();
