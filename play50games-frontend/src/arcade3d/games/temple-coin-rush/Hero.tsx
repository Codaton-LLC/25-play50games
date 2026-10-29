"use client";

// The Menu 2 hero in the temple: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: useHeroAnimator + <AnimatedHero>). Every frame the run (rules.ts) and the Scene's
// moments (HeroAnim) become the animator's HeroMotion: the run (feet planted), the lane changes, jumps,
// Nami's somersault, the roll under the low beams (the shell ball), Riko's dash streak, the shield /
// magnet / phase auras, a stumble's recoil, a fall into a pit (a drop and a climb out), the cheer at
// the finish. The intro drop and a blob shadow stay here.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_JUMP, type TempleRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   stumbleAt: number;
   /** a fall into a broken tile's pit */
   fallAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, stumbleAt: -9, fallAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start, curled up. */
export const INTRO_DROP = 18;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   stumbleAt: number;
   fallSpeed: number;
   lastX: number;
   lastZ: number;
   lastT: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, stumbleAt: -9, fallSpeed: 0, lastX: Number.NaN, lastZ: Number.NaN, lastT: 0 };
}

/**
 * The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). The velocity is
 * the rules' run speed and the sideways lane change; the roll curls the hero into the shell ball;
 * Riko's dash is the "dash" power.
 */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: TempleRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const dt = now - memo.lastT;
   const vx = Number.isNaN(memo.lastX) || dt <= 0 || dt > 0.2 ? 0 : (h.x - memo.lastX) / dt;
   memo.lastX = h.x;
   memo.lastZ = h.z;
   memo.lastT = now;
   m.vx = Math.max(-14, Math.min(14, vx));
   m.vz = run.ended === "lose" ? 0 : -h.v;
   m.vy = h.grounded ? 0 : h.vy;
   m.grounded = h.grounded;
   m.power = ms < h.dashUntil ? "dash" : ms < h.shieldUntil ? "shield" : ms < h.magnetUntil ? "magnet" : ms < h.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop || ms < h.rollUntil;
   if (introDrop) {
      m.vy = -16 * (1 - anim.intro);
      m.vz = 0;
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = run.ended === "lose";
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
   if (anim.hurtAt !== memo.hurtAt || anim.stumbleAt !== memo.stumbleAt) {
      memo.hurtAt = anim.hurtAt;
      memo.stumbleAt = anim.stumbleAt;
      m.events.hurt = true;
      m.events.hurtX = 0;
      m.events.hurtZ = 1;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
}

export function Hero({ run, anim, offsetX = 0 }: { run: TempleRun; anim: HeroAnim; offsetX?: number }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: run.course.vMax, jumpSpeed: V_JUMP, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let y = h.y;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      // a fall into a pit: down into it, then a scramble out
      const tf = now - anim.fallAt;
      if (tf >= 0 && tf < 0.9) y -= tf < 0.3 ? (tf / 0.3) * 1.2 : 1.2 * (1 - (tf - 0.3) / 0.6);
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible;
      g.position.set(h.x + offsetX, y, h.z);
      const sh = shadow.current;
      if (sh) {
         sh.visible = visible && y < 12;
         sh.position.set(h.x + offsetX, 0.03, h.z);
         const k = Math.max(0.35, 1 - y / 6);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.42 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#1a0d0a" transparent opacity={0.4} depthWrite={false} />
         </mesh>
      </>
   );
}
