// Looks at the finish (Scene.tsx; the rules never read them): the arch fading while a runner who
// jumped over the line cheers behind it, and the cheering runner's arm kept out of the arch's leg
// when it finished hugging a post. Pure, allocation-free; finishLooks.test.ts checks both on the
// real meshes and the real rules. README "Scene and camera".
import { POSE_MASK, aimArm, blendPoses, copyPose, type HumanoidPose } from "@/arcade3d/core/rig";
import type { EndReason, RunPhase } from "@/arcade3d/core/types";
import { ARCH, LINES } from "./rules";

/** The arch's opacity while it would hide the cheer. */
export const ARCH_FADED = 0.3;
/**
 * How far past the line (m) the runner must stand for the arch to fade: a walked finish stops on
 * the line (the rules finish on the ms it is crossed; the banner over the runner, clean up to about
 * 116.55), a jump lands 1.5-4.1 m past it, behind the banner and the top tube from the follow
 * camera (117.07 already hid the raised hands).
 */
export const ARCH_FADE_PAST = 0.6;

/** The arch's target opacity: faded only through the result delay of a win that ended past the line. */
export function archOpacity(phase: RunPhase, endReason: EndReason | null, runnerZ: number): number {
   return phase === "over" && endReason === "win" && -runnerZ > LINES.finish + ARCH_FADE_PAST ? ARCH_FADED : 1;
}

/**
 * The cheer's V reaches into the arch's leg when the runner's centre is closer to a post's centre
 * than about 1 m: the V's hand is about 0.45-0.5 m out from the centre and the leg's surface 0.545 m
 * round the post (on the real meshes, 0.9 m clips and 1.05 m is clear; finishLooks.test.ts checks
 * the V clear at POST_ARM_REACH and clipping where the ramp is complete); a runner stopped by a
 * post stands 0.75 m from it. The re-aim blends in over POST_ARM_RAMP, inside POST_ARM_REACH.
 */
export const POST_ARM_REACH = 1.15;
export const POST_ARM_RAMP = 0.15;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * How much arm `side` (the character's L = +1, R = -1) points at the near post, 0..1, for a runner
 * at (x, z) turned to `yaw` (Scene's group yaw; the GLB is turned round by its asset's rotationY,
 * so the character's L points along world (x, z) = (-cos yaw, sin yaw)). 0 when the runner is
 * clear of the posts or that arm points away from the post.
 */
export function postArmWeight(side: 1 | -1, x: number, z: number, yaw: number): number {
   const dx = (x < 0 ? -ARCH.postX : ARCH.postX) - x;
   const dz = -LINES.finish - z;
   const d = Math.hypot(dx, dz);
   const edge = clamp01((POST_ARM_REACH - d) / POST_ARM_RAMP);
   if (edge === 0) return 0;
   // the arm's axis against the direction to the post: 1 within about 48° of it, 0 at 90° and beyond
   const toward = (1.5 * side * (-Math.cos(yaw) * dx + Math.sin(yaw) * dz)) / d;
   return toward > 0 ? edge * clamp01(toward) : 0;
}

/**
 * The re-aimed arm in the world (for a post at +x; mirrored in x for the other one): up, in
 * towards the head, and back down the course (−z). A finish puts the runner level with the posts
 * or past them (p >= the line), so the post is never on its −z side: the hand moves away from the
 * leg. The shoulder itself stands at the leg's surface (the body touches the leg it was stopped
 * by), so the upper arm cannot go out at all: measured on the real meshes, the wrist ends about
 * 0.18 m out, 0.37 m over the shoulder and 0.17 m back, 0.6 m from the post's centre (the leg's
 * surface is at 0.545-0.57).
 */
const UPPER = { x: -0.4, y: 0.7, z: -0.55 } as const;
const FORE = { x: -0.3, y: 0.9, z: -0.35 } as const;

/**
 * Arm `side` of the cheer re-aimed: the world directions above turned into the character's frame
 * (the inverse of the group's yaw and the GLB's half turn; aimArm's x is "away from the body" for
 * either arm), waving a little.
 */
function aimAwayFromPost(out: HumanoidPose, side: 1 | -1, postSide: number, yaw: number, t: number): void {
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   const w = 0.1 * Math.sin(t * 9 + (side > 0 ? 0 : Math.PI));
   // world (x, z) -> character (x, z): rotate by -(yaw + pi)
   const ux = postSide * UPPER.x;
   const uz = UPPER.z - w;
   const fx = postSide * FORE.x;
   const fz = FORE.z - w;
   aimArm(out, side, side * (-ux * c + uz * s), UPPER.y + w, -ux * s - uz * c, side * (-fx * c + fz * s), FORE.y, -fx * s - fz * c);
}

/**
 * After the cheer is blended into `p` by `k`: the post-side arm goes up and back from the post
 * instead of out to the side, so a runner who crossed the line hugging a post (|x| up to 2.85)
 * keeps its hand out of the arch's leg (found in review: the V put it 0.24 m deep). `scratch` is
 * overwritten. No-op when the runner is clear of the posts.
 */
export function clearPostArm(p: HumanoidPose, x: number, z: number, yaw: number, t: number, k: number, scratch: HumanoidPose): HumanoidPose {
   reaim(p, 1, x, yaw, t, postArmWeight(1, x, z, yaw) * k, scratch);
   reaim(p, -1, x, yaw, t, postArmWeight(-1, x, z, yaw) * k, scratch);
   return p;
}

function reaim(p: HumanoidPose, side: 1 | -1, x: number, yaw: number, t: number, w: number, scratch: HumanoidPose): void {
   if (w <= 0.001) return;
   copyPose(p, scratch);
   aimAwayFromPost(scratch, side, Math.sign(x), yaw, t);
   // only that arm differs from p, so blending both arms moves just that one
   blendPoses(p, scratch, w, p, POSE_MASK.arms);
}
