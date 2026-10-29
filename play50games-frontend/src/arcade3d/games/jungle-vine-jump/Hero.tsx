"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle, run, takeoff, rise,
// fall, land, Nami's somersault, the hurt recoil, the cheer and the intro's drop. On a vine the hero
// hangs from the hands (a hang pose blended over the animator: arms up on the rope, legs swinging with
// the arc) and the whole body turns about the grip with the swing angle, facing along the swing plane.
// A blob shadow follows the platform under the feet. This file turns the run + the Scene's moments
// (HeroAnim) into the animator's motion.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { BONE, aimArm, blendPoses, createPose, restPose, turnBone, POSE_MASK, type HumanoidPose } from "@/arcade3d/core/rig";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { padY } from "./course";
import { HANG, V_JUMP, V_WALK, MAX_AMP, type VineRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hurtAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start branch, curled up. */
export const INTRO_DROP = 18;

/** The hands over the feet with the arms up (as drawn): the rules' HANG. */
export const HAND_HEIGHT = HANG;

/** The hang pose: arms up to the rope, legs dangling and swinging with the arc (`swing` -1..1). Pure. */
export function hangPose(swing: number, tuck: number, out: HumanoidPose): HumanoidPose {
   restPose(out);
   out.ground = 0;
   out.lift = 0;
   // both hands up on the rope, close together over the head
   aimArm(out, 1, 0.28, 1, 0.08, -0.06, 1, 0.03);
   aimArm(out, -1, 0.28, 1, 0.08, -0.06, 1, 0.03);
   const k = Math.max(0, Math.min(1, tuck));
   for (const side of [1, -1]) {
      const thigh = side > 0 ? BONE.upperLegL : BONE.upperLegR;
      const shin = side > 0 ? BONE.lowerLegL : BONE.lowerLegR;
      // the legs trail the swing a little and kick forward at the top
      const sway = swing * 0.45 + (side > 0 ? 0.05 : -0.05);
      turnBone(out, thigh, -(0.15 + sway + k * 0.9), 0, side * 0.06);
      turnBone(out, shin, 0.25 + k * 1.2, 0, 0);
   }
   turnBone(out, BONE.spine, -swing * 0.12 + k * 0.2, 0, 0);
   turnBone(out, BONE.head, -0.1, 0, 0);
   return out;
}

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, fallSpeed: 0 };
}

/** The animator's motion for this frame (pure: no three.js; assets.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: VineRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const hanging = h.vine >= 0;
   // on a vine the animator sees no travel (the hang pose and the swing turn the body instead)
   m.vx = hanging ? 0 : h.vx;
   m.vz = hanging ? 0 : h.vz;
   m.vy = h.grounded || hanging ? 0 : h.vy;
   m.grounded = h.grounded || hanging;
   m.power = ms <= run.dashUntil ? "dash" : ms <= run.shieldUntil ? "shield" : ms <= run.magnetUntil ? "magnet" : ms <= run.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop;
   if (introDrop) {
      m.vy = -18 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      memo.jumpAt = anim.jumpAt;
      m.events.airJumped = true;
   } else if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = -Math.sin(h.facing);
      m.events.hurtZ = -Math.cos(h.facing);
   }
   if (!h.grounded && !hanging) memo.fallSpeed = Math.max(0, -m.vy);
}

/** The top of the highest pad under (x, z) at or below the feet (the shadow's floor), -Infinity if none. */
export function groundUnder(run: VineRun, x: number, z: number, feet: number): number {
   let best = -Infinity;
   for (const p of run.course.pads) {
      const top = padY(p, run.simMs);
      if (top > feet + 0.05 || top <= best) continue;
      if (Math.hypot(x - p.x, z - p.z) <= p.r + 0.1) best = top;
   }
   return best;
}

export function Hero({ run, anim }: { run: VineRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const swingG = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK + 0.001, jumpSpeed: V_JUMP, yaw: Math.PI });
   const hanging = useMemo(createPose, []);
   const v = useMemo(() => ({ hang: 0, yaw: 0, tuck: 0 }), []);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   // the drawn place, the hang blend and the swing (after the animator's pose)
   useFrame(() => {
      const g = root.current;
      const sw = swingG.current;
      if (!g || !sw) return;
      const h = run.hero;
      const now = time.now;
      const dt = Math.min(0.05, time.delta);
      const onVine = h.vine >= 0;
      v.hang += ((onVine ? 1 : 0) - v.hang) * Math.min(1, dt * (onVine ? 16 : 9));
      let y = h.y;
      let visible = true;
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      const tp = now - anim.spawnAt;
      if (tp >= 0 && tp < 0.4) s *= Math.sin((tp / 0.4) * Math.PI * 0.5) * (1 + 0.2 * Math.sin((tp / 0.4) * Math.PI));
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible && s > 0.001;
      // the group sits at the hands; the body hangs from them, turned about the grip by the swing angle
      g.position.set(h.x, y + HAND_HEIGHT * v.hang, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      sw.position.y = -HAND_HEIGHT * v.hang;
      if (onVine) {
         const vine = run.course.vines[h.vine];
         v.yaw = Math.atan2(vine.dx, vine.dz);
         // the legs tuck in as the grip is pulled short
         v.tuck += (Math.max(0, (3 - h.grip) / 1.5) - v.tuck) * Math.min(1, dt * 6);
      }
      g.rotation.set(0, v.yaw * v.hang, 0);
      sw.rotation.set(onVine ? -h.theta : 0, 0, 0);
      if (v.hang > 0.01) {
         const swing = onVine ? Math.max(-1, Math.min(1, -h.omega * 0.35)) : 0;
         hangPose(swing * Math.min(1, Math.abs(h.theta) / MAX_AMP + 0.3), v.tuck, hanging);
         blendPoses(animator.pose, hanging, v.hang * 0.97, animator.pose, POSE_MASK.all);
         animator.body.ball = 0;
         animator.body.shell = 0;
         animator.body.tiltX = 0;
         animator.body.hop = 0;
         animator.body.yaw = animator.body.yaw * (1 - v.hang);
      }
      const sh = shadow.current;
      if (sh) {
         const top = groundUnder(run, h.x, h.z, h.y);
         const above = y - top;
         sh.visible = visible && Number.isFinite(top) && above < 12;
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.3, 1 - above / 10);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.34 * k;
      }
   }, FRAME_PRIORITY.pose + 0.005);

   return (
      <>
         <group ref={root}>
            <group ref={swingG}>
               <AnimatedHero animator={animator} />
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#14240f" transparent opacity={0.34} depthWrite={false} />
         </mesh>
      </>
   );
}
