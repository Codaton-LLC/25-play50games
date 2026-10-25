// Warehouse Rush look: unified palette, lighting presets, fog, ground boundaries,
// and every decorative element outside the play area.
// Pure data: no React, no three.js — the scene and Decor components upload these buffers.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

/** The fitted view's reference cameras for testing screen sizes. */
export const VIEW_CAMERAS = {
   desktop: { width: 1280, height: 800 },
   phonePortrait: { width: 390, height: 844 },
   phoneLandscape: { width: 844, height: 390 },
} as const;

/** Initial canvas camera from definition.camera. */
export const VIEW_CAMERA = { x: 0, y: 17.3, z: 11.7 };

/**
 * Playable area boundaries (ARENA halfX 10, halfZ 6 plus perimeter walls 0.4).
 * All gameplay elements (robot, carried boxes, shelves, pallets, drop zones) live strictly inside this box.
 * Decor instances MUST sit strictly outside this box with a safety clearance margin.
 */
export const PLAY_BOUNDS = {
   x0: -10.4,
   x1: 10.4,
   z0: -6.4,
   z1: 6.4,
   y0: 0,
   y1: 1.4,
} as const;

/** Continuous warehouse logistics floor plane that covers the entire view frustum at all 3 screen sizes. */
export const GROUND = {
   width: 92,
   depth: 72,
   x: 0,
   y: -0.01,
   z: 0,
} as const;

/**
 * Unified COLORS palette for Warehouse Rush (modern logistics facility).
 * 2-3 cohesive tones per object; no raw grey boxes.
 */
export const COLORS = {
   // Atmosphere & sky
   skyTop: "#1e293b",
   sky: "#64748b",
   fog: "#334155",

   // Floor & concrete
   floor: "#a3acb9",           // clean polished light concrete
   floorJoint: "rgba(15, 23, 42, 0.16)",
   lane: "#facc15",            // safety yellow lane markings
   bay: "rgba(255, 255, 255, 0.85)",
   plinth: "#0f172a",          // dark base foundation plinth
   apron: "#828c99",           // outer staging apron floor

   // Warehouse architecture & structural
   wall: "#475569",            // slate industrial panel wall
   wallTrim: "#1e293b",        // dark steel base / kickplate
   trim: "#1e293b",            // arena wall trim
   wallStripe: "#0284c7",      // logistics brand accent stripe
   column: "#334155",          // steel I-beam structural column
   rollerDoor: "#94a3b8",      // corrugated steel roll-up door
   rollerDoorFrame: "#1e293b", // dark door header & frame
   dockYellow: "#eab308",      // caution stripe on doors & curbs
   bollard: "#eab308",         // yellow steel safety bollard
   bollardStripe: "#0f172a",   // black safety stripe

   // Racks & shelving (industrial logistics)
   rackUpright: "#f97316",     // safety orange uprights
   rackBeam: "#0284c7",        // industrial blue crossbeams
   rackShelf: "#94a3b8",       // steel wire decking
   carton: "#c29b6c",          // cardboard box tone 1
   cartonDark: "#a07848",      // cardboard box tone 2
   cartonTape: "#0284c7",      // blue packing tape
   shrinkWrap: "#e2e8f0",      // pallet wrapped in shrink wrap

   // Pallets
   palletTop: "#d4a373",       // pine pallet slats
   palletRunner: "#a26d3f",    // wood runners

   // Forklifts (active & parked)
   forkliftBody: "#ea580c",    // bold safety orange body
   forkliftCab: "#0f172a",     // dark roll cage / cab frame
   forkliftMast: "#64748b",    // steel vertical mast
   forkliftForks: "#cbd5e1",   // bright steel forks
   forkliftWheel: "#1e293b",   // heavy rubber tires
   forkliftHub: "#facc15",     // yellow wheel hubs
   beacon: "#facc15",          // amber flashing beacon

   // Robot
   robot: "#2dd4bf",           // teal body
   robotHead: "#f8fafc",       // clean white head
   robotDark: "#0f172a",       // dark visor
   robotEye: "#67e8f9",        // glowing eye visor

   // Gameplay zones & boxes (standardized from rules.ts)
   zoneA: "#ef4444",           // red
   zoneB: "#3b82f6",           // blue
   zoneC: "#facc15",           // yellow
   zoneD: "#22c55e",           // green
   hazard: "#0f172a",          // hazard border
} as const;

/**
 * Linear fog parameters.
 * `near` is set to 58 m, which is strictly past the farthest corner of the play area
 * from ANY fitted camera angle (including narrow portrait phone at max distance ~42 m).
 * This guarantees the active play area is 100% crisp and un-fogged, while distant walls
 * (at 60-90 m) hazily blend into the atmospheric background.
 */
export const FOG = { near: 58, far: 110 } as const;

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   sky: string;
   fog: string;
   ground?: string;
   lamp?: number;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "indoor", skyTop: COLORS.skyTop, sky: COLORS.sky, fog: COLORS.fog, ground: "#cbd5e1" },
   2: { lighting: "day", skyTop: "#0f283d", sky: "#94a3b8", fog: "#475569", ground: "#e2e8f0" },
   3: { lighting: "sunset", skyTop: "#2a1810", sky: "#f97316", fog: "#7c2d12", ground: "#fed7aa" },
   4: { lighting: "night", skyTop: "#030712", sky: "#1e293b", fog: "#0f172a", ground: "#94a3b8", lamp: 6 },
   5: { lighting: "sunset", skyTop: "#1e1b4b", sky: "#be123c", fog: "#4c0519", ground: "#fecdd3", lamp: 5 },
};

/** Returns true if a 2D point (x, z) lies inside the play bounds (grown by optional margin). */
export function inPlayBounds(x: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_BOUNDS.x0 - margin &&
      x <= PLAY_BOUNDS.x1 + margin &&
      z >= PLAY_BOUNDS.z0 - margin &&
      z <= PLAY_BOUNDS.z1 + margin
   );
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio of two #rrggbb hex colors. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

/** Distance from a camera position to the farthest point of the play area. */
export function farWarehouseDistance(camera: { x: number; y: number; z: number }): number {
   let max = 0;
   for (const x of [PLAY_BOUNDS.x0, PLAY_BOUNDS.x1]) {
      for (const z of [PLAY_BOUNDS.z0, PLAY_BOUNDS.z1]) {
         const d = Math.hypot(x - camera.x, 0 - camera.y, z - camera.z);
         if (d > max) max = d;
      }
   }
   return max;
}

// ---------- decor outside the play area ----------

export interface DecorSpot {
   kind:
      | "wall"
      | "column"
      | "rollerDoor"
      | "highRack"
      | "highRackBeam"
      | "highRackCarton"
      | "palletStack"
      | "parkedForklift"
      | "bollard"
      | "truss";
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
   const spots: DecorSpot[] = [];

   // 1. North Warehouse Back Wall (at z = -15.5, well clear of play bounds z = -6.4)
   // Wall panels spanning x = -24 to 24 in 6 m segments
   for (let x = -21; x <= 21; x += 6) {
      spots.push({
         kind: "wall",
         tone: Math.abs(x) % 12 === 0 ? 0 : 1,
         x,
         y: 3.5,
         z: -15.5,
         rotY: 0,
         sx: 5.95,
         sy: 7.0,
         sz: 0.35,
      });
   }

   // Structural steel columns along the North wall
   for (let x = -24; x <= 24; x += 6) {
      spots.push({
         kind: "column",
         tone: 0,
         x,
         y: 3.5,
         z: -15.3,
         rotY: 0,
         sx: 0.45,
         sy: 7.0,
         sz: 0.45,
      });
   }

   // North Wall Industrial Roller Doors (x = -9, 0, 9)
   for (const x of [-9, 0, 9]) {
      spots.push({
         kind: "rollerDoor",
         tone: x === 0 ? 0 : 1,
         x,
         y: 2.3,
         z: -15.35,
         rotY: 0,
         sx: 4.6,
         sy: 4.6,
         sz: 0.22,
      });
   }

   // 2. West Warehouse Wall (at x = -20.5, z = -15.5 to +12)
   for (let z = -12; z <= 12; z += 6) {
      spots.push({
         kind: "wall",
         tone: Math.abs(z) % 12 === 0 ? 0 : 1,
         x: -20.5,
         y: 3.5,
         z,
         rotY: Math.PI / 2,
         sx: 5.95,
         sy: 7.0,
         sz: 0.35,
      });
      spots.push({
         kind: "column",
         tone: 0,
         x: -20.3,
         y: 3.5,
         z,
         rotY: Math.PI / 2,
         sx: 0.45,
         sy: 7.0,
         sz: 0.45,
      });
   }

   // West loading dock roller doors (z = -6, +3)
   for (const z of [-6, 3]) {
      spots.push({
         kind: "rollerDoor",
         tone: 0,
         x: -20.35,
         y: 2.3,
         z,
         rotY: Math.PI / 2,
         sx: 4.6,
         sy: 4.6,
         sz: 0.22,
      });
   }

   // 3. High-Bay Storage Racks (North staging, z = -9.6, clear of play bounds)
   // Uprights, crossbeams, and loaded cartons
   const rackXPositions = [-8.5, -3.0, 3.0, 8.5];
   for (const rx of rackXPositions) {
      // 2 upright frames per bay (left and right)
      spots.push(
         { kind: "highRack", tone: 0, x: rx - 1.7, y: 1.6, z: -9.6, rotY: 0, sx: 0.12, sy: 3.2, sz: 1.1 },
         { kind: "highRack", tone: 0, x: rx + 1.7, y: 1.6, z: -9.6, rotY: 0, sx: 0.12, sy: 3.2, sz: 1.1 }
      );
      // 3 beam tiers: y = 0.2, 1.25, 2.3
      for (const by of [0.2, 1.25, 2.3]) {
         spots.push({ kind: "highRackBeam", tone: 0, x: rx, y: by, z: -9.6, rotY: 0, sx: 3.4, sy: 0.08, sz: 1.05 });
      }
      // Cartons on shelves
      spots.push(
         { kind: "highRackCarton", tone: 0, x: rx - 0.9, y: 0.58, z: -9.6, rotY: 0.05, sx: 1.2, sy: 0.65, sz: 0.8 },
         { kind: "highRackCarton", tone: 1, x: rx + 0.9, y: 0.58, z: -9.6, rotY: -0.04, sx: 1.1, sy: 0.65, sz: 0.82 },
         { kind: "highRackCarton", tone: 1, x: rx - 0.85, y: 1.62, z: -9.6, rotY: 0, sx: 1.15, sy: 0.62, sz: 0.78 },
         { kind: "highRackCarton", tone: 0, x: rx + 0.85, y: 1.62, z: -9.6, rotY: 0.03, sx: 1.2, sy: 0.62, sz: 0.8 },
         { kind: "highRackCarton", tone: 2, x: rx, y: 2.65, z: -9.6, rotY: -0.02, sx: 2.4, sy: 0.6, sz: 0.75 }
      );
   }

   // 4. Staged Pallets with shrink-wrapped goods
   // North staging line at z = -7.8
   for (const sx of [-6.5, -4.2, -1.8, 1.8, 4.2, 6.5]) {
      spots.push({
         kind: "palletStack",
         tone: Math.abs(sx) % 2 === 0 ? 0 : 1,
         x: sx,
         y: 0.45,
         z: -7.8,
         rotY: 0.04 * (sx % 3),
         sx: 1.2,
         sy: 0.9,
         sz: 1.0,
      });
   }

   // West staging line at x = -13.5
   for (const sz of [-8.5, -5.5, 5.5, 8.5]) {
      spots.push({
         kind: "palletStack",
         tone: Math.abs(sz) % 2 === 0 ? 1 : 2,
         x: -13.5,
         y: 0.48,
         z: sz,
         rotY: Math.PI / 2 + 0.05 * (sz % 2),
         sx: 1.2,
         sy: 0.95,
         sz: 1.0,
      });
   }

   // East staging line at x = +13.5 (LOW height y <= 0.45 m so line of sight in portrait is never clipped)
   for (const sz of [-4.5, 0, 4.5]) {
      spots.push({
         kind: "palletStack",
         tone: 0,
         x: 13.5,
         y: 0.2,
         z: sz,
         rotY: 0.02 * sz,
         sx: 1.2,
         sy: 0.4,
         sz: 1.0,
      });
   }

   // South staging line at z = +8.2 (LOW height y <= 0.35 m so camera in landscape is never clipped)
   for (const sx of [-5.5, -2.0, 2.0, 5.5]) {
      spots.push({
         kind: "palletStack",
         tone: 1,
         x: sx,
         y: 0.18,
         z: 8.2,
         rotY: 0.03 * sx,
         sx: 1.2,
         sy: 0.35,
         sz: 1.0,
      });
   }

   // 5. Parked Forklifts in charging bays along the West wall (x = -15.5)
   for (const pz of [-2.0, 3.5]) {
      spots.push({
         kind: "parkedForklift",
         tone: 0,
         x: -15.5,
         y: 0,
         z: pz,
         rotY: Math.PI / 2, // facing east towards the aisle
         sx: 1.0,
         sy: 1.0,
         sz: 1.0,
      });
   }

   // 6. Heavy-Duty Yellow Safety Bollards
   // Corner guards just outside the arena boundary (x = +-10.9, z = +-6.9)
   for (const bx of [-10.9, 10.9]) {
      for (const bz of [-6.9, 6.9]) {
         spots.push({
            kind: "bollard",
            tone: 0,
            x: bx,
            y: 0.45,
            z: bz,
            rotY: 0,
            sx: 0.16,
            sy: 0.9,
            sz: 0.16,
         });
      }
   }
   // Bollards guarding the roller doors along the North wall
   for (const dx of [-11.5, -6.5, -2.5, 2.5, 6.5, 11.5]) {
      spots.push({
         kind: "bollard",
         tone: 0,
         x: dx,
         y: 0.45,
         z: -14.8,
         rotY: 0,
         sx: 0.16,
         sy: 0.9,
         sz: 0.16,
      });
   }

   // 7. Overhead Steel Trusses (high at y = 7.0 along the back wall)
   for (let x = -20; x <= 20; x += 10) {
      spots.push({
         kind: "truss",
         tone: 0,
         x,
         y: 7.0,
         z: -14.5,
         rotY: 0,
         sx: 9.8,
         sy: 0.4,
         sz: 0.4,
      });
   }

   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorSpot["kind"], tone?: number): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind && (tone === undefined || spot.tone === tone));
}
