"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle, run round the stair,
// takeoff, rise, fall, land, Nami's somersault, Riko's dash, the hurt recoil, the cheer, the intro's
// drop, and the signature ball-roll for every hop from pole to pole. A blob shadow sits on the step under
// the feet. This file turns the run + the Scene's moments (HeroAnim) into the animator's motion.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_JUMP, V_RUN, floorY, type SpinRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hurtAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the first step, curled up. */
export const INTRO_DROP = 14;

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

/** The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: SpinRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = h.grounded ? 0 : h.vy;
   m.grounded = h.grounded && !h.hop.active;
   m.power = ms <= run.dashUntil ? "dash" : ms <= run.shieldUntil ? "shield" : ms <= run.magnetUntil ? "magnet" : ms <= run.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   // the hop across to another pole is the signature ball-roll
   m.rolling = introDrop || h.hop.active;
   if (introDrop) {
      m.vy = -16 * (1 - anim.intro);
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
      m.events.hurtX = -h.vx;
      m.events.hurtZ = -h.vz;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
}

export function Hero({ run, anim }: { run: SpinRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN + 0.001, jumpSpeed: V_JUMP, yaw: Math.PI });

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
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      const sh = shadow.current;
      if (sh) {
         const top = h.hop.active ? h.hop.toY : floorY(run);
         const above = y - top;
         sh.visible = visible && above < 8;
         sh.position.set(h.hop.active ? h.hop.toX : h.x, top + 0.03, h.hop.active ? h.hop.toZ : h.z);
         const k = Math.max(0.3, 1 - above / 7);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.34 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.45, 22]} />
            <meshBasicMaterial color="#05100b" transparent opacity={0.34} depthWrite={false} />
         </mesh>
      </>
   );
}
