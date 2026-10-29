// Rocket Landing visual looks: palette, 5-world atmospheres, decor positions,
// and procedural terrain/cavern meshes. Pure data & three.js geometry builders.
import { BufferAttribute, BufferGeometry } from "three";
import type { LightingPreset } from "@/arcade3d/core/types";
import { WORLD } from "./rules";

export const COLORS = {
   // Space & Sky
   spaceVoid: "#020617",
   spaceDeep: "#030712",
   spaceNavy: "#0f172a",
   starWhite: "#f8fafc",

   // Moon (Planet 0)
   moonSkyTop: "#020617",
   moonSkyBottom: "#0f172a",
   moonFog: "#0a0f1d",
   moonGround: "#d6d3d1",
   moonGroundShade: "#a8a29e",
   moonGroundDeep: "#57534e",
   moonRock: "#9ca3af",
   moonRockDark: "#6b7280",
   moonCraterRim: "#e2e8f0",

   // Desert (Planet 1)
   desertSkyTop: "#2a0800",
   desertSkyBottom: "#7c2d12",
   desertFog: "#431407",
   desertGround: "#ea580c",
   desertGroundShade: "#c2410c",
   desertGroundDeep: "#7c2d12",
   desertRock: "#9a3412",
   desertRockLight: "#f97316",
   desertPlant: "#65a30d",

   // Ice (Planet 2)
   iceSkyTop: "#02142a",
   iceSkyBottom: "#0369a1",
   iceFog: "#073655",
   iceGround: "#e0f2fe",
   iceGroundShade: "#38bdf8",
   iceGroundDeep: "#0284c7",
   iceCrystal: "#a5f3fc",
   iceCrystalDark: "#0284c7",
   iceSpire: "#7dd3fc",

   // Jungle (Gas moon, Planet 3)
   jungleSkyTop: "#011f18",
   jungleSkyBottom: "#065f46",
   jungleFog: "#064e3b",
   jungleGround: "#22c55e",
   jungleGroundShade: "#16a34a",
   jungleGroundDeep: "#14532d",
   jungleFloraStem: "#15803d",
   jungleFloraBulb: "#a855f7",
   jungleSpore: "#f43f5e",

   // Lava (Asteroid Cavern, Planet 4)
   lavaSkyTop: "#030712",
   lavaSkyBottom: "#2e1065",
   lavaFog: "#18181b",
   lavaGround: "#52525b",
   lavaGroundShade: "#27272a",
   lavaGroundDeep: "#18181b",
   lavaMagma: "#f97316",
   lavaMagmaGlow: "#ef4444",
   lavaRock: "#3f3f46",

   // Pad & Landing Zone
   padMetal: "#1e293b",
   padDeck: "#334155",
   padBevel: "#475569",
   padGlow: "#10b981",
   padBeacon: "#34d399",
   padStripe: "#f8fafc",

   // Cavern Roof Hazard
   cavernRock: "#3f3f46",
   cavernBevel: "#52525b",
   cavernShade: "#18181b",
   cavernVein: "#ef4444",

   // Fallback Rocket
   rocketHull: "#f8fafc",
   rocketHullShade: "#e2e8f0",
   rocketRed: "#f43f5e",
   rocketRedDark: "#be123c",
   rocketGlass: "#38bdf8",
   rocketGlassRim: "#0284c7",
   rocketMetal: "#334155",

   // Engine Flame
   flameCore: "#fef08a",
   flameOuter: "#f97316",
} as const;

export interface PlanetLook {
   name: string;
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
   groundTones: readonly [string, string, string]; // sunlit, cliff/mid, deep bedrock
   rockColor: string;
   rockAltColor: string;
   propColor: string;
   propAltColor: string;
   moon: {
      x: number;
      y: number;
      z: number;
      radius: number;
      color: string;
      hasRing?: boolean;
      ringColor?: string;
   };
}

export const PLANET_LOOKS: readonly PlanetLook[] = [
   {
      name: "Moon",
      lighting: "space",
      skyTop: COLORS.moonSkyTop,
      skyBottom: COLORS.moonSkyBottom,
      fog: COLORS.moonFog,
      groundTones: [COLORS.moonGround, COLORS.moonGroundShade, COLORS.moonGroundDeep],
      rockColor: COLORS.moonRock,
      rockAltColor: COLORS.moonRockDark,
      propColor: COLORS.moonCraterRim,
      propAltColor: COLORS.moonRockDark,
      moon: { x: -14, y: 15.5, z: -25, radius: 2.6, color: "#94a3b8" },
   },
   {
      name: "Desert",
      lighting: "sunset",
      skyTop: COLORS.desertSkyTop,
      skyBottom: COLORS.desertSkyBottom,
      fog: COLORS.desertFog,
      groundTones: [COLORS.desertGround, COLORS.desertGroundShade, COLORS.desertGroundDeep],
      rockColor: COLORS.desertRock,
      rockAltColor: COLORS.desertRockLight,
      propColor: COLORS.desertPlant,
      propAltColor: COLORS.desertRock,
      moon: { x: 15, y: 16.5, z: -24, radius: 2.2, color: "#fdba74" },
   },
   {
      name: "Ice",
      lighting: "snow",
      skyTop: COLORS.iceSkyTop,
      skyBottom: COLORS.iceSkyBottom,
      fog: COLORS.iceFog,
      groundTones: [COLORS.iceGround, COLORS.iceGroundShade, COLORS.iceGroundDeep],
      rockColor: COLORS.iceCrystal,
      rockAltColor: COLORS.iceCrystalDark,
      propColor: COLORS.iceSpire,
      propAltColor: COLORS.iceCrystalDark,
      moon: { x: -13, y: 16.8, z: -27, radius: 3.2, color: "#bae6fd", hasRing: true, ringColor: "#7dd3fc" },
   },
   {
      name: "Gas moon",
      lighting: "day",
      skyTop: COLORS.jungleSkyTop,
      skyBottom: COLORS.jungleSkyBottom,
      fog: COLORS.jungleFog,
      groundTones: [COLORS.jungleGround, COLORS.jungleGroundShade, COLORS.jungleGroundDeep],
      rockColor: COLORS.jungleFloraStem,
      rockAltColor: COLORS.jungleFloraBulb,
      propColor: COLORS.jungleFloraBulb,
      propAltColor: COLORS.jungleSpore,
      moon: { x: 14, y: 15.2, z: -26, radius: 4.2, color: "#059669", hasRing: true, ringColor: "#34d399" },
   },
   {
      name: "Asteroid",
      lighting: "night",
      skyTop: COLORS.lavaSkyTop,
      skyBottom: COLORS.lavaSkyBottom,
      fog: COLORS.lavaFog,
      groundTones: [COLORS.lavaGround, COLORS.lavaGroundShade, COLORS.lavaGroundDeep],
      rockColor: COLORS.lavaRock,
      rockAltColor: COLORS.lavaMagma,
      propColor: COLORS.lavaMagmaGlow,
      propAltColor: COLORS.lavaRock,
      moon: { x: -12, y: 16.2, z: -24, radius: 2.4, color: "#78716c", hasRing: false },
   },
   // ----- Level 2 Breezy Approach (Wide Crater) -----
   {
      name: "Crater",
      lighting: "day",
      skyTop: "#1e3a5f",
      skyBottom: "#8a7a63",
      fog: "#a8977f",
      groundTones: ["#cdbfa6", "#a3927a", "#5f5444"],
      rockColor: "#8b7d6b",
      rockAltColor: "#6b5f50",
      propColor: "#d9cbae",
      propAltColor: "#8b7d6b",
      moon: { x: -15, y: 16, z: -26, radius: 3.4, color: "#e7e5e4" },
   },
   {
      name: "Dust basin",
      lighting: "sunset",
      skyTop: "#3b1d0e",
      skyBottom: "#a8682e",
      fog: "#b07a4a",
      groundTones: ["#d8a86c", "#b0804a", "#6b4a2a"],
      rockColor: "#9a6a3c",
      rockAltColor: "#7a5230",
      propColor: "#e6c08a",
      propAltColor: "#9a6a3c",
      moon: { x: 14, y: 16.5, z: -25, radius: 2.4, color: "#fde68a" },
   },
   // ----- Level 3 Turbulent Orbit (Mars Ridge) -----
   {
      name: "Mars",
      lighting: "sunset",
      skyTop: "#2b0a05",
      skyBottom: "#c2410c",
      fog: "#7c2d12",
      groundTones: ["#c1440e", "#8f2f0a", "#4a1606"],
      rockColor: "#7f1d1d",
      rockAltColor: "#b45309",
      propColor: "#9a3412",
      propAltColor: "#7f1d1d",
      moon: { x: 13, y: 16, z: -24, radius: 1.4, color: "#a8a29e" },
   },
   {
      name: "Mars dust storm",
      lighting: "sunset",
      skyTop: "#3a1a0a",
      skyBottom: "#d97706",
      fog: "#b45309",
      groundTones: ["#d0621f", "#a0461a", "#5a230c"],
      rockColor: "#92400e",
      rockAltColor: "#c2410c",
      propColor: "#b45309",
      propAltColor: "#92400e",
      moon: { x: -13, y: 15.5, z: -24, radius: 1.2, color: "#d6d3d1" },
   },
   // ----- Level 4 High Winds & Cavern -----
   {
      name: "Crystal cavern",
      lighting: "night",
      skyTop: "#0b0620",
      skyBottom: "#2e1065",
      fog: "#1e1b4b",
      groundTones: ["#585b7d", "#363859", "#16172b"],
      rockColor: "#312e81",
      rockAltColor: "#4c4f6b",
      propColor: "#a78bfa",
      propAltColor: "#6d28d9",
      moon: { x: -12, y: 16.5, z: -25, radius: 2, color: "#c4b5fd", hasRing: true, ringColor: "#a78bfa" },
   },
   {
      name: "Gale ridge",
      lighting: "snow",
      skyTop: "#0f2a3d",
      skyBottom: "#4f7896",
      fog: "#9fb8cc",
      groundTones: ["#a7b2be", "#6b7682", "#3a424b"],
      rockColor: "#475569",
      rockAltColor: "#64748b",
      propColor: "#cbd5e1",
      propAltColor: "#475569",
      moon: { x: 15, y: 16.8, z: -27, radius: 3, color: "#e2e8f0" },
   },
   // ----- Level 5 Precision Landing -----
   {
      name: "Beacon field",
      lighting: "night",
      skyTop: "#000814",
      skyBottom: "#0b1d3a",
      fog: "#050d1f",
      groundTones: ["#3b4a63", "#1e293b", "#0f172a"],
      rockColor: "#1e293b",
      rockAltColor: "#334155",
      propColor: "#22d3ee",
      propAltColor: "#0e7490",
      moon: { x: -14, y: 16, z: -26, radius: 2.8, color: "#93c5fd", hasRing: true, ringColor: "#38bdf8" },
   },
   {
      name: "Orbital dock",
      lighting: "space",
      skyTop: "#020617",
      skyBottom: "#1e1b4b",
      fog: "#0b0b24",
      groundTones: ["#8392a8", "#56657c", "#1e293b"],
      rockColor: "#334155",
      rockAltColor: "#64748b",
      propColor: "#f59e0b",
      propAltColor: "#475569",
      moon: { x: 13, y: 15.5, z: -22, radius: 5, color: "#1d4ed8", hasRing: true, ringColor: "#93c5fd" },
   },
] as const;

/**
 * Play area bounds. Decor must stay strictly outside this volume.
 * The rocket flies in x in [-10, 10], y in [-1, 20], z in [-1.5, 1.5].
 * We pad by 1.0 m in z and 0.5 m in x/y to ensure zero encroachment.
 */
export const PLAY_AREA = {
   x0: -10.5,
   x1: 10.5,
   y0: -1.2,
   y1: 20.5,
   z0: -2.6,
   z1: 2.6,
} as const;

export function inPlayArea(x: number, y: number, z: number): boolean {
   return x >= PLAY_AREA.x0 && x <= PLAY_AREA.x1 &&
          y >= PLAY_AREA.y0 && y <= PLAY_AREA.y1 &&
          z >= PLAY_AREA.z0 && z <= PLAY_AREA.z1;
}

export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

/** Pre-computed, deterministic decor spots for each planet outside the play area. */
export interface PlanetDecorSpots {
   peaks: readonly DecorSpot[];
   rocks: readonly DecorSpot[];
   props: readonly DecorSpot[];
}

function generateSpots(planetIndex: number): PlanetDecorSpots {
   const peaks: DecorSpot[] = [];
   const rocks: DecorSpot[] = [];
   const props: DecorSpot[] = [];

   // 1. Distant mountain peaks / crater ridges (z: -14 to -18, well behind z0 = -2.6)
   const peakPositions = [
      { x: -30, z: -17, s: 2.8, h: 6.2 },
      { x: -22, z: -15, s: 2.4, h: 5.5 },
      { x: -14, z: -16, s: 2.2, h: 4.8 },
      { x: -5, z: -18, s: 2.9, h: 6.0 },
      { x: 4, z: -17, s: 2.5, h: 5.2 },
      { x: 13, z: -15, s: 2.3, h: 4.9 },
      { x: 21, z: -16, s: 2.6, h: 5.8 },
      { x: 29, z: -18, s: 3.0, h: 6.5 },
   ];
   for (let i = 0; i < peakPositions.length; i++) {
      const p = peakPositions[i];
      const rot = (planetIndex * 1.3 + i * 0.9) % (Math.PI * 2);
      peaks.push({
         x: p.x,
         y: -0.5,
         z: p.z,
         rotY: rot,
         sx: p.s,
         sy: p.h,
         sz: p.s,
      });
   }

   // 2. Boulders & rocks outside play area
   // Flanking left (x: -24 to -11.5), flanking right (x: 11.5 to 24), and deep midground (z: -6 to -10)
   const rockConfigs = [
      // Left flank (outside x0 = -10.5)
      { x: -12.2, y: 0.1, z: -0.5, s: 0.85 },
      { x: -14.5, y: -0.1, z: 1.5, s: 1.1 },
      { x: -17.0, y: 0.2, z: -1.0, s: 1.3 },
      { x: -20.5, y: 0.0, z: 0.5, s: 1.5 },
      // Right flank (outside x1 = +10.5)
      { x: 12.0, y: 0.1, z: -0.8, s: 0.9 },
      { x: 14.8, y: -0.1, z: 1.2, s: 1.2 },
      { x: 17.5, y: 0.2, z: -0.5, s: 1.4 },
      { x: 21.0, y: 0.0, z: 0.8, s: 1.6 },
      // Deep midground (behind z0 = -2.6)
      { x: -8.0, y: 0.3, z: -7.5, s: 1.2 },
      { x: -2.5, y: 0.1, z: -8.2, s: 1.0 },
      { x: 3.0, y: 0.2, z: -7.8, s: 1.1 },
      { x: 8.5, y: 0.0, z: -8.5, s: 1.3 },
   ];
   for (let i = 0; i < rockConfigs.length; i++) {
      const rc = rockConfigs[i];
      const rot = (planetIndex * 0.7 + i * 1.1) % (Math.PI * 2);
      rocks.push({
         x: rc.x,
         y: rc.y,
         z: rc.z,
         rotY: rot,
         sx: rc.s,
         sy: rc.s * 0.85,
         sz: rc.s * 1.1,
      });
   }

   // 3. Planet-specific thematic props (spires, crystals, alien flora)
   const propConfigs = [
      // Left side
      { x: -13.2, y: 0.0, z: -1.8, s: 1.0 },
      { x: -16.0, y: 0.1, z: 2.0, s: 1.25 },
      { x: -19.2, y: -0.1, z: -2.2, s: 1.4 },
      // Right side
      { x: 13.5, y: 0.0, z: 1.6, s: 1.05 },
      { x: 16.2, y: 0.1, z: -1.9, s: 1.3 },
      { x: 19.5, y: -0.1, z: 2.2, s: 1.35 },
      // Deep midground
      { x: -5.5, y: 0.2, z: -6.8, s: 1.15 },
      { x: 5.8, y: 0.1, z: -7.1, s: 1.2 },
   ];
   for (let i = 0; i < propConfigs.length; i++) {
      const pc = propConfigs[i];
      const rot = (planetIndex * 1.1 + i * 0.8) % (Math.PI * 2);
      props.push({
         x: pc.x,
         y: pc.y,
         z: pc.z,
         rotY: rot,
         sx: pc.s,
         sy: pc.s * (planetIndex === 2 ? 1.6 : planetIndex === 3 ? 1.2 : 1.4),
         sz: pc.s,
      });
   }

   return { peaks, rocks, props };
}

export const PLANET_DECOR: readonly PlanetDecorSpots[] = PLANET_LOOKS.map((_, i) => generateSpots(i));

function hexToRgb(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.replace("#", ""), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Builds the wide seamless terrain mesh that covers the entire camera view at all three sizes
 * (1280x800, 390x844, 844x390). The play area x in [-10, 10] matches `terrain` heights exactly.
 * Flanks extend to x = +/-40, depth z from -16 to +8, and bedrock cliff drops to y = -14.
 */
export function buildTerrainMesh(
   terrain: readonly number[],
   planetIndex: number,
   targetGeometry?: BufferGeometry
): BufferGeometry {
   const geometry = targetGeometry ?? new BufferGeometry();
   const positions: number[] = [];
   const normals: number[] = [];
   const colors: number[] = [];

   const tones = PLANET_LOOKS[planetIndex].groundTones.map(hexToRgb);
   const topColor = tones[0];
   const midColor = tones[1];
   const deepColor = tones[2];

   // X grid points: 6 segments left wing (-40 to -10), 12 segments center (-10 to 10), 6 segments right wing (10 to 40)
   const leftWingX = [-40, -32, -25, -19, -15, -12, -10];
   const centerX: number[] = [];
   for (let i = 0; i <= 12; i++) {
      centerX.push(-10 + (i * 20) / 12);
   }
   const rightWingX = [10, 12, 15, 19, 25, 32, 40];

   const allX = [...leftWingX.slice(0, -1), ...centerX, ...rightWingX.slice(1)];
   const allY: number[] = [];

   const h0 = terrain[0];
   const h12 = terrain[12];

   for (let i = 0; i < allX.length; i++) {
      const x = allX[i];
      if (x < -10) {
         // Left wing blends from -0.8 at x = -40 to terrain[0] at x = -10
         const t = (x - -40) / 30;
         const wave = Math.sin(x * 0.3) * 0.4;
         allY.push(h0 * t + wave * (1 - t * 0.5) - 0.4 * (1 - t));
      } else if (x <= 10) {
         // Center matches play-area terrain
         const ci = Math.round(((x - -10) / 20) * 12);
         allY.push(terrain[ci] ?? 0);
      } else {
         // Right wing blends from terrain[12] at x = 10 to -0.8 at x = 40
         const t = (x - 10) / 30;
         const wave = Math.sin(x * 0.3 + 1.2) * 0.4;
         allY.push(h12 * (1 - t) + wave * (1 - t * 0.5) - 0.4 * t);
      }
   }

   const addTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      color: [number, number, number]
   ) => {
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      // Face normal
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      for (let k = 0; k < 3; k++) colors.push(color[0], color[1], color[2]);
   };

   const addQuad = (
      x0: number, y0: number, z0: number,
      x1: number, y1: number, z1: number,
      x2: number, y2: number, z2: number,
      x3: number, y3: number, z3: number,
      color: [number, number, number]
   ) => {
      addTri(x0, y0, z0, x1, y1, z1, x2, y2, z2, color);
      addTri(x0, y0, z0, x2, y2, z2, x3, y3, z3, color);
   };

   // Z rows:
   // zBack = -16, zMidBack = -1.5, zMidFront = 1.5, zFront = 8
   const zBack = -16;
   const zMidBack = -1.5;
   const zMidFront = 1.5;
   const zFront = 8;
   const yFloor = -14;

   for (let i = 0; i < allX.length - 1; i++) {
      const x0 = allX[i], x1 = allX[i + 1];
      const y0 = allY[i], y1 = allY[i + 1];

      // 1. Play area top surface (zMidBack to zMidFront): sunlit tone
      addQuad(x0, y0, zMidBack, x0, y0, zMidFront, x1, y1, zMidFront, x1, y1, zMidBack, topColor);

      // 2. Back slope (zBack to zMidBack): slopes up gently from back
      const yBack0 = y0 - 0.4 + Math.sin(x0 * 0.2) * 0.3;
      const yBack1 = y1 - 0.4 + Math.sin(x1 * 0.2) * 0.3;
      addQuad(x0, yBack0, zBack, x0, y0, zMidBack, x1, y1, zMidBack, x1, yBack1, zBack, midColor);

      // 3. Front slope (zMidFront to zFront): slopes down into foreground
      const yFront0 = y0 - 0.6;
      const yFront1 = y1 - 0.6;
      addQuad(x0, y0, zMidFront, x0, yFront0, zFront, x1, yFront1, zFront, x1, y1, zMidFront, midColor);

      // 4. Front bedrock cliff wall dropping from zFront down to yFloor
      addQuad(x0, yFront0, zFront, x0, yFloor, zFront, x1, yFloor, zFront, x1, yFront1, zFront, deepColor);

      // 5. Back bedrock cliff wall dropping from zBack down to yFloor
      addQuad(x1, yBack1, zBack, x1, yFloor, zBack, x0, yFloor, zBack, x0, yBack0, zBack, deepColor);
   }

   // Left cliff wall at x = allX[0] (-40)
   const leftX = allX[0];
   const leftY = allY[0];
   addQuad(leftX, leftY - 0.4, zBack, leftX, leftY, zMidBack, leftX, yFloor, zMidBack, leftX, yFloor, zBack, deepColor);
   addQuad(leftX, leftY, zMidBack, leftX, leftY, zMidFront, leftX, yFloor, zMidFront, leftX, yFloor, zMidBack, deepColor);
   addQuad(leftX, leftY, zMidFront, leftX, leftY - 0.6, zFront, leftX, yFloor, zFront, leftX, yFloor, zMidFront, deepColor);

   // Right cliff wall at x = allX[last] (40)
   const last = allX.length - 1;
   const rightX = allX[last];
   const rightY = allY[last];
   addQuad(rightX, rightY, zMidBack, rightX, rightY - 0.4, zBack, rightX, yFloor, zBack, rightX, yFloor, zMidBack, deepColor);
   addQuad(rightX, rightY, zMidFront, rightX, rightY, zMidBack, rightX, yFloor, zMidBack, rightX, yFloor, zMidFront, deepColor);
   addQuad(rightX, rightY - 0.6, zFront, rightX, rightY, zMidFront, rightX, yFloor, zMidFront, rightX, yFloor, zFront, deepColor);

   // Bottom floor cap at y = yFloor
   addQuad(leftX, yFloor, zBack, rightX, yFloor, zBack, rightX, yFloor, zFront, leftX, yFloor, zFront, deepColor);

   const posAttr = new BufferAttribute(Float32Array.from(positions), 3);
   const normAttr = new BufferAttribute(Float32Array.from(normals), 3);
   const colAttr = new BufferAttribute(Float32Array.from(colors), 3);

   geometry.setAttribute("position", posAttr);
   geometry.setAttribute("normal", normAttr);
   geometry.setAttribute("color", colAttr);

   return geometry;
}

/**
 * Builds a deliberate, bevelled cavern roof slab for Planet 4 (Asteroid).
 * Physical collision is strictly x in [-3, 3], y in [9, 10], z in [-1.5, 1.5].
 */
export function buildCavernRoofGeometry(): BufferGeometry {
   const geometry = new BufferGeometry();
   const positions: number[] = [];
   const normals: number[] = [];
   const colors: number[] = [];

   const rock = hexToRgb(COLORS.cavernRock);
   const bevel = hexToRgb(COLORS.cavernBevel);
   const shade = hexToRgb(COLORS.cavernShade);
   const vein = hexToRgb(COLORS.cavernVein);

   const addTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
      color: [number, number, number]
   ) => {
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len, nx / len, ny / len, nz / len, nx / len, ny / len, nz / len);
      for (let k = 0; k < 3; k++) colors.push(color[0], color[1], color[2]);
   };

   const addQuad = (
      x0: number, y0: number, z0: number,
      x1: number, y1: number, z1: number,
      x2: number, y2: number, z2: number,
      x3: number, y3: number, z3: number,
      color: [number, number, number]
   ) => {
      addTri(x0, y0, z0, x1, y1, z1, x2, y2, z2, color);
      addTri(x0, y0, z0, x2, y2, z2, x3, y3, z3, color);
   };

   // Centered at [0, 9.5, 0], bounds: x [-3, 3], y [9, 10], z [-1.5, 1.5]
   // Sculpted multi-segment slab:
   // Main body: x: [-2.85, 2.85], y: [9.15, 9.85], z: [-1.4, 1.4]
   const xL = -3.0, xR = 3.0;
   const yB = 9.0, yT = 10.0;
   const zB = -1.5, zF = 1.5;

   // Top bevelled surface (y: 10)
   addQuad(xL, yT, zB, xL, yT, zF, xR, yT, zF, xR, yT, zB, bevel);

   // Bottom surface (y: 9.0)
   addQuad(xL, yB, zF, xL, yB, zB, xR, yB, zB, xR, yB, zF, shade);

   // Front face (z: 1.5) split into 3 vertical bands with a glowing lava fissure vein
   addQuad(xL, yB, zF, xR, yB, zF, xR, 9.35, zF, xL, 9.35, zF, rock);
   addQuad(xL, 9.35, zF, xR, 9.35, zF, xR, 9.55, zF, xL, 9.55, zF, vein); // glowing magma vein!
   addQuad(xL, 9.55, zF, xR, 9.55, zF, xR, yT, zF, xL, yT, zF, rock);

   // Back face (z: -1.5)
   addQuad(xR, yB, zB, xL, yB, zB, xL, yT, zB, xR, yT, zB, shade);

   // Left face (x: -3.0)
   addQuad(xL, yB, zB, xL, yB, zF, xL, yT, zF, xL, yT, zB, rock);

   // Right face (x: 3.0)
   addQuad(xR, yB, zF, xR, yB, zB, xR, yT, zB, xR, yT, zF, rock);

   geometry.setAttribute("position", new BufferAttribute(Float32Array.from(positions), 3));
   geometry.setAttribute("normal", new BufferAttribute(Float32Array.from(normals), 3));
   geometry.setAttribute("color", new BufferAttribute(Float32Array.from(colors), 3));

   return geometry;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.replace("#", ""), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}
