"use client";

// The picked hero, animated by menu2/heroAnim. The fallback is a small capsule until the GLB
// loads. The body faces the hero's travel (faceX, faceZ). A swing leans them along the rope.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { BONE, POSE_MASK, aimArm, blendPoses, createPose, restPose, turnBone, type HumanoidPose } from "@/arcade3d/core/rig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { V_JUMP, V_RUN, anchorPoint, type SwingRun } from "./rules";

/** The hands over the feet with the arms up on the rope (m, as drawn): the rope starts here. */
export const HAND_HEIGHT = 1.42;

/** The swing pose: both hands up on the rope, legs trailing the swing (`lean` -1..1), a tuck when reeled short. Pure. */
export function swingPose(lean: number, tuck: number, out: HumanoidPose): HumanoidPose {
   restPose(out);
   out.ground = 0;
   out.lift = 0;
   aimArm(out, 1, 0.16, 1, 0.04, -0.1, 1, 0.02);
   aimArm(out, -1, 0.16, 1, 0.04, -0.1, 1, 0.02);
   const k = Math.max(0, Math.min(1, tuck));
   for (const side of [1, -1]) {
      const thigh = side > 0 ? BONE.upperLegL : BONE.upperLegR;
      const shin = side > 0 ? BONE.lowerLegL : BONE.lowerLegR;
      const trail = lean * 0.45 + (side > 0 ? 0.08 : -0.08) * lean;
      turnBone(out, thigh, -(0.12 + trail + k * 1.1), 0, side * (0.06 + k * 0.1));
      turnBone(out, shin, 0.25 + k * 1.4 + Math.max(0, lean) * 0.4, 0, 0);
   }
   turnBone(out, BONE.spine, k * 0.25 - lean * 0.1, 0, 0);
   turnBone(out, BONE.head, -0.18, 0, 0);
   return out;
}

const UP = new Vector3(0, 1, 0);
const ROPE = new Vector3();
const TILT = new Quaternion();
const NO_TILT = new Quaternion();
const TIP = { x: 0, y: 0, z: 0 };

export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

interface Memo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
}

export function createMotionMemo(): Memo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9 };
}

/** The animator's motion for this frame. Pure aside from the motion object it fills. */
export function writeHeroMotion(m: HeroMotion, memo: Memo, run: SwingRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vy = h.vy;
   m.vz = h.vz;
   m.grounded = h.grounded && h.mode === "ground";
   const dashing = h.dashUntil >= ms;
   m.power = dashing ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   m.rolling = h.mode === "lost" || (!Number.isNaN(anim.intro) && anim.intro < 0.97);
   m.celebrating = now - anim.winAt >= 0 && now - anim.winAt < 2.4;
   m.defeated = h.mode === "lost";
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      m.events.airJumped = true;
   }
   if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = 6;
   }
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      m.events.hurt = true;
      m.events.hurtX = -h.faceX;
      m.events.hurtZ = -h.faceZ;
   }
}

export function Hero({ run, anim, accent, hand }: { run: SwingRun; anim: HeroAnim; accent?: string; hand?: { x: number; y: number; z: number } }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const tilt = useRef<Group>(null);
   const hanging = useMemo(createPose, []);
   const sw = useMemo(() => ({ hang: 0, lean: 0, yaw: 0 }), []);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI / 2 });
   const color = accent ?? heroById(run.heroId).color;
   const fallback = useMemo(() => (
      <mesh position={[0, 0.75, 0]} castShadow>
         <capsuleGeometry args={[0.28, 0.7, 6, 10]} />
         <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
   ), [color]);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      const h = run.hero;
      if (h.mode === "swing") {
         // on the rope the body faces along the swing (the hands stay on the rope)
         const sp = Math.hypot(h.vx, h.vz);
         if (sp > 1.2) sw.yaw = Math.atan2(h.vx, h.vz);
         animator.body.yaw = sw.yaw;
         motion.vx = motion.vz = motion.vy = 0;
         motion.grounded = false;
      } else {
         sw.yaw = Math.atan2(h.faceX, h.faceZ);
         animator.body.yaw = sw.yaw;
      }
   }, FRAME_PRIORITY.camera + 0.1);

   // the swing: the hang blended over the animator's pose, the body tilted along the rope
   useFrame(() => {
      const h = run.hero;
      const dt = Math.min(0.05, time.delta);
      const swinging = h.mode === "swing";
      sw.hang += ((swinging ? 1 : 0) - sw.hang) * Math.min(1, dt * (swinging ? 16 : 7));
      const t = tilt.current;
      if (swinging) {
         anchorPoint(run, h.anchor, run.simMs, TIP);
         ROPE.set(TIP.x - h.x, TIP.y - h.y, TIP.z - h.z).normalize();
         TILT.setFromUnitVectors(UP, ROPE);
         // the legs trail the swing: lean by the swing's speed along the facing
         const along = h.vx * Math.sin(sw.yaw) + h.vz * Math.cos(sw.yaw);
         sw.lean += (Math.max(-1, Math.min(1, -along / 14)) - sw.lean) * Math.min(1, dt * 6);
         if (hand) {
            hand.x = h.x + ROPE.x * HAND_HEIGHT;
            hand.y = h.y + ROPE.y * HAND_HEIGHT;
            hand.z = h.z + ROPE.z * HAND_HEIGHT;
         }
      } else if (hand) {
         hand.x = h.x;
         hand.y = h.y + HAND_HEIGHT;
         hand.z = h.z;
      }
      if (t) t.quaternion.copy(NO_TILT).slerp(TILT, sw.hang);
      if (sw.hang > 0.01) {
         swingPose(sw.lean, Math.max(0, (6 - h.L) / 3), hanging);
         blendPoses(animator.pose, hanging, sw.hang * 0.97, animator.pose, POSE_MASK.all);
         animator.body.ball = 0;
         animator.body.shell = 0;
         animator.body.tiltX = 0;
         animator.body.tiltZ = 0;
         animator.body.hop = 0;
      }
   }, FRAME_PRIORITY.pose + 0.005);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let y = h.y;
      let visible = h.mode !== "lost";
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 18 * (1 - k) * (1 - k);
      }
      if (h.mode === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.4);
         s = Math.sin(t * Math.PI * 0.5);
      }
      g.visible = visible && s > 0.02;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.02, s));
      const sh = shadow.current;
      if (sh) {
         const deck = run.course.islands[h.support];
         const top = deck ? deck.y : h.y;
         const above = y - top;
         sh.visible = visible && above < 16 && above > -0.2;
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.35, 1 - above / 12);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.28 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <group ref={tilt}>
               <AnimatedHero animator={animator} fallback={fallback} />
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.55, 16]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.28} depthWrite={false} />
         </mesh>
      </>
   );
}
