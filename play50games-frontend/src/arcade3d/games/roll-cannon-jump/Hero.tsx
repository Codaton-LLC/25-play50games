"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim). In a cannon the hero is
// curled into its armoured ball in the bore (only the shell's top shows, it shivers with the power
// ring); a shot flies the ball (the signature roll), spinning with the travel; on a platform it walks
// and hops; a fall shrinks it into the net, a respawn pops it back into the barrel; the finish
// ring is a cheer. A blob shadow follows it onto whatever is under it.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { HERO_R, V_PJUMP, V_WALK, onPlatform, type CannonRun } from "./rules";
import { V_DASH } from "./heroes";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   firedAt: number;
   /** the intro's landing timeline 0..1 (1 = in the cannon), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, firedAt: -9, intro: Number.NaN };
}

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9, fallSpeed: 0 };
}

/** The animator's motion for this frame (pure: hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CannonRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const dashing = h.dashUntil >= ms;
   m.vx = h.vx + (dashing ? h.dashX * V_DASH : 0);
   m.vy = h.mode === "fly" ? h.vy : 0;
   m.vz = h.vz + (dashing ? h.dashZ * V_DASH : 0);
   m.grounded = h.mode === "walk";
   m.power = dashing ? "dash" : ms <= h.shieldUntil ? "shield" : ms <= h.magnetUntil ? "magnet" : ms <= h.phaseUntil ? "phase" : null;
   // the signature roll: curled in every cannon, on every shot, every bounce and every fall
   m.rolling = h.mode === "aim" || h.mode === "catch" || h.mode === "fly" || h.mode === "lost" || (!Number.isNaN(anim.intro) && anim.intro < 0.98);
   if (h.mode === "aim" || h.mode === "catch") {
      m.vx = m.vy = m.vz = 0;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
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
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      if (h.lostWhy !== "net") {
         m.events.hurt = true;
         m.events.hurtX = -h.vx;
         m.events.hurtZ = -h.vz;
      }
   }
   if (h.mode === "fly") memo.fallSpeed = Math.max(0, -h.vy);
}

/** The top under (x, z) at or below y (the shadow's floor): platforms, trampolines, the net. */
export function groundUnder(run: CannonRun, x: number, z: number, y: number): number {
   let best = run.course.killY - 0.5;
   for (const p of run.course.platforms) if (p.y <= y && p.y > best && onPlatform(p, x, z)) best = p.y;
   for (const t of run.course.tramps) if (t.y <= y && t.y > best && Math.hypot(x - t.x, z - t.z) <= t.r) best = t.y + 0.3;
   return best;
}

export function Hero({ run, anim }: { run: CannonRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK, jumpSpeed: V_PJUMP, ballRadius: HERO_R, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let s = 1;
      let visible = true;
      // the feet point: the ball's middle less its radius
      let y = h.y - HERO_R;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 22 * (1 - k) * (1 - k);
      }
      if (h.mode === "aim" || h.mode === "catch") {
         // curled in the bore: sunk a little, a shiver with the ring
         y -= 0.3;
         s = 0.82 + 0.03 * Math.sin(now * 30);
      } else if (h.mode === "lost") s = Math.max(0, 1 - (now - anim.lostAt) / 0.7);
      const tp = now - anim.spawnAt;
      if (tp >= 0 && tp < 0.4) s *= Math.sin((tp / 0.4) * Math.PI * 0.5) * (1 + 0.2 * Math.sin((tp / 0.4) * Math.PI));
      const tw = now - anim.winAt;
      if (tw >= 0) y += Math.abs(Math.sin(tw * 5)) * 0.25;
      if (h.mode === "aim" || h.mode === "catch") animator.body.yaw = Math.PI + h.facing;
      g.visible = visible && s > 0.001;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      const sh = shadow.current;
      if (sh) {
         const top = groundUnder(run, h.x, h.z, h.y - HERO_R + 0.05);
         const above = h.y - HERO_R - top;
         sh.visible = g.visible && h.mode !== "lost" && h.mode !== "aim" && h.mode !== "catch" && above < 16;
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.3, 1 - above / 12);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.35 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#1a1310" transparent opacity={0.35} depthWrite={false} />
         </mesh>
      </>
   );
}

export type HeroAnimRef = MutableRefObject<HeroAnim>;
