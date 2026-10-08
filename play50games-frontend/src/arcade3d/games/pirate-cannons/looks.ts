// Pirate Cannon Battle looks worth a test: the fixed camera's fit per screen and the palette. Pure:
// no three.js, no React. The camera stands behind the cannon looking out to sea, so the lanes'
// depth reads as distance.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

const DEG = Math.PI / 180;

/** The canvas camera's fov (definition.camera.fov). */
export const FOV = 50;
/** Low and behind the cannon on a landscape screen; steeper in portrait (a 38 m field cannot fit a narrow screen from a low eye). */
export const PITCH = { landscape: 12 * DEG, portrait: 30 * DEG } as const;

/** The three lanes with their zig-zags and spheres: what must stay on screen. */
export const SEA_BOX: AABB = { min: { x: -19, y: 0, z: -60 }, max: { x: 19, y: 6, z: -20 } };
/** The point the camera looks at: the near lane's centre line, so the cannon below it stays in view. */
export const SEA_FOCUS: [number, number, number] = [0, 0, -20];
/**
 * The camera stays at least this far behind the cannon (m): a landscape phone's wide view would
 * otherwise fit the near lane from right above the fort and lose the cannon under the screen.
 */
export const CAMERA_BEHIND = 9;

const FOCUS = [{ x: SEA_FOCUS[0], y: SEA_FOCUS[1], z: SEA_FOCUS[2] }];
const YAWS = [0];
const MARGIN = { top: 0.1, bottom: 0.03, left: 0.02, right: 0.02 };
const view = (pitch: number): FittedViewOptions => ({
   area: SEA_BOX,
   pitch,
   yaws: YAWS,
   focus: FOCUS,
   margin: MARGIN,
   padding: 8,
   shift: true,
   fov: FOV,
   minDistance: (CAMERA_BEHIND - SEA_FOCUS[2]) / Math.cos(pitch),
});
const VIEWS = { landscape: view(PITCH.landscape), portrait: view(PITCH.portrait) };

/** The fit for this canvas (one cached object per orientation, so useFittedView refits only on a turn). */
export function viewFor(width: number, height: number): FittedViewOptions {
   return width >= height ? VIEWS.landscape : VIEWS.portrait;
}

export const COLORS = {
   sea: "#0ea5e9",
   deep: "#0369a1",
   sand: "#fde68a",
   stone: "#a8a29e",
   stoneDark: "#78716c",
   sail: "#f8fafc",
   coral: "#fca5a5",
   accent: "#f87171",
   wood: "#92400e",
   ball: "#1f2937",
   dots: "#fff7ed",
   ring: "#fde68a",
   buoyRed: "#ef4444",
   buoyWhite: "#f8fafc",
   flag: "#f87171",
   palm: "#4d7c0f",
   trunk: "#a16207",
   barrel: "#b91c1c",
   chest: "#8b5a2b",
} as const;

/** The fort: the platform (top y = rules CANNON.platformY) and its parapet along the sea side, kept under the lowest shot. */
export const FORT = { halfX: 4.2, front: -3, back: 4, bottom: -1, parapetTop: 2.55, parapetDepth: 0.5 } as const;
