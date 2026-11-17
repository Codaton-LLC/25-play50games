"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle (swaying to the beat),
// the roll across the stage, jumps, Nami's somersault, the hurt recoil on a shockwave, the cheer, the
// intro's drop, and the card's strike: the hero curls into its ball (the signature roll) and slams into
// the gong. A blob shadow sits under the feet.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_JUMP, type GongRun } from "./rules";
import { V_ROLL } from "./heroes";

export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   winAt: number;
   loseAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hurtAt: -9, winAt: Number.POSITIVE_INFINITY, loseAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export const INTRO_DROP = 12;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9 };
}

/** The animator's motion for this frame (pure; assets.test.ts drives it). A strike is the ball-roll. */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: GongRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const striking = run.simMs < h.strikeUntil;
   if (striking) {
      // rolling into the gong: the ball travels towards the strike
      const dx = h.strikeX - h.x;
      const dz = h.strikeZ - h.z;
      const d = Math.hypot(dx, dz) || 1;
      m.vx = (dx / d) * 6;
      m.vz = (dz / d) * 6;
   } else {
      m.vx = h.vx;
      m.vz = h.vz;
   }
   m.vy = h.grounded ? 0 : h.vAir;
   m.grounded = h.grounded;
   m.power = run.heroId === "riko" && Math.hypot(h.vx, h.vz) > V_ROLL ? "dash" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop || striking;
   if (introDrop) {
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = now - anim.loseAt >= 0;
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
      m.events.landSpeed = 4;
   }
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = h.x;
      m.events.hurtZ = h.z;
   }
}

export function Hero({ run, anim }: { run: GongRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_ROLL + 0.001, jumpSpeed: V_JUMP, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let y = h.air;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      // the strike: the ball lunges a little way into the gong and back
      let x = h.x;
      let z = h.z;
      const left = h.strikeUntil - run.simMs;
      if (left > 0) {
         const k = Math.sin((1 - left / 250) * Math.PI);
         const dx = h.strikeX - h.x;
         const dz = h.strikeZ - h.z;
         const d = Math.hypot(dx, dz) || 1;
         x += (dx / d) * 0.7 * k;
         z += (dz / d) * 0.7 * k;
      }
      g.visible = visible;
      g.position.set(x, y, z);
      const sh = shadow.current;
      if (sh) {
         sh.visible = visible;
         sh.position.set(x, 0.03, z);
         const s = Math.max(0.35, 1 - y / 6);
         sh.scale.setScalar(s);
         (sh.material as MeshBasicMaterial).opacity = 0.34 * s;
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
