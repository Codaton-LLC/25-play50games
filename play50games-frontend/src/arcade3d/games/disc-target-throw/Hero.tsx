"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle, run, Riko's dash,
// the hurt recoil (a thorn burst, a volley), the cheer and the intro's drop. Standing still he turns
// to his aim (the camera's view while Throw is held, else the way he last threw), and a throw gives him
// a short lean-in. A shield bubble, the magnet's ring and a blob shadow ride along.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_WALK, type DiscRun } from "./rules";
import type { AimView } from "./Disc";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   throwAt: number;
   hurtAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { throwAt: -9, hurtAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export const INTRO_DROP = 14;

export interface MotionMemo {
   hurtAt: number;
}

export function createMotionMemo(): MotionMemo {
   return { hurtAt: -9 };
}

/** The animator's motion for this frame (pure: no three.js; assets.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: DiscRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = 0;
   m.grounded = true;
   m.power = ms <= h.dashUntil ? "dash" : ms <= h.shieldUntil ? "shield" : ms <= h.magnetUntil ? "magnet" : h.phaseArmed ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop;
   if (introDrop) {
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = -Math.sin(h.facing);
      m.events.hurtZ = -Math.cos(h.facing);
   }
}

export function Hero({ run, anim, aim }: { run: DiscRun; anim: HeroAnim; aim: AimView }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const bubble = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK + 0.001, jumpSpeed: 8, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      // standing: face the aim (or the last throw)
      const h = run.hero;
      if (Math.hypot(h.vx, h.vz) < 0.5) {
         const want = aim.active ? aim.heading : h.facing;
         animator.body.yaw = turnTowards(animator.body.yaw, want, 0.25);
      }
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let y = 0;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      // the throw: a quick lean into the release
      const t = now - anim.throwAt;
      g.rotation.x = t >= 0 && t < 0.3 ? Math.sin((t / 0.3) * Math.PI) * 0.22 : aim.active ? -0.08 : 0;
      g.rotation.y = 0;
      const b = bubble.current;
      if (b) {
         const on = run.simMs <= h.shieldUntil;
         b.visible = on && visible;
         b.position.set(h.x, 0.9, h.z);
         b.scale.setScalar(1.15 + 0.04 * Math.sin(now * 8));
      }
      const sh = shadow.current;
      if (sh) {
         sh.visible = visible;
         sh.position.set(h.x, 0.03, h.z);
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={bubble} visible={false}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#1a140a" transparent opacity={0.32} depthWrite={false} />
         </mesh>
      </>
   );
}
