"use client";

// The Menu 2 hero in free-fall: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim). Every frame the run (rules.ts) becomes the animator's HeroMotion: standing on the
// column, the leap (a jump), the spread fall (the fall pose, the body tipped belly-down into the
// skydive), the Dive (the armoured ball, spinning), Nami's air-brake flip (the somersault), the
// powers' auras, a knock or a splash (hurt), the landing and the cheer. The body tip, the splash
// sink and the respawn pop stay here.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_SPREAD, STEER_SPREAD, type RingRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   leapAt: number;
   flipAt: number;
   landAt: number;
   hurtAt: number;
   splashAt: number;
   spawnAt: number;
   winAt: number;
   hurtX: number;
   hurtZ: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { leapAt: -9, flipAt: -9, landAt: -9, hurtAt: -9, splashAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, hurtX: 0, hurtZ: 1, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start column, curled up. */
export const INTRO_DROP = 22;
/** The skydive tip (rad): the body leans belly-down this far in a spread fall. */
export const SKYDIVE_TIP = 1.15;

export interface MotionMemo {
   leapAt: number;
   flipAt: number;
   landAt: number;
   hurtAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { leapAt: -9, flipAt: -9, landAt: -9, hurtAt: -9, fallSpeed: 0 };
}

/** The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: RingRun, anim: HeroAnim, now: number, ms: number): void {
   const h = run.hero;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = h.vy;
   const standing = h.mode === "perch" || h.mode === "landed";
   m.grounded = standing;
   m.power = ms < h.dashUntil ? "dash" : ms < h.shieldUntil ? "shield" : ms < h.magnetUntil ? "magnet" : ms < h.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = (h.mode === "fall" && h.diving && ms >= h.flipUntil) || introDrop;
   if (introDrop) {
      m.vy = -18 * (1 - anim.intro);
      m.grounded = false;
   }
   if (h.mode === "splash") {
      m.vx = m.vz = 0;
      m.vy = 0;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
   if (anim.flipAt !== memo.flipAt) {
      memo.flipAt = anim.flipAt;
      m.events.airJumped = true;
   }
   if (anim.leapAt !== memo.leapAt) {
      memo.leapAt = anim.leapAt;
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
      m.events.hurtX = anim.hurtX;
      m.events.hurtZ = anim.hurtZ;
   }
   if (!standing) memo.fallSpeed = Math.max(0, -m.vy);
}

/** How far the body tips belly-down: a spread fall tips fully, the ball, the flip and standing do not. */
export function skydiveTip(run: RingRun, ms: number): number {
   const h = run.hero;
   if (h.mode !== "fall" || h.diving || ms < h.flipUntil) return 0;
   const fall = Math.max(0, -h.vy);
   return SKYDIVE_TIP * Math.min(1, fall / V_SPREAD);
}

export function Hero({ run, anim, clock }: { run: RingRun; anim: HeroAnim; clock: { ms: number } }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const tip = useRef<Group>(null);
   const unturn = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: STEER_SPREAD, jumpSpeed: 6, yaw: Math.PI });
   const lean = useRef(0);
   const lift = useRef(0);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now, clock.ms < 0 ? 0 : clock.ms);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, delta) => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      let y = h.y;
      let visible = true;
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      if (h.mode === "splash") {
         // under the water, then gone until the respawn
         const t = now - anim.splashAt;
         y -= Math.min(2.5, t * 4);
         s = Math.max(0, 1 - t * 1.4);
      }
      const ts = now - anim.spawnAt;
      if (ts >= 0 && ts < 0.45) s = Math.sin((ts / 0.45) * Math.PI * 0.5) * (1 + 0.25 * Math.sin((ts / 0.45) * Math.PI));
      // the body's middle sits on the rules' point while falling (the feet while standing)
      const want = h.mode === "fall" ? 1 : 0;
      lift.current += (want - lift.current) * (1 - Math.exp(-10 * dt));
      g.visible = visible && s > 0.001;
      g.position.set(h.x, y - 0.7 * lift.current, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      const wantTip = skydiveTip(run, clock.ms < 0 ? 0 : clock.ms);
      lean.current += (wantTip - lean.current) * (1 - Math.exp(-7 * dt));
      // tip forward along the facing (the animator turns the body inside: undo its yaw round the tip)
      const yaw = animator.body.yaw;
      if (tip.current) tip.current.rotation.set(lean.current, yaw, 0, "YXZ");
      if (unturn.current) unturn.current.rotation.y = -yaw;
   });

   return (
      <group ref={root}>
         <group position={[0, 0.7, 0]}>
            <group ref={tip}>
               <group ref={unturn}>
                  <group position={[0, -0.7, 0]}>
                     <AnimatedHero animator={animator} />
                  </group>
               </group>
            </group>
         </group>
      </group>
   );
}
