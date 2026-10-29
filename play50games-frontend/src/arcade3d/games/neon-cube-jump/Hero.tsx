"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle, run, the jump and
// Nami's second jump, Riko's dash, the hurt recoil (a stomp), the fall into the void, the cheer and the
// intro's drop. A shield bubble, Vexa's phase glow and a blob shadow on the cube below ride along.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_RUN, cubePos, type NeonRun } from "./rules";

export interface HeroAnim {
   winAt: number;
   hurtAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { winAt: Number.POSITIVE_INFINITY, hurtAt: -9, intro: Number.NaN };
}

export const INTRO_DROP = 12;

export interface MotionMemo {
   hurtAt: number;
}

/** The animator's motion for this frame (pure: no three.js). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: NeonRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = h.vy;
   m.grounded = h.ground >= 0;
   m.power = ms <= h.dashUntil ? "dash" : ms <= h.shieldUntil ? "shield" : ms <= h.magnetUntil ? "magnet" : ms <= h.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop;
   if (introDrop) {
      m.vy = -12 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = h.deadMs >= 0;
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = -Math.sin(h.facing);
      m.events.hurtZ = -Math.cos(h.facing);
   }
}

const CP = { x: 0, z: 0 };

export function Hero({ run, anim }: { run: NeonRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const bubble = useRef<Mesh>(null);
   const phase = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo<MotionMemo>(() => ({ hurtAt: -9 }), []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN + 0.001, jumpSpeed: 11, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      const h = run.hero;
      if (Math.hypot(h.vx, h.vz) < 0.5) animator.body.yaw = turnTowards(animator.body.yaw, h.facing, 0.2);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let y = h.y;
      let visible = h.deadMs < 0 || h.deadMs < 500;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      const ms = run.simMs;
      const b = bubble.current;
      if (b) {
         b.visible = ms <= h.shieldUntil && visible;
         b.position.set(h.x, y + 0.85, h.z);
         b.scale.setScalar(1.05 + 0.04 * Math.sin(time.now * 8));
      }
      const p = phase.current;
      if (p) {
         p.visible = ms <= h.phaseUntil && visible;
         p.position.set(h.x, y + 0.85, h.z);
         p.scale.setScalar(0.95 + 0.08 * Math.sin(time.now * 20));
      }
      // the shadow on the highest cube top under him
      const sh = shadow.current;
      if (sh) {
         let top = -Infinity;
         for (const c of run.course.cubes) {
            if (c.top > h.y + 0.05) continue;
            cubePos(run, c, CP);
            if (Math.abs(h.x - CP.x) > 1 || Math.abs(h.z - CP.z) > 1) continue;
            if (c.top > top) top = c.top;
         }
         sh.visible = visible && Number.isFinite(top);
         if (Number.isFinite(top)) {
            sh.position.set(h.x, top + 0.03, h.z);
            sh.scale.setScalar(Math.max(0.4, 1 - (h.y - top) * 0.12));
         }
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
         <mesh ref={phase} visible={false}>
            <sphereGeometry args={[0.95, 20, 14]} />
            <meshBasicMaterial color="#c4b5fd" transparent opacity={0.3} depthWrite={false} toneMapped={false} wireframe />
         </mesh>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.45, 24]} />
            <meshBasicMaterial color="#05020f" transparent opacity={0.45} depthWrite={false} />
         </mesh>
      </>
   );
}
