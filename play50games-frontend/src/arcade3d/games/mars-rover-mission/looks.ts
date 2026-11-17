// Mars Rover Mission: one palette, the chase camera, fog and sky per level and the decor spots.
// Pure: no React, no three.js.
import type { ChaseOptions } from "@/arcade3d/core/chaseCamera";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { GLB_SIZE } from "./assets";
import type { MarsLevel, MissionKind } from "./levels";

export const COLORS = {
   /** rust / ochre regolith, not a saturated red */
   ground: "#b4532a",
   groundDark: "#8a3b1e",
   groundLight: "#c2703d",
   groundDust: "#d08a55",
   cliff: "#7c3418",
   cliffLight: "#c47a45",
   tracks: "#5b210c",
   accent: "#f97316",
   basePad: "#38bdf8",
   basePadActive: "#22d3ee",
   siteRing: "#f97316",
   siteRingActive: "#fde047",
   siteRingScanned: "#22c55e",
   chargerPad: "#22c55e",
   chargerPadActive: "#86efac",
   lane: "#6b2a10",
   rock: "#b45309",
   boulder: "#7c2d12",
   mesa: "#9a3412",
   rover: "#ea580c",
   roverWheel: "#1c1917",
   roverTread: "#3f3a36",
   roverMetal: "#cbd5e1",
   sampleGlow: "#fbbf24",
   crystal: "#2dd4bf",
   scanBeam: "#67e8f9",
   repairBeam: "#fb923c",
   crevasse: "#140603",
   crevasseRim: "#6b2a10",
   dust: "#c98a5a",
   headlight: "#fff4dc",
} as const;

/** The colour of each mission's objective pillar, ring tint and HUD dot. */
export const MISSION_COLOR: Record<MissionKind, string> = {
   crystal: "#2dd4bf",
   beacon: "#f97316",
   panel: "#38bdf8",
   relic: "#c084fc",
};

/** The chase camera (desk; a portrait phone pulls back and widens: core chaseCamera). */
export const CHASE: ChaseOptions = { distance: 7.4, height: 3.7, lookAhead: 4.5, lookHeight: 0.9, yawRate: 2.6, followRate: 7, clearance: 1.6 };
export const FOV = 55;
/** the win orbit's speed (rad/s) */
export const ORBIT_SPEED = 0.45;

/** Linear fog per level (m from the camera): the haze that the sky's horizon colour fades into. L4's storm closes in. */
export const FOG: Record<LevelId, { color: string; near: number; far: number }> = {
   1: { color: "#e3a678", near: 34, far: 130 },
   2: { color: "#dc9564", near: 30, far: 120 },
   3: { color: "#c9774a", near: 26, far: 105 },
   4: { color: "#b8693a", near: 16, far: 62 },
   5: { color: "#1a1430", near: 24, far: 105 },
};
/** L4's dust storm at the end of the clock: the fog this close. */
export const STORM_FOG_END = { near: 8, far: 30 } as const;

/** The fog at a share (0..1) of the clock gone: constant, except the storm, which closes in. */
export function fogAt(id: LevelId, level: MarsLevel, share: number): { near: number; far: number } {
   const f = FOG[id];
   if (!level.storm) return { near: f.near, far: f.far };
   const k = Math.min(1, Math.max(0, share)) ** 1.3;
   return { near: f.near + (STORM_FOG_END.near - f.near) * k, far: f.far + (STORM_FOG_END.far - f.far) * k };
}

/** The environment's fog before the Scene takes it over. */
export function fogFor(_level: MarsLevel, id: LevelId): [string, number, number] {
   return [FOG[id].color, FOG[id].near, FOG[id].far];
}

/** Sky: the dome's zenith and horizon (the horizon = the fog, so the far ground melts into the haze). */
export const SKY: Record<LevelId, { top: string; bottom: string; exponent: number }> = {
   1: { top: "#a2542c", bottom: FOG[1].color, exponent: 0.55 },
   2: { top: "#94461f", bottom: FOG[2].color, exponent: 0.55 },
   3: { top: "#2b1d3d", bottom: FOG[3].color, exponent: 0.45 },
   4: { top: "#5a2410", bottom: FOG[4].color, exponent: 0.7 },
   5: { top: "#03030c", bottom: FOG[5].color, exponent: 0.5 },
};

/** What hangs in each level's sky (directions from the camera; y up, -z = north, where the rover heads first). */
export interface SkyBody {
   kind: "sun" | "earth" | "moon";
   dir: readonly [number, number, number];
   /** angular size: world size at the sky radius (m) */
   size: number;
   color: string;
   /** 0..1 */
   opacity: number;
}

export const SKY_BODIES: Record<LevelId, readonly SkyBody[]> = {
   1: [
      { kind: "sun", dir: [0.55, 0.62, -0.6], size: 34, color: "#fff7e6", opacity: 0.9 },
      { kind: "moon", dir: [-0.5, 0.42, -0.75], size: 7, color: "#e7d5c4", opacity: 0.55 },
   ],
   2: [
      { kind: "sun", dir: [-0.6, 0.58, -0.55], size: 34, color: "#fff7e6", opacity: 0.9 },
      { kind: "moon", dir: [0.45, 0.35, -0.82], size: 6, color: "#e7d5c4", opacity: 0.5 },
      { kind: "moon", dir: [-0.15, 0.55, -0.82], size: 4, color: "#e7d5c4", opacity: 0.4 },
   ],
   3: [
      // a Martian sunset is blue around the sun
      { kind: "sun", dir: [-0.35, 0.12, -0.94], size: 44, color: "#bfdbfe", opacity: 1 },
      { kind: "earth", dir: [0.42, 0.38, -0.82], size: 6, color: "#93c5fd", opacity: 0.95 },
      { kind: "moon", dir: [0.1, 0.5, -0.86], size: 8, color: "#d6c3b0", opacity: 0.7 },
   ],
   4: [{ kind: "sun", dir: [0.3, 0.35, -0.89], size: 40, color: "#fde2b8", opacity: 0.45 }],
   5: [
      { kind: "earth", dir: [-0.38, 0.4, -0.83], size: 13, color: "#60a5fa", opacity: 1 },
      { kind: "moon", dir: [0.48, 0.5, -0.72], size: 11, color: "#cbd5e1", opacity: 0.95 },
      { kind: "moon", dir: [0.05, 0.72, -0.69], size: 6, color: "#cbd5e1", opacity: 0.85 },
   ],
};

// ---------- decor (beyond the plain) ----------

/** One boundary ledge (m along the plain). Its drawn cross-section is WALL_W wide and WALL_H tall. */
export const WALL_PIECE = 4;
export const WALL_H = (GLB_SIZE.marsMesaRock.height / GLB_SIZE.marsMesaRock.depth) * WALL_PIECE;
export const WALL_W = (GLB_SIZE.marsMesaRock.width / GLB_SIZE.marsMesaRock.depth) * WALL_PIECE;

/** Boundary ledges (marsMesaRock fitted to 1 m along its length), their inner faces on the boundary. */
export function wallSpots(level: MarsLevel): InstanceSpot[] {
   const hx = level.width / 2;
   const hz = level.depth / 2;
   const spots: InstanceSpot[] = [];
   const nx = Math.ceil(level.width / WALL_PIECE) + 2;
   for (let i = 0; i < nx; i++) {
      const x = -hx - WALL_PIECE + (i + 0.5) * ((level.width + 2 * WALL_PIECE) / nx);
      spots.push({ x, y: 0, z: -hz - WALL_W / 2, rotY: Math.PI / 2, scale: WALL_PIECE });
      spots.push({ x, y: 0, z: hz + WALL_W / 2, rotY: -Math.PI / 2, scale: WALL_PIECE });
   }
   const nz = Math.ceil(level.depth / WALL_PIECE);
   for (let i = 0; i < nz; i++) {
      const z = -hz + (i + 0.5) * (level.depth / nz);
      spots.push({ x: -hx - WALL_W / 2, y: 0, z, rotY: 0, scale: WALL_PIECE });
      spots.push({ x: hx + WALL_W / 2, y: 0, z, rotY: Math.PI, scale: WALL_PIECE });
   }
   return spots;
}

/** Distant mesas (marsMesaTall fitted to 1 m) on the plateau beyond the cliffs, all round. Seeded per level. */
export function mesaSpots(level: MarsLevel, id: LevelId): InstanceSpot[] {
   const rng = createRng(9100 + id);
   const hx = level.width / 2;
   const hz = level.depth / 2;
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.3;
      const d = 26 + rng() * 26;
      const x = Math.sin(a) * (hx + d);
      const z = -Math.cos(a) * (hz + d);
      spots.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 14 + rng() * 14 });
   }
   return spots;
}

/** The base camp: the habitat, the antenna and crates just south of the south ledge; the astronaut by the lander. */
export function campSpots(level: MarsLevel, lander: { x: number; z: number }) {
   const hz = level.depth / 2;
   const back = hz + WALL_W + 2;
   return {
      base: { x: 8, z: back + 3, rotY: Math.PI / 2, scale: 6 },
      antenna: { x: -12, z: back + 2, rotY: 0.4, scale: 3.6 },
      crates: [
         { x: 3.5, y: 0, z: back + 0.8, rotY: 0.3, scale: 1.0 },
         { x: 4.8, y: 0, z: back + 1.4, rotY: -0.5, scale: 0.8 },
         { x: -2.5, y: 0, z: back + 1.0, rotY: 1.1, scale: 0.9 },
      ] as InstanceSpot[],
      /** just outside the south boundary, beside the lander: she cheers the delivery */
      astronaut: { x: lander.x + 2.2, z: hz + 0.7 },
   };
}

/** The L5 ancient site beyond the north cliff: a great arch and lantern pillars along the ridge. */
export function ruinSpots(level: MarsLevel) {
   const hx = level.width / 2;
   const hz = level.depth / 2;
   return {
      arch: { x: -6, z: -hz - 22, rotY: 0, scale: 13 },
      pillars: [
         { x: -14, y: 0, z: -hz - 17, rotY: 0.2, scale: 3.4 },
         { x: 2, y: 0, z: -hz - 17, rotY: -0.3, scale: 3.4 },
         { x: hx + 15, y: 0, z: -hz + 6, rotY: 1.2, scale: 3 },
         { x: -hx - 15, y: 0, z: -hz + 10, rotY: -1, scale: 3 },
      ] as InstanceSpot[],
   };
}

/** A dust chute down each boulder lane (16 % opacity), so the danger reads before a boulder comes. */
export function laneSpots(level: MarsLevel, lanes: readonly { x: number }[]): InstanceSpot[] {
   return lanes.map((l) => ({ x: l.x, y: 0.03, z: 0, sx: 1.4, sy: 1, sz: level.depth - 1 }));
}
