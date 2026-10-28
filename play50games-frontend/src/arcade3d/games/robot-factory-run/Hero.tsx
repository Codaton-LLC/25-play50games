"use client";

// The picked hero on the factory floor, animated by the shared Menu 2 animator (menu2/heroAnim):
// walk / run with the belt's push, jump, Nami's flip, the roll-drop (the armoured ball), a hit's
// recoil, the cheer at the exit; the intro drops it in curled up. A blob shadow follows it.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { V_JUMP, V_WALK, groundAt, type FactoryRun } from "./rules";

export interface HeroAnim {
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The animator's motion for this frame (pure: assets.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, run: FactoryRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const e = run.events;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vy = h.vy;
   m.vz = h.vz;
   m.grounded = h.grounded;
   m.power = ms <= h.dashUntil ? "dash" : ms <= h.shieldUntil ? "shield" : ms <= h.magnetUntil ? "magnet" : ms <= h.phaseUntil ? "phase" : null;
   m.rolling = h.dropping || (!Number.isNaN(anim.intro) && anim.intro < 0.97);
   m.celebrating = now >= anim.winAt;
   m.defeated = false;
   if (e.airJumped) m.events.airJumped = true;
   else if (e.jumped) m.events.jumped = true;
   if (e.landed) {
      m.events.landed = true;
      m.events.landSpeed = h.dropping ? 14 : 6;
   }
   if (e.hurt) {
      m.events.hurt = true;
      m.events.hurtX = h.vx;
      m.events.hurtZ = h.vz;
   }
}

export function Hero({ run, anim }: { run: FactoryRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK + 2.5, jumpSpeed: V_JUMP, yaw: Math.PI });
   useFrame(() => {
      writeHeroMotion(motion, run, anim, time.now);
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
         y += 14 * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      const sh = shadow.current;
      if (sh) {
         const top = groundAt(run, h.x, h.z, h.y + 0.05);
         const above = y - top;
         sh.visible = visible && above < 10;
         sh.position.set(h.x, top + 0.05, h.z);
         const k = Math.max(0.35, 1 - above / 6);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.4 * k;
      }
   });
   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.45, 24]} />
            <meshBasicMaterial color="#0d0b0a" transparent opacity={0.4} depthWrite={false} />
         </mesh>
      </>
   );
}
