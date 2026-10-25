// Space Repair Mission visual style and surroundings. Pure data: palette,
// station hull layout, and instanced decor positions. Gameplay places stay put.
// No React, no three.js — the scene and unit tests import these structures.
import { rngNext } from "@/arcade3d/core/math";
import { MODULES, STATION } from "./rules";

export const COLORS = {
   space: "#020617",
   spaceDeep: "#00030a",
   skyTop: "#020617",
   skyBottom: "#091b3e",
   fog: "#020617",
   hull: "#e2e8f0",
   hullBright: "#f8fafc",
   hullMid: "#cbd5e1",
   hullDark: "#94a3b8",
   hullTrim: "#64748b",
   // Core and truss metal under the astronaut. #1e293b is the lightest this surface may be.
   hullDeck: "#1e293b",
   shadow: "#334155",
   // Intact dock "C". Light grey stays ≥3:1 on space, Earth ocean and hullDeck.
   dockIdle: "#e2e8f0",
   // Broken dock "C". Lighter indigo than accent so it stays ≥3:1 on Earth ocean.
   dockLive: "#a5b4fc",
   panel: "#1e3a8a",
   panelDark: "#172554",
   accent: "#818cf8",
   neonBlue: "#38bdf8",
   mint: "#34d399",
   warning: "#f87171",
   gold: "#fde68a",
   earth: "#125e93",
   land: "#49b5a9",
   clouds: "#ffffff",
   rim: "#7dd3fc",
   visor: "#172554",
   white: "#f8fafc",
   asteroidA: "#64748b",
   asteroidB: "#475569",
   solarBacking: "#1e293b",
   solarGrid: "#e2e8f0",
   nebulaGlow: "#1e1b4b",
} as const;

export const PLAY_BOUNDS = {
   minX: -STATION.edge,
   maxX: STATION.edge,
   minZ: -STATION.edge,
   maxZ: STATION.edge,
   minY: 0,
   maxY: 2.2,
} as const;

// Coverage envelope for the camera test only. It is not a floor: a deck this size
// filled every viewport and hid Earth and the stars (visual gate, 2026-10-25).
export const HULL_GROUND = {
   minX: -36,
   maxX: 36,
   minZ: -28,
   maxZ: 28,
   y: -0.28,
} as const;

export interface DecorSpot {
   kind: "asteroid" | "satellite" | "distantModule" | "distantSolarWing" | "nebula";
   tone: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   rotX?: number;
   rotZ?: number;
   sx: number;
   sy: number;
   sz: number;
}

function buildDecor(): DecorSpot[] {
   const rng = { s: 0x5a17c };
   const spots: DecorSpot[] = [];
   const rand = () => rngNext(rng);

   // 1. Distant Asteroid field: orbiting far outside the station arena (radius 18..35)
   // Asteroids in the backdrop and far flanks; none near the camera path.
   const asteroidDefs = [
      // Deep north background (z in -18..-32)
      { x: -24, y: 3.5, z: -28, s: 1.4, tone: 0 },
      { x: -16, y: -1.2, z: -22, s: 0.9, tone: 1 },
      { x: -8, y: 5.0, z: -25, s: 1.2, tone: 0 },
      { x: 2, y: -2.0, z: -30, s: 1.6, tone: 1 },
      { x: 12, y: 4.2, z: -24, s: 1.1, tone: 0 },
      { x: 22, y: 1.5, z: -27, s: 1.3, tone: 1 },
      { x: 28, y: -3.0, z: -20, s: 0.8, tone: 0 },
      // East flank (x in 16..30, z in -14..12)
      { x: 20, y: 2.8, z: -12, s: 1.2, tone: 1 },
      { x: 26, y: -1.5, z: -4, s: 1.5, tone: 0 },
      { x: 22, y: 4.0, z: 4, s: 1.0, tone: 1 },
      { x: 25, y: -2.2, z: 12, s: 1.3, tone: 0 },
      // West flank (x in -30..-16, z in -14..12)
      { x: -22, y: 1.8, z: -10, s: 1.1, tone: 0 },
      { x: -27, y: -2.0, z: -2, s: 1.4, tone: 1 },
      { x: -21, y: 3.2, z: 6, s: 0.9, tone: 0 },
      { x: -26, y: -1.8, z: 14, s: 1.2, tone: 1 },
      // Distant low south flanks (well clear of camera frustum, y <= -2)
      { x: -20, y: -3.5, z: 20, s: 1.3, tone: 0 },
      { x: 21, y: -3.2, z: 22, s: 1.1, tone: 1 },
   ];

   for (const def of asteroidDefs) {
      spots.push({
         kind: "asteroid",
         tone: def.tone,
         x: def.x,
         y: def.y,
         z: def.z,
         rotY: rand() * Math.PI * 2,
         rotX: rand() * Math.PI,
         rotZ: rand() * Math.PI,
         sx: def.s * (0.85 + rand() * 0.3),
         sy: def.s * (0.75 + rand() * 0.4),
         sz: def.s * (0.85 + rand() * 0.3),
      });
   }

   // 2. Distant orbital station habitat pods and truss nodes
   const moduleDefs = [
      { x: 19, y: 0.6, z: -16, rotY: 0.4 },
      { x: -19, y: 1.1, z: -17, rotY: -0.5 },
      { x: 23, y: -0.6, z: -3, rotY: 1.2 },
      { x: -23, y: 0.8, z: 3, rotY: -1.1 },
   ];
   for (let i = 0; i < moduleDefs.length; i++) {
      const def = moduleDefs[i];
      spots.push({
         kind: "distantModule",
         tone: i % 2,
         x: def.x,
         y: def.y,
         z: def.z,
         rotY: def.rotY,
         sx: 1.6,
         sy: 1.6,
         sz: 1.6,
      });
   }

   // 3. Distant Solar Wings attached to the distant modules
   const wingDefs = [
      { x: 22.5, y: 0.8, z: -16, rotY: 0.4 },
      { x: -22.5, y: 1.3, z: -17, rotY: -0.5 },
      { x: 26.5, y: -0.4, z: -3, rotY: 1.2 },
      { x: -26.5, y: 1.0, z: 3, rotY: -1.1 },
   ];
   for (let i = 0; i < wingDefs.length; i++) {
      const def = wingDefs[i];
      spots.push({
         kind: "distantSolarWing",
         tone: 0,
         x: def.x,
         y: def.y,
         z: def.z,
         rotY: def.rotY,
         sx: 1.8,
         sy: 1.2,
         sz: 2.8,
      });
   }

   // 4. Communication relay satellites in stable orbit
   const satDefs = [
      { x: -15, y: 4.8, z: -21, rotY: 0.7 },
      { x: 17, y: 5.4, z: -23, rotY: -0.8 },
      { x: -22, y: 3.5, z: 10, rotY: 2.2 },
      { x: 23, y: 3.0, z: 12, rotY: -1.8 },
   ];
   for (let i = 0; i < satDefs.length; i++) {
      const def = satDefs[i];
      spots.push({
         kind: "satellite",
         tone: 0,
         x: def.x,
         y: def.y,
         z: def.z,
         rotY: def.rotY,
         sx: 0.8,
         sy: 0.8,
         sz: 0.8,
      });
   }

   // 5. Deep space nebula cosmic clouds (far in the backdrop, z <= -45)
   const nebulaDefs = [
      { x: -22, y: 18, z: -48, sx: 24, sy: 12, sz: 14, tone: 0 },
      { x: 18, y: 22, z: -58, sx: 28, sy: 14, sz: 16, tone: 1 },
      { x: 0, y: 26, z: -64, sx: 32, sy: 16, sz: 18, tone: 0 },
   ];
   for (const def of nebulaDefs) {
      spots.push({
         kind: "nebula",
         tone: def.tone,
         x: def.x,
         y: def.y,
         z: def.z,
         rotY: rand() * Math.PI,
         sx: def.sx,
         sy: def.sy,
         sz: def.sz,
      });
   }

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind && (tone === undefined || spot.tone === tone));
}

/** Distance from point p to line segment (a -> b). */
export function pointSegmentDistance(
   px: number, py: number, pz: number,
   ax: number, ay: number, az: number,
   bx: number, by: number, bz: number,
): number {
   const dx = bx - ax, dy = by - ay, dz = bz - az;
   const lenSq = dx * dx + dy * dy + dz * dz;
   if (lenSq < 1e-10) return Math.hypot(px - ax, py - ay, pz - az);
   const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lenSq));
   const qx = ax + t * dx, qy = ay + t * dy, qz = az + t * dz;
   return Math.hypot(px - qx, py - qy, pz - qz);
}

/** Check if a decor spot's bounding sphere occludes the line of sight from camera to target. */
export function isOccluding(
   cam: { x: number; y: number; z: number },
   target: { x: number; y: number; z: number },
   spot: DecorSpot,
   radius = Math.max(spot.sx, spot.sy, spot.sz),
): boolean {
   // A decor spot cannot occlude if it is behind the target along the ray direction
   const vRayX = target.x - cam.x, vRayY = target.y - cam.y, vRayZ = target.z - cam.z;
   const vDecorX = spot.x - cam.x, vDecorY = spot.y - cam.y, vDecorZ = spot.z - cam.z;
   const dot = vDecorX * vRayX + vDecorY * vRayY + vDecorZ * vRayZ;
   if (dot < 0) return false; // behind camera
   const rayLenSq = vRayX * vRayX + vRayY * vRayY + vRayZ * vRayZ;
   if (dot > rayLenSq + radius * Math.sqrt(rayLenSq)) return false; // past target

   const dist = pointSegmentDistance(spot.x, spot.y, spot.z, cam.x, cam.y, cam.z, target.x, target.y, target.z);
   return dist < radius;
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
