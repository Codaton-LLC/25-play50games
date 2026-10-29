"use client";

// The Menu 2 hero in orbit: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: useHeroAnimator + <AnimatedHero>). The hero stands on spheres, so its group is rolled
// round the play plane's z so its "up" is the local up (out of the body it stands on, or the dominant
// body it falls towards), and the animator gets its motion in that local frame: walking round the
// body is running along local x, a jump is local y. Charging a pod curls it into the shell ball in the
// cradle; Riko's burn is the dash streak; the shield / magnet / phase auras; a knock's recoil; Vexa's
// chord sinks her into the crust; the cheer at the dock. The intro drop and a contact shadow stay here.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { NONE, V_JUMP, bodyAt, type PodRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   stumbleAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
   /** the local up the hero is drawn with (rad, eased) */
   up: number;
}

export function createHeroAnim(): HeroAnim {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, stumbleAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN, up: Math.PI / 2 };
}

export const INTRO_DROP = 14;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   stumbleAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, stumbleAt: -9, fallSpeed: 0 };
}

const B = { x: 0, y: 0, vx: 0, vy: 0 };

/** The local up the hero should have now: out of its body, or out of the dominant body in flight. */
export function targetUp(run: PodRun): number {
   const h = run.hero;
   if (h.grounded || h.chordFrom !== NONE) return h.chordFrom !== NONE ? h.chordFrom : h.angle;
   if (h.dom === NONE) return Number.NaN;
   bodyAt(run.course, h.dom, run.simMs, B);
   return Math.atan2(h.y - B.y, h.x - B.x);
}

/**
 * The animator's motion for this frame (pure: no three.js). The velocity relative to the body, in the
 * local frame (x along the surface, y up out of it); the pod's charge and a chord curl it into the ball.
 */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: PodRun, anim: HeroAnim, _now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const ref = h.grounded ? h.body : h.dom;
   if (ref !== NONE) bodyAt(run.course, ref, ms, B);
   else {
      B.vx = 0;
      B.vy = 0;
   }
   let rvx = h.vx - B.vx;
   let rvy = h.vy - B.vy;
   if (h.grounded) {
      // walking: the angular speed the input gives (the rules keep vx/vy at the body's own motion)
      const w = run.held.moveX;
      rvx = Math.sin(h.angle) * w * 4;
      rvy = -Math.cos(h.angle) * w * 4;
   }
   const up = anim.up;
   const lx = Math.sin(up);
   const ly = -Math.cos(up);
   m.vx = Math.max(-14, Math.min(14, rvx * lx + rvy * ly));
   m.vz = 0;
   m.vy = h.grounded ? 0 : rvx * Math.cos(up) + rvy * Math.sin(up);
   m.grounded = h.grounded;
   m.power = ms < h.dashUntil ? "dash" : ms < h.shieldUntil ? "shield" : ms < h.magnetUntil ? "magnet" : ms < h.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop || h.pod !== NONE || h.chordFrom !== NONE;
   if (introDrop) {
      m.vy = -16 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = _now - anim.winAt >= 0;
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
      m.events.landSpeed = Math.min(V_JUMP * 2, memo.fallSpeed);
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

export function Hero({ run, anim, offsetX = 0 }: { run: PodRun; anim: HeroAnim; offsetX?: number }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 9, jumpSpeed: V_JUMP, yaw: Math.PI / 2 });

   useFrame((_s, delta) => {
      // ease the local up (fast on the ground, gentle in flight)
      const want = targetUp(run);
      if (Number.isFinite(want)) {
         let d = (want - anim.up) % (2 * Math.PI);
         if (d > Math.PI) d -= 2 * Math.PI;
         if (d < -Math.PI) d += 2 * Math.PI;
         const k = run.hero.grounded ? 1 : 1 - Math.exp(-6 * Math.min(0.1, delta));
         anim.up += d * k;
      }
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let lift = 0;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         lift = INTRO_DROP * (1 - k) * (1 - k);
      }
      // Vexa in her chord: sunk into the crust (half hidden by the body)
      const sink = h.chordFrom !== NONE ? -0.4 : 0;
      g.visible = visible;
      const ux = Math.cos(anim.up);
      const uy = Math.sin(anim.up);
      g.position.set(h.x + offsetX + ux * (lift + sink), h.y + uy * (lift + sink), 0);
      g.rotation.set(0, 0, anim.up - Math.PI / 2);
      const sh = shadow.current;
      if (sh) {
         sh.visible = visible && h.grounded && h.chordFrom === NONE;
         sh.position.set(h.x + offsetX + ux * 0.03, h.y + uy * 0.03, 0);
         sh.rotation.set(0, 0, anim.up - Math.PI / 2);
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <group ref={shadow}>
            <mesh rotation-x={-Math.PI / 2} renderOrder={1}>
               <circleGeometry args={[0.45, 20]} />
               <meshBasicMaterial color="#120a24" transparent opacity={0.35} depthWrite={false} />
            </mesh>
         </group>
      </>
   );
}
