"use client";

// The picked hero, its own GLB animated by the shared Menu 2 animator (menu2/heroAnim). At red-lane
// speed (the rail, a dash) it curls into the armoured ball and rolls, and keeps rolling while it
// coasts; jumps, Nami's flip, landings, bumps and stings, the cheer at the finish. A blob shadow on
// whatever it stands over (street, ramp, bus roof, rail).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { BUS_HALF_L, BUS_HALF_W, BUS_ROOF, RAIL_Y, inBox, overRail, rampY } from "./city";
import { V_JUMP, V_RUN, type CityRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   hurtX: number;
   hurtZ: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hurtAt: -9, hurtX: 1, hurtZ: 0, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

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

/** The intro's drop: the hero falls this far onto the start, curled up. */
export const INTRO_DROP = 14;

/** The animator's motion for this frame (pure: hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CityRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vy = h.vy;
   m.vz = h.vz;
   m.grounded = h.grounded;
   m.power = h.dashUntil >= ms ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   m.rolling = h.curled;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   if (introDrop) {
      m.rolling = true;
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = run.ended === "timeup";
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
      m.events.hurtX = anim.hurtX;
      m.events.hurtZ = anim.hurtZ;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -h.vy);
}

/** The floor under the hero (for the shadow): the rail, a bus roof, a ramp or the street. */
export function floorUnder(run: CityRun): number {
   const h = run.hero;
   const c = run.course;
   if (overRail(c, h.x, h.z) && h.y >= RAIL_Y - 0.3) return RAIL_Y;
   for (const b of run.buses) if (h.y >= BUS_ROOF - 0.5 && inBox(h.x, h.z, b.x, b.z, b.yaw, BUS_HALF_L, BUS_HALF_W)) return BUS_ROOF;
   return rampY(c, h.x, h.z);
}

export function Hero({ run, anim }: { run: CityRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: run.course.startYaw + Math.PI });

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
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      const s = shadow.current;
      if (s) {
         const floor = floorUnder(run);
         const above = y - floor;
         s.visible = visible && above < 12;
         s.position.set(h.x, floor + 0.07, h.z);
         const k = Math.max(0.35, 1 - above / 6);
         s.scale.set(k, k, k);
         (s.material as MeshBasicMaterial).opacity = 0.32 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 20]} />
            <meshBasicMaterial color="#1c1917" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
