"use client";

// The runner: the picked hero's own GLB animated by the shared Menu 2 animator (menu2/heroAnim), the
// code stand-in (Armadillo.tsx) as the fallback. Every frame the run becomes the animator's HeroMotion:
// the run cycle at the road's speed, the hop (Nami's second hop = the somersault), the sugar-burn roll
// (the armoured ball), a stumble on a size miss, the cheer at the finish. The size here is the card's
// distinct scale (0.7 / 1.0 / 1.4), eased with a squash-and-stretch pop on each grow and shrink; the
// lean into a lane change and the blob shadow stay here too.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { SIZE_SCALE, V_HOP, speedNow, visualS, type CandyRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   hopAt: number;
   airHopAt: number;
   landAt: number;
   hitAt: number;
   sizeAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { hopAt: -9, airHopAt: -9, landAt: -9, hitAt: -9, sizeAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export const INTRO_DROP = 16;

export interface MotionMemo {
   hopAt: number;
   airHopAt: number;
   landAt: number;
   hitAt: number;
}

export function createMotionMemo(): MotionMemo {
   return { hopAt: -9, airHopAt: -9, landAt: -9, hitAt: -9 };
}

/** The animator's motion for this frame (pure: misc.test.ts drives it). The runner runs towards -z. */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CandyRun, anim: HeroAnim, now: number): void {
   const r = run.runner;
   const ms = run.ms;
   m.vx = 0;
   m.vz = run.ended === "win" ? 0 : -speedNow(run);
   m.vy = r.vy;
   m.grounded = r.h <= 0.001 || r.onRail;
   m.power = ms <= run.dashUntil ? "dash" : ms <= run.shieldUntil ? "shield" : run.magnetOn ? "magnet" : ms <= run.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = r.rolling || introDrop;
   if (introDrop) {
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
   if (anim.airHopAt !== memo.airHopAt) {
      memo.airHopAt = anim.airHopAt;
      memo.hopAt = anim.hopAt;
      m.events.airJumped = true;
   } else if (anim.hopAt !== memo.hopAt) {
      memo.hopAt = anim.hopAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = 6;
   }
   if (anim.hitAt !== memo.hitAt) {
      memo.hitAt = anim.hitAt;
      m.events.hurt = true;
      m.events.hurtX = 0;
      m.events.hurtZ = 1;
   }
}

/** The drawn scale at a size, with a squash-and-stretch pop for 0.35 s after a change (x/z, y). */
export function sizeScale(size: number, sinceChangeMs: number, from: number): { xz: number; y: number } {
   const target = SIZE_SCALE[size as 0 | 1 | 2];
   const t = Math.min(1, sinceChangeMs / 350);
   const base = from + (target - from) * (1 - (1 - t) * (1 - t));
   const pop = t < 1 ? Math.sin(t * Math.PI) * 0.18 : 0;
   return { xz: base * (1 - pop * 0.5), y: base * (1 + pop) };
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

export function Runner({ run, anim }: { run: CandyRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 9, jumpSpeed: V_HOP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);
   const sizeFrom = useRef<number>(SIZE_SCALE[0]);
   const lastSize = useRef<number>(0);
   const lean = useRef(0);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, delta) => {
      const g = root.current;
      if (!g) return;
      const r = run.runner;
      const now = time.now;
      standInPose(animator, standIn.current);
      let y = r.h;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      if (r.size !== lastSize.current) {
         sizeFrom.current = SIZE_SCALE[lastSize.current as 0 | 1 | 2];
         lastSize.current = r.size;
      }
      const sc = sizeScale(r.size, run.ms - r.sizeAt, sizeFrom.current);
      const blink = r.invulnUntil > run.ms && Math.floor(now * 14) % 2 === 0;
      g.visible = visible && !blink;
      g.position.set(r.x, y, -visualS(run));
      g.scale.set(sc.xz, sc.y, sc.xz);
      // lean into a lane change
      const want = r.swapAt >= 0 ? Math.sign(r.x - r.fromX) * -0.25 : 0;
      lean.current += (want - lean.current) * (1 - Math.exp(-10 * Math.min(0.1, delta)));
      if (body.current) body.current.rotation.z = lean.current;
      const sh = shadow.current;
      if (sh) {
         const top = r.onRail ? 2.4 : 0;
         const above = y - top;
         sh.visible = visible && above < 10;
         sh.position.set(r.x, top + 0.04, -visualS(run));
         const ks = Math.max(0.35, 1 - above / 8) * sc.xz;
         sh.scale.set(ks, ks, ks);
         (sh.material as MeshBasicMaterial).opacity = 0.32;
      }
   });

   return (
      <>
         <group ref={root}>
            <group ref={body} position={[0, 0.6, 0]}>
               <group position={[0, -0.6, 0]}>
                  <AnimatedHero animator={animator} fallback={fallback} />
               </group>
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.55, 24]} />
            <meshBasicMaterial color="#831843" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
