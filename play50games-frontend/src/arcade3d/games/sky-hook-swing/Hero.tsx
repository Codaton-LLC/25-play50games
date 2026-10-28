"use client";

// The picked hero, animated by menu2/heroAnim. The fallback is a small capsule until the GLB
// loads. The body faces the hero's travel (faceX, faceZ). A swing leans them along the rope.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { V_JUMP, V_RUN, type SwingRun } from "./rules";

export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

interface Memo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
}

export function createMotionMemo(): Memo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9 };
}

/** The animator's motion for this frame. Pure aside from the motion object it fills. */
export function writeHeroMotion(m: HeroMotion, memo: Memo, run: SwingRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vy = h.vy;
   m.vz = h.vz;
   m.grounded = h.grounded && h.mode === "ground";
   const dashing = h.dashUntil >= ms;
   m.power = dashing ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   m.rolling = h.mode === "lost" || (!Number.isNaN(anim.intro) && anim.intro < 0.97);
   m.celebrating = now - anim.winAt >= 0 && now - anim.winAt < 2.4;
   m.defeated = h.mode === "lost";
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
      m.events.landSpeed = 6;
   }
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      m.events.hurt = true;
      m.events.hurtX = -h.faceX;
      m.events.hurtZ = -h.faceZ;
   }
}

export function Hero({ run, anim, accent }: { run: SwingRun; anim: HeroAnim; accent?: string }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI / 2 });
   const color = accent ?? heroById(run.heroId).color;
   const fallback = useMemo(() => (
      <mesh position={[0, 0.75, 0]} castShadow>
         <capsuleGeometry args={[0.28, 0.7, 6, 10]} />
         <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
   ), [color]);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      const h = run.hero;
      animator.body.yaw = Math.atan2(h.faceX, h.faceZ);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let y = h.y;
      let visible = h.mode !== "lost";
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 18 * (1 - k) * (1 - k);
      }
      if (h.mode === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.4);
         s = Math.sin(t * Math.PI * 0.5);
      }
      g.visible = visible && s > 0.02;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.02, s));
      const sh = shadow.current;
      if (sh) {
         const deck = run.course.islands[h.support];
         const top = deck ? deck.y : h.y;
         const above = y - top;
         sh.visible = visible && above < 16 && above > -0.2;
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.35, 1 - above / 12);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.28 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} fallback={fallback} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.55, 16]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.28} depthWrite={false} />
         </mesh>
      </>
   );
}
