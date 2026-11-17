// The firefighter's poses, built from the core/rig poses. Pure and allocation-free (no three.js,
// no React): Scene.tsx calls firefighterPose from useHumanoidPose, firefighter.test.ts checks every
// state on the real mesh.
//
// - walk / run: core walkPose, its phase stepped by gaitPhaseStep (the walk's own stride, planted feet)
// - the right hand always carries the extinguisher: forearm forward at the waist, the canister hanging
//   from its handle (attach handR); a spray raises it forward to the chest
// - while a neighbour follows, the left arm reaches back to guide them
// - a hop tucks (jumpPose); a win cheers (cheerPose), the extinguisher still in hand
import { aimArm, cheerPose, idlePose, jumpPose, walkPose, type HumanoidPose } from "@/arcade3d/core/rig";

export interface FirefighterPoseState {
   /** walkPose phase (rad) */
   phase: number;
   /** 0 = standing, ~0.5 walk, 1 = full run */
   amount: number;
   /** game time (s) for the idle breath and the cheer wave */
   now: number;
   spray: boolean;
   /** a neighbour is following */
   guide: boolean;
   /** 0..1 hop height share (0 = on the floor) */
   hop: number;
   win: boolean;
}

/** walkPose below this amount reads as standing: idle instead. */
export const WALK_FROM = 0.08;
/** The carry turns the forearm about its own axis so the hand frame stays upright (+y up) as in the
 * spray: the extinguisher (attach handR) hangs straight down from the hand in both (measured on the rig). */
export const CARRY_ROLL = Math.PI / 2;

export function firefighterPose(s: FirefighterPoseState, out: HumanoidPose): HumanoidPose {
   if (s.win) {
      cheerPose(s.now, out);
      return out;
   }
   if (s.hop > 0) jumpPose(s.hop, out);
   else if (s.amount > WALK_FROM) walkPose(s.phase, Math.max(0.35, s.amount), out);
   else idlePose(s.now, out);
   // the extinguisher arm (right, side -1): directions in the chest frame, +z forward, +x away from the body
   if (s.spray) {
      // aimed forward at chest height, a small shake from the jet
      const jitter = 0.03 * Math.sin(s.now * 40);
      aimArm(out, -1, 0.12, -0.45, 0.88, 0.02, 0.12 + jitter, 1);
   } else {
      // carried: upper arm hanging a little forward, forearm level and forward, swinging slightly with the walk
      const swing = s.amount > WALK_FROM ? 0.12 * Math.sin(s.phase) * Math.min(1, s.amount) : 0;
      aimArm(out, -1, 0.14, -1, 0.18 + swing, 0.04, -0.12, 1, CARRY_ROLL);
   }
   if (s.guide) {
      // the free left arm reaches back and down towards the neighbour behind
      aimArm(out, 1, 0.3, -0.8, -0.5, 0.2, -0.55, -0.8);
   }
   return out;
}
