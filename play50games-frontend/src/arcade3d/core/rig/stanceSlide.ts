// How far a character's planted foot slides (tests only; the app never imports this file). A game's
// gait test drives its own gait frame by frame, poses the character and hands each frame to a
// slide meter with where the body is in the world; the meter follows each foot through every
// stance (the foot on the floor and carrying the body: its sole, lifted by bodyLift, within
// CONTACT_EPS of the floor and not above the other one, the same contact as contactStride) and
// compares how far the foot moved from touch-down to lift-off with how far the body went meanwhile.
// The foot's place is its ankle (core footPoint) or, on the real mesh (rigCharacter), the centroid
// of its sole's vertices skinned like the vertex shader does.
import { Vector3 } from "three";
import type { RiggedCharacter } from "./characterChecks";
import { CONTACT_EPS, bodyLift, footPoint } from "./gait";
import type { HumanoidLandmarks } from "./humanoid";
import { createPose, walkPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose } from "./skinning";

const TAU = Math.PI * 2;

/** Where both feet are in a pose (GLB units, the body unlifted): [lx, lz, rx, rz]. */
export type FeetOf = (pose: HumanoidPose, out: Float64Array) => Float64Array;

/** The ankles (core footPoint): the joints' forward kinematics. */
export function ankleFeet(l: HumanoidLandmarks): FeetOf {
   const f = new Float64Array(4);
   return (pose, out) => {
      footPoint(pose, l, 1, f);
      out[0] = f[0];
      out[1] = f[2];
      footPoint(pose, l, -1, f);
      out[2] = f[0];
      out[3] = f[2];
      return out;
   };
}

/** The real mesh's soles: the centroid of each foot's vertices within `below` (GLB units, default 3.5 cm) of the floor at rest. */
export function meshFeet(character: RiggedCharacter, below = 0.035): FeetOf {
   const rest = character.glb.cloud;
   const soles: [number[], number[]] = [[], []];
   for (let i = 0; i < rest.length / 3; i++) if (rest[i * 3 + 1] < below) soles[rest[i * 3] > 0 ? 0 : 1].push(i);
   const at = new Vector3();
   const { rig, skin, position } = character;
   return (pose, out) => {
      // without the lift (the meter adds it), only the soles' vertices
      applyHumanoidPose(rig, pose, false);
      rig.root.updateMatrixWorld(true);
      for (let side = 0; side < 2; side++) {
         const ids = soles[side];
         let x = 0;
         let z = 0;
         for (const i of ids) {
            skin.applyBoneTransform(i, at.fromBufferAttribute(position, i)).applyMatrix4(skin.matrixWorld);
            x += at.x;
            z += at.z;
         }
         out[side * 2] = x / ids.length;
         out[side * 2 + 1] = z / ids.length;
      }
      return out;
   };
}

export interface SlideResult {
   /** the feet's travel from touch-down to lift-off over the body's travel meanwhile, summed over every stance (0 = planted, 1 = sliding along with the body) */
   net: number;
   /** the farthest (world units) a foot got from its touch-down point within any stance */
   maxDrift: number;
   /** the stances counted (each foot's; the first, which may have begun before the meter, skipped) */
   stances: number;
   /** the body's travel inside those stances (world units) */
   travel: number;
}

export interface SlideMeter {
   /**
    * One frame: `pose` as drawn (lifted by bodyLift unless `lift`, GLB units, is given), the
    * character's group at (x, z) in the world turned by `yaw` (three.js rotation.y; the model faces
    * +z), drawn at the meter's scale.
    */
   add(pose: HumanoidPose, x: number, z: number, yaw: number, lift?: number): void;
   result(): SlideResult;
}

interface Stance {
   start: number;
   /** the foot at touch-down and now (world) */
   fx: number;
   fz: number;
   ex: number;
   ez: number;
   /** the body's travel since touch-down, the foot's farthest from its touch-down point */
   path: number;
   drift: number;
}

/** One frame of a game's gait: walkPose's phase and amount, and how fast the body moves (m/s). */
export interface GaitFrame {
   phase: number;
   amount: number;
   speed: number;
}

/**
 * Drives a game's gait (`step(dt, t)`: one frame of `dt` s at time `t`, returning the gait) at `hz`
 * frames a second for `seconds`, the body carried straight ahead by its speed, and meters the
 * walkPose it draws from `warm` s on. `cadence`: strides a second over the metered time.
 */
export function gaitSlide(
   l: HumanoidLandmarks,
   scale: number,
   feetOf: FeetOf,
   step: (dt: number, t: number) => GaitFrame,
   seconds = 3,
   warm = 1,
   hz = 600
): SlideResult & { cadence: number } {
   const meter = createSlideMeter(l, scale, feetOf);
   const pose = createPose();
   const dt = 1 / hz;
   let z = 0;
   let turned = 0;
   let last = NaN;
   const frames = Math.round(seconds * hz);
   for (let i = 0; i < frames; i++) {
      const t = i * dt;
      const g = step(dt, t);
      z += g.speed * dt;
      if (t < warm) {
         last = g.phase;
         continue;
      }
      if (!Number.isNaN(last)) turned += (((g.phase - last) % TAU) + TAU) % TAU;
      last = g.phase;
      meter.add(walkPose(g.phase, g.amount, pose), 0, z, 0);
   }
   return { ...meter.result(), cadence: turned / TAU / (seconds - warm) };
}

/** A slide meter for a character with landmarks `l` drawn at `scale`, its feet placed by `feetOf` (default: the ankles). */
export function createSlideMeter(l: HumanoidLandmarks, scale: number, feetOf: FeetOf = ankleFeet(l)): SlideMeter {
   const feet = new Float64Array(4);
   const f = new Float64Array(4);
   const open: Array<Stance | null> = [null, null];
   const seen = [false, false];
   let lastX = NaN;
   let lastZ = NaN;
   let slide = 0;
   let travel = 0;
   let maxDrift = 0;
   let stances = 0;
   let frame = 0;
   return {
      add(pose, x, z, yaw, lift = bodyLift(pose, l)) {
         const soleL = footPoint(pose, l, 1, f)[3] + lift;
         const soleR = footPoint(pose, l, -1, f)[3] + lift;
         feetOf(pose, feet);
         const c = Math.cos(yaw);
         const s = Math.sin(yaw);
         const step = Number.isNaN(lastX) ? 0 : Math.hypot(x - lastX, z - lastZ);
         lastX = x;
         lastZ = z;
         for (let side = 0; side < 2; side++) {
            const sole = side === 0 ? soleL : soleR;
            const other = side === 0 ? soleR : soleL;
            const on = sole < CONTACT_EPS && sole <= other + 1e-9;
            const lx = feet[side * 2] * scale;
            const lz = feet[side * 2 + 1] * scale;
            const wx = x + lx * c + lz * s;
            const wz = z - lx * s + lz * c;
            const st = open[side];
            if (on && !st) {
               open[side] = { start: frame, fx: wx, fz: wz, ex: wx, ez: wz, path: 0, drift: 0 };
            } else if (on && st) {
               st.path += step;
               st.ex = wx;
               st.ez = wz;
               st.drift = Math.max(st.drift, Math.hypot(wx - st.fx, wz - st.fz));
            } else if (!on && st) {
               if (seen[side] && frame - st.start > 1) {
                  slide += Math.hypot(st.ex - st.fx, st.ez - st.fz);
                  travel += st.path;
                  maxDrift = Math.max(maxDrift, st.drift);
                  stances++;
               }
               open[side] = null;
            }
            if (!on) seen[side] = true;
         }
         frame++;
      },
      result() {
         return { net: travel > 0 ? slide / travel : 0, maxDrift, stances, travel };
      },
   };
}
