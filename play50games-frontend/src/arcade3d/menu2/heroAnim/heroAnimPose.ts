// The animator's pose: every state's pose (heroPoses.ts) blended by the state machine's weights
// (heroAnimState.ts) into one HumanoidPose for <HumanoidModel>. Pure and allocation-free (one scratch
// pose per state, made once).
import { MIN_GAIT_STRIDE } from "@/arcade3d/core/rig/gait";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { blendPoses, copyPose, createPose, wrapPhase, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { HERO_STATE_COUNT, HERO_TIMING, HS, type HeroAnimState } from "./heroAnimState";
import {
   clearFloor,
   curlPose,
   dashPose,
   defeatPose,
   fallPose,
   flipPose,
   heroCheerPose,
   heroIdlePose,
   heroRunPose,
   heroStride,
   hurtPose,
   landPose,
   risePose,
   takeoffPose,
   type RunExtras,
} from "./heroPoses";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The run's legs never go slower than this amount once running (a start from standing still moves its feet). */
const RUN_MIN_AMOUNT = 0.18;

/**
 * Advances the stride phase by the ground speed over the hero's own stride (heroStride x the drawn
 * `scale`), so the planted foot stays put. Call it before composeHeroPose, with the same visual dt.
 */
export function advanceHeroGait(s: HeroAnimState, l: HumanoidLandmarks, scale: number, dt: number): void {
   if (!(dt > 0) || s.weights[HS.run] <= 0) return;
   const amount = Math.max(RUN_MIN_AMOUNT, s.runAmount);
   const stride = Math.max(MIN_GAIT_STRIDE, heroStride(amount, l) * scale);
   s.phase = wrapPhase(s.phase + ((s.speed * dt) / stride) * Math.PI * 2);
}

/** The landing crouch's depth `t` s after touchdown: in fast (60 ms), then out, deeper on a hard landing. */
export function landDepth(t: number, impact: number): number {
   if (!(t >= 0) || t === Infinity) return 0;
   const env = t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) * 7);
   return (0.45 + 0.55 * clamp01(impact)) * env;
}

const POSES: HumanoidPose[] = Array.from({ length: HERO_STATE_COUNT }, () => createPose());
const RUN_EXTRAS: RunExtras = { surge: 0 };

function buildState(i: number, s: HeroAnimState, l: HumanoidLandmarks, out: HumanoidPose): HumanoidPose {
   switch (i) {
      case HS.idle:
         return heroIdlePose(s.clock, out);
      case HS.run:
         return heroRunPose(s.phase, Math.max(RUN_MIN_AMOUNT, s.runAmount), l, out, RUN_EXTRAS);
      case HS.takeoff:
         return takeoffPose(1 - 0.5 * clamp01(s.sinceJump / HERO_TIMING.takeoff), out);
      case HS.rise:
         return risePose(s.tuck, out);
      case HS.fall:
         return fallPose(s.clock, clamp01(s.sinceFall / 0.5), out);
      case HS.land:
         return landPose(landDepth(s.sinceLand, s.landImpact), out);
      case HS.flip:
         return flipPose(out);
      case HS.ball:
         return curlPose(1, out);
      case HS.dash:
         return dashPose(s.clock, out);
      case HS.hurt:
         return hurtPose(Math.min(s.sinceHurt, 2), out);
      case HS.cheer:
         return heroCheerPose(s.sinceCheer, out);
      case HS.defeat:
      default:
         return defeatPose(s.sinceDefeat, out);
   }
}

/**
 * The hero's pose this frame: each state with a weight is built and the poses are averaged by their
 * weights (in turn: blend by w / the weight so far), then lifted clear of the floor. `extras.surge`
 * (GLB units) gets the run's planted-foot shift, scaled by the run's weight.
 */
export function composeHeroPose(s: HeroAnimState, l: HumanoidLandmarks, out: HumanoidPose, extras?: RunExtras): HumanoidPose {
   let acc = 0;
   RUN_EXTRAS.surge = 0;
   for (let i = 0; i < HERO_STATE_COUNT; i++) {
      const w = s.weights[i];
      if (!(w > 0)) continue;
      const pose = buildState(i, s, l, POSES[i]);
      if (acc === 0) copyPose(pose, out);
      else blendPoses(out, pose, w / (acc + w), out);
      acc += w;
   }
   if (acc === 0) copyPose(buildState(HS.idle, s, l, POSES[HS.idle]), out);
   if (extras) extras.surge = RUN_EXTRAS.surge * s.weights[HS.run];
   return clearFloor(out, l);
}
