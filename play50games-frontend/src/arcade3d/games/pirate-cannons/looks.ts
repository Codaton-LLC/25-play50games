// Pirate Cannon Battle looks worth a test: the fixed camera's fit per screen and the palette. Pure:
// no three.js, no React. The camera stands behind the cannon looking out to sea, so the lanes'
// depth reads as distance.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

const DEG = Math.PI / 180;

/** The canvas camera's fov (definition.camera.fov). */
export const FOV = 50;
/**
 * The tilt. A low eye (the design's 14° for landscape) cannot show the cannon: the
 * 38 m near lane fills a landscape screen from right above the fort, so the cannon fell under it, and
 * the 40 m of lanes folded into a strip a tenth of the screen tall. 30° shows the cannon at the
 * bottom and spreads the lanes up the screen; landscape goes to 36° (the lanes take a third of the
 * screen, the cannon two thirds down), portrait keeps the decided 30°.
 */
export const PITCH = { landscape: 36 * DEG, portrait: 30 * DEG } as const;

/** The three lanes (with their zig-zags and spheres) and the cannon (its muzzle is inside, z -0.8, y 3): what must stay on screen. */
export const SEA_BOX: AABB = { min: { x: -19, y: 0, z: -60 }, max: { x: 19, y: 6, z: 0 } };
/** The point the camera looks at: the box's floor centre (useFittedView's default focus). */
export const SEA_FOCUS: [number, number, number] = [0, 0, -30];

const YAWS = [0];
const MARGIN = { top: 0.08, bottom: 0.03, left: 0.02, right: 0.02 };
const view = (pitch: number): FittedViewOptions => ({ area: SEA_BOX, pitch, yaws: YAWS, margin: MARGIN, padding: 8, shift: true, fov: FOV });
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
   dots: "#fef3c7",
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
export const FORT = { halfX: 2.8, front: -1.9, back: 3.2, bottom: -1, parapetTop: 2.55, parapetDepth: 0.4 } as const;
