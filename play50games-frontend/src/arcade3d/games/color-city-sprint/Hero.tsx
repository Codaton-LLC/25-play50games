"use client";

// The picked hero, animated by the shared Menu 2 animator. The code armadillo is the fallback.
// On a later lap a fast run down a red lane rolls the hero into the ball.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_JUMP, V_RED, V_RUN, type CityRun } from "./rules";

export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, fallSpeed: 0 };
}

export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CityRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vy = h.vy;
   m.vz = h.vz;
   m.grounded = h.grounded;
   const speed = Math.hypot(h.vx, h.vz);
   const red = run.lap >= 1 && h.edge >= 0 && run.painted[h.edge] === 1;
   m.rolling = h.grounded && red && speed >= V_RED * 0.92;
   m.power = h.dashUntil >= ms ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   if (introDrop) {
      m.rolling = true;
      m.vy = -16 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = run.ended === "timeup";
   m.events.jumped = false;
   m.events.airJumped = false;
   m.events.landed = false;
   m.events.hurt = false;
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      m.events.airJumped = true;
      memo.jumpAt = anim.jumpAt;
   } else if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = memo.fallSpeed;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -h.vy);
}

function standInPose(a: HeroAnimator, out: ArmadilloPose): void {
   const w = a.state.weights;
   out.run = a.state.runAmount * w[HS.run];
   out.phase = a.state.phase;
   out.tuck = w[HS.rise] + w[HS.takeoff] + w[HS.flip] + w[HS.fall] * 0.5;
   out.roll = a.body.ball;
   out.spin = a.body.spin;
   out.time = a.state.clock;
   out.cheer = w[HS.cheer];
}

export const INTRO_DROP = 14;

export function Hero({ run, anim }: { run: CityRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      standInPose(animator, standIn.current);
      let y = h.y;
      g.visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) g.visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      g.position.set(h.x, y, h.z);
      const s = shadow.current;
      if (s) {
         s.position.set(h.x, y + 0.03, h.z);
         s.visible = g.visible && h.y < 0.2;
      }
   });

   return (
      <group>
         <group ref={root}>
            <AnimatedHero animator={animator} fallback={fallback} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.42, 16]} />
            <meshBasicMaterial color="#1c1917" transparent opacity={0.28} depthWrite={false} />
         </mesh>
      </group>
   );
}
