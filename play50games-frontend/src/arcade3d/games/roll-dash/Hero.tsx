"use client";

// The active hero, animated by the shared Menu 2 animator (menu2/heroAnim): the signature ball-roll down
// the street (Roll Dash is a ball-roll runner), uncurling for a jump, Nyla's somersault, Riko's dash,
// the hurt recoil, the cheer, the intro's drop. A tag swaps the drawn hero at once (all five GLBs are
// loaded with the level; only the active one is drawn): `HeroSwap` re-keys the animator on the new id.
// A blob shadow sits on the street under the feet.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_JUMP, speedOf, type DashRun } from "./rules";
import type { HeroId } from "./heroes";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   winAt: number;
   loseAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
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
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, fallSpeed: 0 };
}

/** The animator's motion for this frame (pure: no three.js; assets.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: DashRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const v = run.ended === null ? speedOf(run) : 0;
   m.vx = 0;
   m.vz = -v;
   m.vy = h.grounded ? 0 : h.vy;
   m.grounded = h.grounded;
   m.power = ms <= run.dashUntil ? "dash" : ms <= run.shieldUntil ? "shield" : ms <= run.magnetUntil ? "magnet" : ms <= run.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   // the ball-roll on the street; a jump uncurls
   m.rolling = introDrop || (h.grounded && run.ended === null);
   if (introDrop) {
      m.vy = -16 * (1 - anim.intro);
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
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.hurtAt !== memo.hurtAt) {
      memo.hurtAt = anim.hurtAt;
      m.events.hurt = true;
      m.events.hurtX = 0;
      m.events.hurtZ = 1;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
}

function HeroBody({ run, anim, heroId }: { run: DashRun; anim: HeroAnim; heroId: HeroId }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(heroId, motion, { topSpeed: run.course.cfg.speed + 0.001, jumpSpeed: V_JUMP, yaw: Math.PI });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let y = h.y;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      const tw = time.now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible;
      g.position.set(h.x, y, -h.d);
   });

   return (
      <group ref={root}>
         <AnimatedHero animator={animator} />
      </group>
   );
}

/** The active hero (re-keyed on every tag) and its blob shadow. */
export function Hero({ run, anim }: { run: DashRun; anim: HeroAnim }) {
   const [active, setActive] = useState<HeroId>(run.active);
   const shadow = useRef<Mesh>(null);
   useFrame(() => {
      if (run.active !== active) setActive(run.active);
      const sh = shadow.current;
      if (!sh) return;
      const h = run.hero;
      sh.position.set(h.x, 0.03, -h.d);
      const k = Math.max(0.3, 1 - h.y / 4);
      sh.scale.setScalar(k);
      (sh.material as MeshBasicMaterial).opacity = 0.36 * k;
   });
   return (
      <>
         <HeroBody key={active} run={run} anim={anim} heroId={active} />
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.45, 22]} />
            <meshBasicMaterial color="#0b0f17" transparent opacity={0.36} depthWrite={false} />
         </mesh>
      </>
   );
}
