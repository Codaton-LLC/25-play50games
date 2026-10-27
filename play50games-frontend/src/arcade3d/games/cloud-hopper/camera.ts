// The follow camera and the intro's shots (pure, no three.js). The camera sits behind, above and a
// little to the side of the hero (a 3/4 view down the run towards -z), looks ahead at the next cloud,
// and frames more height on a portrait screen. Scene.tsx eases towards cameraGoal every frame; the intro's
// fly-through (core/intro) ends exactly on playCamera, the pose the follow camera starts from.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { Course } from "./rules";

export const FOV = 55;
export const FOV_PORTRAIT = 66;
/** the 3/4 view: the camera sits this far to the +x side of the run */
export const SIDE = 2.4;

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
   // only ever ahead (-z) of the hero, never behind it
   const fz = hz + Math.min(0, Math.max(-6, (nz - hz) * k));
   const { up, back } = cameraOffset(aspect);
   // look past the hero and a little up, so the hero sits in the lower third with the next jump above
   // it (on a portrait phone less high: the touch controls and the cookie banner take the bottom)
   out.lx = fx;
   out.ly = fy + 0.1;
   out.lz = fz - 4.5;
   // the camera keeps its distance to the hero (not to the look-ahead point), rising with the next top
   out.px = hx * 0.6 + fx * 0.25 + SIDE;
   out.py = hy + 1.1 + up + Math.max(0, ny - hy) * 0.15;
   out.pz = hz + back;
   return out;
}

/** The follow camera's pose on the start platform (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const start = course.clouds[course.checkpoints[0]];
   const next = course.clouds[course.route[1]];
   const g = cameraGoal(start.cx, start.top, course.startZ, next.cx, next.top, next.cz, aspect, { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 });
   return { position: [g.px, g.py, g.pz], lookAt: [g.lx, g.ly, g.lz] };
}

/**
 * The fly-through: from the rainbow bridge at the far end, back along the run past the anchor clouds, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.clouds[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.clouds[i]);
   // the establishing shot: the rainbow bridge from high out over the cloud sea
   const shots: IntroKeyframe[] = [{ position: [goal.cx + 30, goal.top + 18, goal.cz - 10], lookAt: [goal.cx, goal.top + 2, goal.cz] }];
   // then back along the run over at most three anchor clouds (far to near), each shot a little lower
   const picks = cps.length <= 3 ? cps.slice() : [cps[cps.length - 1], cps[Math.floor(cps.length / 2)], cps[0]];
   picks.sort((a, b) => a.cz - b.cz);
   let side = -1;
   picks.forEach((c, k) => {
      shots.push({ position: [c.cx + side * 16, c.top + 14 - 2 * k, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 6] });
      side = -side;
   });
   return shots;
}
