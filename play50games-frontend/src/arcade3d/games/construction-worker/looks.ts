// Camera fit for the site wedge. One yaw per canvas shape so the picker cannot turn the
// portrait view sideways. The live look-at point is LOOK (Scene moves its y with the roof).
// Colors, decor definitions and boundary clearances for the modern look pass.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

export const PITCH = (40 * Math.PI) / 180;
export const FOV = 42;
/* Portrait / desktop yaw. 0.28 (was 0.6) puts the mast between the shell chips and the
   Mute / Pause buttons on a 390 x 844 phone; at 0.6 its top ran under the buttons. */
export const YAW = 0.28;
/* Short wide phone: a quarter turn plus 0.1 (was 0.6 + PI / 2), so the counter-jib and cab
   stay clear of the Mute / Pause buttons at 844 x 390. */
export const WIDE_YAW = Math.PI / 2 + 0.1;

/* Work zone: piles (r 7, z ≥ 6.3), slots (r 9.5, x ≤ 4.3, z ≤ 9.4), the hook
   block (rest top 5.7) and the worker at (2.6, 0, 5.35). The empty yard in
   front of the piles, and the mast above the hook, may leave the frame. */
export const AREA: AABB = { min: { x: -4.8, y: 0, z: 4.8 }, max: { x: 4.8, y: 5.7, z: 10.2 } };
export const FOCUS = [{ x: 0, y: 1.2, z: 7.5 }, { x: 0, y: 2.6, z: 7.5 }];
export const MARGIN = { top: 0.1, bottom: 0.08, left: 0.02, right: 0.02 };
const BASE = { area: AREA, pitch: PITCH, focus: FOCUS, margin: MARGIN, padding: 8, shift: true as const, fov: FOV };

const PORTRAIT: FittedViewOptions = { ...BASE, yaws: [YAW] };
const WIDE: FittedViewOptions = { ...BASE, yaws: [WIDE_YAW] };

/** Portrait and desktop use YAW. A short wide phone (width / height > 1.9) uses WIDE_YAW. */
export function viewFor(width: number, height: number): FittedViewOptions {
   return width / Math.max(1, height) > 1.9 ? WIDE : PORTRAIT;
}

/** CameraRig follows this. y = 0.35 * roof height, written from the run each frame. */
export const LOOK = { x: 0, y: 0.5, z: 7.5 };

/**
 * Cohesive construction site palette. Every visible object derives its tones from here.
 * Warm golden daylight mood, high contrast between worker, crane and pieces.
 */
export const COLORS = {
   // Sky & Atmosphere
   skyTop: "#38bdf8",
   skyBottom: "#fed7aa",
   fog: "#fed7aa",
   sun: "#fffbeb",
   cloud: "#ffffff",
   cloudShade: "#e2e8f0",

   // Ground & Site
   dirt: "#d6c7b2",
   dirtDark: "#b8a48c",
   concrete: "#e2e8f0",
   concreteDark: "#94a3b8",
   asphalt: "#475569",
   curb: "#cbd5e1",

   // Machinery & Equipment
   craneYellow: "#f59e0b",
   craneOrange: "#ea580c",
   craneDark: "#0f172a",
   steel: "#475569",
   steelLight: "#94a3b8",
   cabGlass: "#38bdf8",

   // Safety & Decor
   safetyOrange: "#ea580c",
   safetyWhite: "#f8fafc",
   safetyYellow: "#facc15",
   coneBase: "#1e293b",
   barrierConcrete: "#e2e8f0",
   barrierStripe: "#dc2626",
   pipeSteel: "#64748b",
   pipeInterior: "#1e293b",
   woodPallet: "#b45309",

   // Distant Skyline
   skyline: "#94a3b8",
   skylineDark: "#64748b",
   skylineWindow: "#fef08a",

   // 5 Construction Materials (Pieces)
   pieceSlab: "#e2e8f0",
   piecePillar: "#1d4ed8",
   pieceWall: "#ea580c",
   pieceWindow: "#38bdf8",
   pieceWindowFrame: "#f1f5f9",
   pieceRoof: "#d97706",

   // HUD & Feedback Guides
   guideSlate: "#64748b",
   guideMint: "#34d399",
   guideGold: "#fbbf24",
   flashRed: "#fb7185",
} as const;

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

export interface DecorSpot {
   kind: "cone" | "barrier" | "pipes" | "skyline" | "cloud";
   x: number;
   y: number;
   z: number;
   rotY?: number;
   sx?: number;
   sy?: number;
   sz?: number;
   tone?: number;
}

export const CLOUD_DRIFT = 2.0;

export const DECOR: readonly DecorSpot[] = [
   // Cones (left side perimeter, right side perimeter, rear entrance)
   { kind: "cone", x: -6.4, y: 0, z: 4.2, rotY: 0.3, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: -6.4, y: 0, z: 5.2, rotY: -0.2, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: -6.4, y: 0, z: 7.8, rotY: 0.5, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: -6.4, y: 0, z: 8.8, rotY: 0.1, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: 6.8, y: 0, z: 3.8, rotY: 0.4, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: 7.0, y: 0, z: 5.0, rotY: -0.3, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: 6.9, y: 0, z: 6.8, rotY: 0.2, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: 6.8, y: 0, z: 8.4, rotY: -0.5, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: -2.0, y: 0, z: -1.2, rotY: 0, sx: 1, sy: 1, sz: 1 },
   { kind: "cone", x: 2.0, y: 0, z: -1.2, rotY: 0, sx: 1, sy: 1, sz: 1 },

   // Barriers (Jersey concrete barricades along rear access road and side perimeter)
   { kind: "barrier", x: -4.8, y: 0, z: -1.6, rotY: 0, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: -3.0, y: 0, z: -1.6, rotY: 0, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: 3.0, y: 0, z: -1.6, rotY: 0, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: 4.8, y: 0, z: -1.6, rotY: 0, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: -7.5, y: 0, z: 2.8, rotY: Math.PI / 2, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: -7.5, y: 0, z: 8.5, rotY: Math.PI / 2, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: 7.5, y: 0, z: 2.8, rotY: Math.PI / 2, sx: 1, sy: 1, sz: 1 },
   { kind: "barrier", x: 7.5, y: 0, z: 8.5, rotY: Math.PI / 2, sx: 1, sy: 1, sz: 1 },

   // Stacked pipes (material storage behind crane and at east yard)
   { kind: "pipes", x: -4.4, y: 0, z: -0.8, rotY: 0.15, sx: 1, sy: 1, sz: 1 },
   { kind: "pipes", x: 6.4, y: 0, z: 1.2, rotY: -0.1, sx: 1, sy: 1, sz: 1 },

   // Distant city skyline silhouettes (far background behind the construction site, z <= -30)
   { kind: "skyline", x: -28, y: 0, z: -32, sx: 5.5, sy: 18, sz: 5.5, tone: 0 },
   { kind: "skyline", x: -20, y: 0, z: -30, sx: 4.8, sy: 24, sz: 4.8, tone: 1 },
   { kind: "skyline", x: -13, y: 0, z: -34, sx: 4.2, sy: 15, sz: 4.2, tone: 0 },
   { kind: "skyline", x: -6, y: 0, z: -32, sx: 5.0, sy: 22, sz: 5.0, tone: 1 },
   { kind: "skyline", x: 2, y: 0, z: -35, sx: 4.5, sy: 19, sz: 4.5, tone: 0 },
   { kind: "skyline", x: 9, y: 0, z: -31, sx: 5.2, sy: 27, sz: 5.2, tone: 1 },
   { kind: "skyline", x: 17, y: 0, z: -33, sx: 4.4, sy: 16, sz: 4.4, tone: 0 },
   { kind: "skyline", x: 25, y: 0, z: -30, sx: 5.6, sy: 21, sz: 5.6, tone: 1 },

   // Drifting clouds (high above, y >= 15.5, z <= -20)
   { kind: "cloud", x: -14, y: 15.5, z: -22, sx: 3.5, sy: 1.2, sz: 2.2, tone: 0 },
   { kind: "cloud", x: -4, y: 17.0, z: -25, sx: 4.2, sy: 1.4, sz: 2.5, tone: 0 },
   { kind: "cloud", x: 7, y: 16.2, z: -20, sx: 3.8, sy: 1.3, sz: 2.3, tone: 0 },
   { kind: "cloud", x: 16, y: 17.5, z: -24, sx: 4.0, sy: 1.4, sz: 2.4, tone: 0 },
];

export function decorOf(kind: DecorSpot["kind"]): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind);
}

/** True if (x, z) falls inside the fitted play work area. */
export function inWorkArea(x: number, z: number, margin = 0): boolean {
   return (
      x >= AREA.min.x - margin &&
      x <= AREA.max.x + margin &&
      z >= AREA.min.z - margin &&
      z <= AREA.max.z + margin
   );
}
