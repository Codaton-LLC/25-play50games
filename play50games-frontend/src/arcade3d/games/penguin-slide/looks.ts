// Penguin Ice Slide modern look.
// Pure data: single COLORS palette, play bounds, camera constants, and instanced decor spots.
// No React, no Three.js runtime logic here.

import { rngNext } from "@/arcade3d/core/math";
import type { LightingPreset } from "@/arcade3d/core/types";
import type { SlideSite } from "./levels";

/** Single palette for the entire visual pass. */
export const COLORS = {
   // Sky & atmosphere
   skyTop: "#38bdf8",     // crisp arctic daylight cyan-blue
   skyBottom: "#e0f2fe",  // bright icy horizon
   fog: "#e0f2fe",        // matches sky horizon for seamless depth

   // Track ice & glacier slope
   iceSurface: "#cffafe", // glossy translucent cyan ice
   iceSheen: "#ffffff",   // bright specular sheen
   iceCracks: "#7dd3fc",  // crystalline crack lines
   iceDeep: "#0284c7",    // deep crevasse shadow

   // Snow
   snowSun: "#ffffff",    // crisp direct sunlit snow
   snowSoft: "#f0f9ff",   // soft arctic snow banks
   snowShade: "#e2e8f0",  // cool ambient snow shadow
   snowDeep: "#cbd5e1",   // deep crevasses in snow

   // Terrain (expansive surrounding snowfield)
   terrainSnow: "#f8fafc",
   terrainShade: "#dbeafe",
   terrainIce: "#bae6fd",
   terrainDeep: "#93c5fd",

   // Decor: ice spires & glaciers
   spireBase: "#38bdf8",
   spireBody: "#a5f3fc",
   spireTip: "#e0f7fa",
   glacierIce: "#7dd3fc",
   glacierShade: "#0284c7",
   glacierCap: "#f8fafc",

   // Decor: arctic rocks & mountains
   rockBase: "#334155",
   rockFace: "#475569",
   rockSnow: "#ffffff",
   mountainPeak: "#ffffff",
   mountainRock: "#475569",
   mountainShade: "#334155",

   // Clouds
   cloud: "#ffffff",
   cloudShade: "#f1f5f9",

   // Obstacles (deliberate 2-3 tones, high contrast)
   iceBlock: "#67e8f9",      // faceted crystalline ice
   iceBlockShade: "#0284c7", // deep internal crystal refraction
   iceBlockCoral: "#fb7185", // coral warning facet for instant hazard readability

   crackAbyss: "#030712",    // deep crevasse void
   crackIceLip: "#38bdf8",   // sharp cyan ice lip
   crackCoralRim: "#fb7185", // warning coral rim

   rampRunway: "#e0f2fe",    // clean ice ramp surface
   rampChevrons: "#0284c7",  // directional arrow striping
   rampRails: "#38bdf8",     // frosted side guides
   rampLip: "#ffffff",       // snow-capped launch lip

   gatePost: "#0f766e",      // sturdy teal pylon body
   gateRing: "#6ee7b7",      // glowing mint indicator
   gateBase: "#ffffff",      // snow-capped foot

   // Pickups & Rewards
   fishBody: "#f97316",      // bright salmon orange
   fishBelly: "#ffedd5",     // warm white belly
   fishTail: "#c2410c",      // deep fin orange

   // Penguin stand-in fallback
   penguinDark: "#0f172a",   // sleek midnight navy coat
   penguinWhite: "#f8fafc",  // snowy belly
   penguinBeak: "#f97316",   // bright orange beak
   penguinFeet: "#fbbf24",   // warm golden feet

   // Pines
   pineNeedles: "#164e63",   // deep winter evergreen
   pineSnow: "#ffffff",      // snow-capped branches
   pineTrunk: "#713f12",     // bark brown
} as const;

/**
 * Play area bounds in the local floating-origin frame (where penguin & scene sit).
 * Gameplay and hazard interaction occur strictly within these bounds:
 * Lateral width: x in [-4.8, 4.8]
 * Longitudinal travel: z in [-24.0, 5.0] (camera preview down to z = -22, behind player to z = +4)
 * Vertical range: y in [0.0, 3.5] (ground to maximum jump height)
 */
export const PLAY_BOUNDS = {
   x0: -4.8,
   x1: 4.8,
   z0: -24.0,
   z1: 5.0,
   y0: 0.0,
   y1: 3.5,
} as const;

export function inPlayBounds(x: number, y: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_BOUNDS.x0 - margin &&
      x <= PLAY_BOUNDS.x1 + margin &&
      z >= PLAY_BOUNDS.z0 - margin &&
      z <= PLAY_BOUNDS.z1 + margin &&
      y >= PLAY_BOUNDS.y0 - margin &&
      y <= PLAY_BOUNDS.y1 + margin
   );
}

export interface DecorSpot {
   kind: "spire" | "drift" | "rock" | "glacier" | "mountain" | "cloud";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
   radius: number;
}

export const CLOUD_DRIFT = 2.0;

function buildDecorSpots(): DecorSpot[] {
   const rng = { s: 0x7e4b91 };
   const rand = () => rngNext(rng);
   const spots: DecorSpot[] = [];

   // Helper: check minimum distance from already placed spots of same or similar kind
   const tooClose = (x: number, z: number, minDist: number) => {
      for (const s of spots) {
         const dx = s.x - x;
         const dz = s.z - z;
         if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
   };

   const minMargin = 5.2;

   // 1. Snow drifts flanking the track outside |x| >= minMargin + radius
   // Left drifts
   for (let i = 0; i < 9; i++) {
      const s = 0.8 + rand() * 0.5;
      const radius = s * 1.4;
      const x = -(minMargin + radius + rand() * 8.0);
      const z = -22 + rand() * 25;
      if (!tooClose(x, z, 2.4)) {
         spots.push({
            kind: "drift", tone: i % 2,
            x, y: 0.05, z,
            rotY: rand() * Math.PI * 2,
            sx: s * 1.4, sy: s * 0.6, sz: s * 1.2,
            radius,
         });
      }
   }
   // Right drifts
   for (let i = 0; i < 9; i++) {
      const s = 0.8 + rand() * 0.5;
      const radius = s * 1.4;
      const x = (minMargin + radius + rand() * 8.0);
      const z = -22 + rand() * 25;
      if (!tooClose(x, z, 2.4)) {
         spots.push({
            kind: "drift", tone: (i + 1) % 2,
            x, y: 0.05, z,
            rotY: rand() * Math.PI * 2,
            sx: s * 1.4, sy: s * 0.6, sz: s * 1.2,
            radius,
         });
      }
   }

   // 2. Ice spires flanking the track outside |x| >= minMargin + radius
   // Left spires
   for (let i = 0; i < 8; i++) {
      const s = 0.8 + rand() * 0.6;
      const radius = s * 0.85;
      const x = -(minMargin + radius + rand() * 9.0);
      const z = -22 + rand() * 24;
      if (!tooClose(x, z, 2.5)) {
         spots.push({
            kind: "spire", tone: i % 3,
            x, y: 0, z,
            rotY: rand() * Math.PI * 2,
            sx: s * 0.85, sy: s * 2.2, sz: s * 0.85,
            radius,
         });
      }
   }
   // Right spires
   for (let i = 0; i < 8; i++) {
      const s = 0.8 + rand() * 0.6;
      const radius = s * 0.85;
      const x = (minMargin + radius + rand() * 9.0);
      const z = -22 + rand() * 24;
      if (!tooClose(x, z, 2.5)) {
         spots.push({
            kind: "spire", tone: (i + 1) % 3,
            x, y: 0, z,
            rotY: rand() * Math.PI * 2,
            sx: s * 0.85, sy: s * 2.2, sz: s * 0.85,
            radius,
         });
      }
   }

   // 3. Icy rocks with snow tops outside |x| >= minMargin + radius
   for (let i = 0; i < 7; i++) {
      const s = 0.55 + rand() * 0.45;
      const radius = s;
      const x = -(minMargin + radius + rand() * 8.0);
      const z = -21 + rand() * 23;
      if (!tooClose(x, z, 2.0)) {
         spots.push({
            kind: "rock", tone: i % 2,
            x, y: 0.05, z,
            rotY: rand() * Math.PI * 2,
            sx: s, sy: s * 0.75, sz: s * 0.9,
            radius,
         });
      }
   }
   for (let i = 0; i < 7; i++) {
      const s = 0.55 + rand() * 0.45;
      const radius = s;
      const x = (minMargin + radius + rand() * 8.0);
      const z = -21 + rand() * 23;
      if (!tooClose(x, z, 2.0)) {
         spots.push({
            kind: "rock", tone: (i + 1) % 2,
            x, y: 0.05, z,
            rotY: rand() * Math.PI * 2,
            sx: s, sy: s * 0.75, sz: s * 0.9,
            radius,
         });
      }
   }

   // 4. Distant glaciers (z <= -42, far down-track)
   const glacierDefs: Array<[number, number, number, number, number, number]> = [
      [-28, 1.0, -48, 8.5, 9.0, 6.0],
      [27, 0.5, -46, 8.0, 8.5, 6.0],
      [-16, 2.0, -56, 11.0, 11.0, 7.5],
      [18, 1.5, -54, 10.5, 10.5, 7.0],
      [0, 2.5, -62, 12.0, 12.5, 8.0],
   ];
   for (let i = 0; i < glacierDefs.length; i++) {
      const [x, y, z, sx, sy, sz] = glacierDefs[i];
      spots.push({
         kind: "glacier", tone: i % 2,
         x, y, z,
         rotY: (i * 0.7) % (Math.PI * 2),
         sx, sy, sz,
         radius: Math.max(sx, sz),
      });
   }

   // 5. Distant mountain peaks on the horizon (z <= -75, y >= 4)
   const mountainDefs: Array<[number, number, number, number, number, number]> = [
      [-48, 4.0, -82, 22.0, 24.0, 14.0],
      [-20, 5.0, -90, 26.0, 28.0, 16.0],
      [12, 6.0, -96, 30.0, 32.0, 18.0],
      [42, 4.5, -85, 24.0, 25.0, 15.0],
      [-70, 3.0, -88, 28.0, 22.0, 16.0],
      [68, 3.5, -92, 28.0, 24.0, 16.0],
   ];
   for (let i = 0; i < mountainDefs.length; i++) {
      const [x, y, z, sx, sy, sz] = mountainDefs[i];
      spots.push({
         kind: "mountain", tone: i % 2,
         x, y, z,
         rotY: (i * 1.1) % (Math.PI * 2),
         sx, sy, sz,
         radius: Math.max(sx, sz),
      });
   }

   // 6. High arctic clouds (y in [19, 25], z <= -38)
   const cloudDefs: Array<[number, number, number, number]> = [
      [-15, 21.0, -42, 1.1],
      [14, 22.5, -46, 1.25],
      [-4, 20.0, -52, 1.4],
      [22, 23.0, -58, 1.15],
      [-24, 22.0, -64, 1.3],
   ];
   for (let i = 0; i < cloudDefs.length; i++) {
      const [x, y, z, s] = cloudDefs[i];
      spots.push({
         kind: "cloud", tone: 0,
         x, y, z,
         rotY: 0,
         sx: 4.8 * s, sy: 1.5 * s, sz: 3.2 * s,
         radius: 4.8 * s,
      });
   }

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecorSpots();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind && (tone === undefined || spot.tone === tone));
}

/** What lines the banks of a level's slope (Track.tsx's bank pool): asset key and lateral offset (m). */
export type BankProp = "pine" | "auroraCrystal" | "rock" | "glacierChunk";

/**
 * Each level's place (README "Levels"): the core light preset, sky, fog, the snow field's four
 * tones, the bank scenery, how much snow falls, and which far decor shows. Level 1 is today's look.
 */
export interface SlideTheme {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
   /** the snow field's four tones (Terrain.tsx): sunlit, snow, shade, ice */
   tones: readonly [string, string, string, string];
   bank: BankProp;
   /** share of today's snowfall (0 = none) */
   snow: number;
   clouds: boolean;
   mountains: boolean;
   spires: boolean;
   stars: boolean;
   aurora: boolean;
}

export const THEMES: Record<SlideSite, SlideTheme> = {
   snowHill: {
      lighting: "snow", skyTop: COLORS.skyTop, skyBottom: COLORS.skyBottom, fog: COLORS.fog,
      tones: [COLORS.snowSun, COLORS.terrainSnow, COLORS.terrainShade, COLORS.terrainIce],
      bank: "pine", snow: 1, clouds: true, mountains: true, spires: true, stars: false, aurora: false,
   },
   // a dim blue cave: no sky, no snowfall, glowing crystals on the banks, ice columns all round
   iceCave: {
      lighting: "night", skyTop: "#04121f", skyBottom: "#16455e", fog: "#123a50",
      tones: ["#b6e3f5", "#8cc7e3", "#5a93b5", "#a5f3fc"],
      bank: "auroraCrystal", snow: 0, clouds: false, mountains: false, spires: true, stars: false, aurora: false,
   },
   // a flat glassy lake under a pale lilac sky: boulders on the shore, light snow
   frozenLake: {
      lighting: "snow", skyTop: "#818cf8", skyBottom: "#eef2ff", fog: "#e0e7ff",
      tones: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd"],
      bank: "rock", snow: 0.35, clouds: true, mountains: true, spires: false, stars: false, aurora: false,
   },
   // a starry night under the northern lights
   auroraRun: {
      lighting: "night", skyTop: "#020617", skyBottom: "#0f3b3f", fog: "#0c2a33",
      tones: ["#dbeafe", "#bfdbfe", "#8ea7d8", "#99f6e4"],
      bank: "pine", snow: 0.5, clouds: false, mountains: true, spires: false, stars: true, aurora: true,
   },
   // a glacier at dusk between ice cliffs
   glacierSprint: {
      lighting: "sunset", skyTop: "#7c3aed", skyBottom: "#fdba74", fog: "#fbc999",
      tones: ["#fff7ed", "#fde7d0", "#f5c6a5", "#bae6fd"],
      bank: "glacierChunk", snow: 0.6, clouds: true, mountains: true, spires: true, stars: false, aurora: false,
   },
};

/** How far off the corridor centre each bank prop stands (m): clear of the 3.5 m half-width and its banks. */
export const BANK_LATERAL: Record<BankProp, number> = { pine: 5.2, auroraCrystal: 5.8, rock: 5.6, glacierChunk: 6.8 };
