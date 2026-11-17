// Robot Factory's modern look. Pure data: palette, play bounds, decor spots, and
// floor geometry settings. Gameplay places (belt, cradle, claw, bins, exit door) stay put.
// No React, no hooks — the scene and decor components upload these buffers.

export const COLORS = {
   background: "#0f172a",
   skyTop: "#080e1a",
   skyBottom: "#152033",
   floor: "#131b2c",
   floorGrid: "#1f2d47",
   floorPlates: "#182338",
   platform: "#1a253c",
   platformEdge: "#2f4063",
   steel: "#cbd5e1",
   steelMid: "#64748b",
   steelDark: "#334155",
   frame: "#1e293b",
   belt: "#1b2436",
   beltStripe: "#38bdf8",
   beltFrame: "#0b1220",
   rim: "#7dd3fc",
   rimDim: "#1e4e6b",
   good: "#34d399",
   bad: "#f87171",
   warn: "#fb923c",
   gold: "#fde68a",
   white: "#f8fafc",
   joint: "#475569",
   screen: "#071426",
   screenLine: "#1d4ed8",
   screenText: "#e0f2fe",
   hazard: "#facc15",
   hazardDark: "#111827",
   bin: "#273449",
   faulty: "#ef4444",
   pipe: "#38bdf8",
   pipeDark: "#0369a1",
   wall: "#0d1527",
   wallPanel: "#162035",
   catwalk: "#1e293b",
   catwalkRail: "#facc15",
   /** part colours by COLOURS index: sky, amber, coral, lime */
   parts: ["#7dd3fc", "#fbbf24", "#f87171", "#a3e635"],
} as const;

/**
 * Play area envelope. All gameplay interactions (conveyors, claw, parts, bins,
 * cradle, walk-off, blueprint board) happen strictly within these bounds.
 * All decor must sit completely outside this bounding box.
 */
export const PLAY_BOUNDS = {
   xMin: -3.05,
   xMax: 2.95,
   yMin: -0.05,
   yMax: 2.15,
   zMin: -1.3,
   zMax: 1.35,
} as const;

/** Floor plane size covering the entire viewport at all three device sizes. */
export const FLOOR_PLANE = {
   width: 80,
   depth: 60,
   x: 0,
   y: 0,
   z: 5,
} as const;

export interface DecorSpot {
   kind: "pipe" | "screen" | "crate" | "catwalk" | "robotArm" | "pillar";
   x: number;
   y: number;
   z: number;
   rotY?: number;
   rotX?: number;
   rotZ?: number;
   sx?: number;
   sy?: number;
   sz?: number;
   /** Approximate bounding radius for occlusion checks */
   radius: number;
}

/**
 * All decor positions outside the play area:
 * 1. Back wall (z <= -2.4): pipes, diagnostic screens, catwalk, high wall panels.
 * 2. Left surroundings (x <= -3.6): component crates, idle robot arms, structural pillars.
 * 3. Right surroundings (x >= 3.4): staging crates, inspection arm, structural pillars.
 * Zero decor in front (+z) between x -3.5 and 3.5, keeping camera view 100% unobstructed.
 */
export const DECOR_SPOTS: readonly DecorSpot[] = [
   // --- Structural Pillars framing the factory bay ---
   { kind: "pillar", x: -4.4, y: 2.6, z: -2.6, radius: 0.5 },
   { kind: "pillar", x: -4.4, y: 2.6, z: 1.6, radius: 0.5 },
   { kind: "pillar", x: 4.4, y: 2.6, z: -2.6, radius: 0.5 },
   { kind: "pillar", x: 4.4, y: 2.6, z: 1.6, radius: 0.5 },
   { kind: "pillar", x: -6.8, y: 2.6, z: -0.5, radius: 0.5 },
   { kind: "pillar", x: 6.8, y: 2.6, z: -0.5, radius: 0.5 },

   // --- High Back Wall Catwalks (overhead at y = 3.2, z = -2.2) ---
   { kind: "catwalk", x: -6.0, y: 3.2, z: -2.2, rotY: 0, sx: 1, sy: 1, sz: 1, radius: 0.55 },
   { kind: "catwalk", x: -2.0, y: 3.2, z: -2.2, rotY: 0, sx: 1, sy: 1, sz: 1, radius: 0.55 },
   { kind: "catwalk", x: 2.0, y: 3.2, z: -2.2, rotY: 0, sx: 1, sy: 1, sz: 1, radius: 0.55 },
   { kind: "catwalk", x: 6.0, y: 3.2, z: -2.2, rotY: 0, sx: 1, sy: 1, sz: 1, radius: 0.55 },

   // --- Industrial Piping along the back wall ---
   { kind: "pipe", x: 0, y: 3.6, z: -2.7, rotZ: Math.PI / 2, sx: 0.14, sy: 18.0, sz: 0.14, radius: 0.3 },
   { kind: "pipe", x: 0, y: 2.45, z: -2.7, rotZ: Math.PI / 2, sx: 0.11, sy: 18.0, sz: 0.11, radius: 0.25 },
   { kind: "pipe", x: -6.0, y: 2.6, z: -2.7, sx: 0.12, sy: 5.2, sz: 0.12, radius: 0.25 },
   { kind: "pipe", x: 6.0, y: 2.6, z: -2.7, sx: 0.12, sy: 5.2, sz: 0.12, radius: 0.25 },

   // --- Diagnostic Wall Consoles / Screens (y >= 2.4, z = -2.6) ---
   { kind: "screen", x: -2.8, y: 2.5, z: -2.6, rotY: 0.08, sx: 1.3, sy: 0.8, sz: 0.12, radius: 0.7 },
   { kind: "screen", x: -1.0, y: 2.7, z: -2.6, rotY: 0.03, sx: 1.1, sy: 0.65, sz: 0.12, radius: 0.6 },
   { kind: "screen", x: 1.0, y: 2.7, z: -2.6, rotY: -0.03, sx: 1.1, sy: 0.65, sz: 0.12, radius: 0.6 },
   { kind: "screen", x: 2.8, y: 2.5, z: -2.6, rotY: -0.08, sx: 1.3, sy: 0.8, sz: 0.12, radius: 0.7 },

   // --- Left Flank: Stacks of Parts Crates (x <= -3.8) ---
   { kind: "crate", x: -4.0, y: 0.26, z: -0.5, rotY: 0.05, radius: 0.45 },
   { kind: "crate", x: -4.0, y: 0.26, z: 0.35, rotY: -0.08, radius: 0.45 },
   { kind: "crate", x: -4.8, y: 0.26, z: -0.2, rotY: 0.12, radius: 0.45 },
   { kind: "crate", x: -4.8, y: 0.26, z: 0.6, rotY: -0.04, radius: 0.45 },
   { kind: "crate", x: -4.0, y: 0.76, z: -0.5, rotY: -0.06, radius: 0.45 },
   { kind: "crate", x: -4.8, y: 0.76, z: -0.2, rotY: 0.08, radius: 0.45 },
   { kind: "crate", x: -4.0, y: 0.76, z: 0.35, rotY: 0.14, radius: 0.45 },

   // --- Right Flank: Component Crates (x >= 3.6) ---
   { kind: "crate", x: 3.8, y: 0.26, z: 0.7, rotY: -0.06, radius: 0.45 },
   { kind: "crate", x: 3.8, y: 0.26, z: 1.5, rotY: 0.1, radius: 0.45 },
   { kind: "crate", x: 4.6, y: 0.26, z: 0.5, rotY: 0.04, radius: 0.45 },
   { kind: "crate", x: 4.6, y: 0.26, z: 1.3, rotY: -0.15, radius: 0.45 },
   { kind: "crate", x: 3.8, y: 0.76, z: 0.7, rotY: 0.08, radius: 0.45 },
   { kind: "crate", x: 4.6, y: 0.76, z: 1.3, rotY: 0.03, radius: 0.45 },

   // --- Idle Robotic Arms at side staging stations ---
   { kind: "robotArm", x: -4.0, y: 0, z: -1.4, rotY: 0.75, radius: 0.7 },
   { kind: "robotArm", x: -4.2, y: 0, z: 1.3, rotY: -0.45, radius: 0.7 },
   { kind: "robotArm", x: 3.8, y: 0, z: -1.3, rotY: -0.85, radius: 0.7 },
   { kind: "robotArm", x: 4.1, y: 0, z: 0.1, rotY: 0.35, radius: 0.7 },
] as const;

export function decorOf(kind: DecorSpot["kind"]): DecorSpot[] {
   return DECOR_SPOTS.filter((s) => s.kind === kind);
}

/** Is this position (with optional bounding radius) inside the play area envelope? */
export function inPlayBounds(x: number, z: number, radius = 0): boolean {
   return (
      x + radius >= PLAY_BOUNDS.xMin &&
      x - radius <= PLAY_BOUNDS.xMax &&
      z + radius >= PLAY_BOUNDS.zMin &&
      z - radius <= PLAY_BOUNDS.zMax
   );
}
