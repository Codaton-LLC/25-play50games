// The follow camera and the intro's shots (pure, no three.js). The camera sits behind and above the
// hero (the route climbs towards -z), looks a little ahead and up at the next platform, and frames
// more height on a portrait screen. Scene.tsx eases towards cameraGoal every frame; the intro's
// fly-through (core/intro) ends exactly on playCamera, the pose the follow camera starts from.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { Course } from "./rules";

export const FOV = 55;
export const FOV_PORTRAIT = 66;

export interface CameraGoal {
   px: number;
   py: number;
   pz: number;
   lx: number;
   ly: number;
   lz: number;
}

/** Behind and above the focus: wider and higher on a portrait screen (aspect < 1). */
export function cameraOffset(aspect: number): { up: number; back: number } {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return { up: 2.9 + 1.6 * portrait, back: 5.6 + 2.8 * portrait };
}

/**
 * Where the camera wants to be: the focus is the hero's chest pulled a third of the way to the next
 * platform's top (so the next jump is on screen), the camera behind it on +z and above it.
 */
export function cameraGoal(
   hx: number,
   hy: number,
   hz: number,
   nx: number,
   ny: number,
   nz: number,
   aspect: number,
   out: CameraGoal,
): CameraGoal {
   const k = 0.35;
   const fx = hx + (nx - hx) * k * 0.5;
   const fy = hy + 1.1 + Math.max(0, ny - hy) * k;
   const fz = hz + Math.max(-6, (nz - hz) * k);
   const { up, back } = cameraOffset(aspect);
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   // look past the hero and a little up, so the hero sits in the lower third with the next jump above
   // it (on a portrait phone less high: the touch controls and the cookie banner take the bottom)
   out.lx = fx;
   out.ly = fy + 0.9 - 1.6 * portrait;
   out.lz = fz - 4.5;
   // the camera keeps its distance to the hero (not to the look-ahead point), rising with the next top
   out.px = hx * 0.6 + fx * 0.25;
   out.py = hy + 1.1 + up + Math.max(0, ny - hy) * 0.15;
   out.pz = hz + back;
   return out;
}

/** The follow camera's pose on the start platform (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const start = course.supports[course.checkpoints[0]];
   const next = course.supports[1];
   const g = cameraGoal(start.cx, start.top, start.cz + 1.5, next.cx, next.top, next.cz, aspect, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
   return { position: [g.px, g.py, g.pz], lookAt: [g.lx, g.ly, g.lz] };
}

/**
 * The fly-through: from the sky gate at the top, down along the tower past the checkpoints, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.supports[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.supports[i]);
   const shots: IntroKeyframe[] = [
      // establishing: the gate and the sky tower from out in the sky, then down along the route
      { position: [goal.cx + 34, goal.top + 16, goal.cz + 26], lookAt: [goal.cx, goal.top + 4, goal.cz - 4] },
      { position: [goal.cx + 12, goal.top + 6, goal.cz + 14], lookAt: [goal.cx, goal.top + 2, goal.cz - 3] },
   ];
   let side = -1;
   for (let i = cps.length - 1; i >= 0; i--) {
      const c = cps[i];
      shots.push({ position: [c.cx + side * 22, c.top + 11, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 3] });
      side = -side;
   }
   return shots;
}
