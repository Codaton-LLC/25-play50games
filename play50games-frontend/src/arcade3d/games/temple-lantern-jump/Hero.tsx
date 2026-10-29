"use client";

// The picked hero, animated by the shared Menu 2 animator (menu2/heroAnim): idle, run, takeoff, rise, fall,
// land, Nami's somersault, Riko's dash, the hurt recoil, the cheer and the intro's drop. The ember is the
// hero's own light: a warm glow ball at the chest that dims and shrinks as the meter burns down and
// gutters out at 0, so the player reads the meter on the hero itself. A blob shadow follows the ledge
// under the feet. This file turns the run + the Scene's moments (HeroAnim) into the animator's motion.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { padX, padZ } from "./course";
import { LEVELS } from "./levels";
import { V_JUMP, V_WALK, padSolid, type TempleRun } from "./rules";
import { COLORS } from "./look";
import { V_DASH } from "./heroes";

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

/** The intro's drop: the hero falls this far onto the start deck, curled up. */
export const INTRO_DROP = 18;

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
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: TempleRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const dashing = ms <= run.dashUntil;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = h.grounded ? 0 : h.vy;
   m.grounded = h.grounded;
   m.power = dashing ? "dash" : ms <= run.shieldUntil ? "shield" : ms <= run.magnetUntil ? "magnet" : ms <= run.phaseUntil ? "phase" : null;
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
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
}

/** The top of the highest solid pad under (x, z) at or below the feet (the shadow's floor), -Infinity if none. */
export function groundUnder(run: TempleRun, x: number, z: number, feet: number): number {
   let best = -Infinity;
   for (const p of run.course.pads) {
      if (p.y > feet + 0.05 || p.y <= best || !padSolid(run, p)) continue;
      if (Math.hypot(x - padX(p, run.simMs), z - padZ(p, run.simMs)) <= p.r + 0.1) best = p.y;
   }
   return best;
}

export function Hero({ run, anim }: { run: TempleRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const glow = useRef<Mesh>(null);
   const mark = useRef<Mesh>(null);
   const camera = useThree((st) => st.camera);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK + 0.001, jumpSpeed: V_JUMP, yaw: Math.PI });
   void V_DASH;

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
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      // the ember on the hero: warm, flickering, as big as the meter says
      const gl = glow.current;
      if (gl) {
         const frac = Math.max(0, run.ember / LEVELS[run.level].emberMs);
         const flicker = 1 + 0.12 * Math.sin(now * 13) + 0.06 * Math.sin(now * 31);
         const r = run.ember > 0 ? (0.28 + 0.4 * frac) * flicker : 0.12;
         gl.visible = g.visible;
         gl.position.set(h.x, y + 1.15, h.z);
         gl.scale.setScalar(r);
         (gl.material as MeshBasicMaterial).opacity = run.ember > 0 ? 0.55 : 0.2;
      }
      // a small ring over the head that shows through the ledges: the spiral stacks slabs in front of the hero
      const mk = mark.current;
      if (mk) {
         mk.visible = g.visible;
         mk.position.set(h.x, y + 2.35, h.z);
         mk.quaternion.copy(camera.quaternion);
         mk.scale.setScalar(1 + 0.08 * Math.sin(now * 5));
      }
      const sh = shadow.current;
      if (sh) {
         const top = groundUnder(run, h.x, h.z, h.y);
         const above = y - top;
         sh.visible = visible && Number.isFinite(top) && above < 10;
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.3, 1 - above / 9);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.36 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={glow}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshBasicMaterial color={COLORS.emberHot} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={mark} renderOrder={6}>
            <ringGeometry args={[0.13, 0.2, 20]} />
            <meshBasicMaterial color={COLORS.emberHot} transparent opacity={0.8} depthTest={false} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#020604" transparent opacity={0.36} depthWrite={false} />
         </mesh>
      </>
   );
}
