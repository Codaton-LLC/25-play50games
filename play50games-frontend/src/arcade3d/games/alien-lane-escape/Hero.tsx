"use client";

// The runner: the picked hero's own GLB animated by the shared Menu 2 animator (menu2/heroAnim), the
// code stand-in (Armadillo.tsx) as the fallback. Every frame the run becomes the animator's HeroMotion:
// the run cycle at the track's speed, the jump (Nami's second jump = the somersault), the slide (the
// armoured ball, tucked low into the shadow), a stumble, the cheer at the finish. Caught by the tractor
// beam the hero is lifted and spun round (the card's funny hurt), and phasing Vexa turns half ghost.
// The lean into a lane change and the blob shadow stay here too.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_HOP, speedNow, visualS, type AlienRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   hopAt: number;
   airHopAt: number;
   landAt: number;
   hitAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { hopAt: -9, airHopAt: -9, landAt: -9, hitAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
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
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: AlienRun, anim: HeroAnim, now: number): void {
   const r = run.runner;
   const ms = run.ms;
   m.vx = 0;
   m.vz = run.ended === "win" ? 0 : -speedNow(run);
   m.vy = r.vy;
   const held = ms < r.heldUntil;
   m.grounded = (r.h <= 0.001 || r.onMesa) && !held;
   if (held) m.vy = 0;
   m.power = ms < run.dashUntil ? "dash" : ms < run.shieldUntil ? "shield" : ms < run.magnetUntil ? "magnet" : ms < run.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = r.sliding || introDrop;
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

export function Runner({ run, anim }: { run: AlienRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 9, jumpSpeed: V_HOP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);
   const lean = useRef(0);
   const spin = useRef(0);

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
      const held = run.ms < r.heldUntil;
      const blink = !held && r.invulnUntil > run.ms && Math.floor(now * 14) % 2 === 0;
      g.visible = visible && !blink;
      g.position.set(r.x, y, -visualS(run));
      // the tractor beam spins the hero round; the slide tucks it low
      spin.current = held ? spin.current + Math.min(0.1, delta) * 9 : spin.current * Math.exp(-8 * Math.min(0.1, delta));
      g.rotation.y = spin.current;
      const squash = r.sliding ? 0.72 : 1;
      g.scale.set(1, squash, 1);
      // lean into a lane change
      const want = r.swapAt >= 0 ? Math.sign(r.x - r.fromX) * -0.25 : 0;
      lean.current += (want - lean.current) * (1 - Math.exp(-10 * Math.min(0.1, delta)));
      if (body.current) body.current.rotation.z = lean.current;
      const sh = shadow.current;
      if (sh) {
         const top = r.onMesa ? 2.4 : 0;
         const above = y - top;
         sh.visible = visible && above < 10;
         sh.position.set(r.x, top + 0.04, -visualS(run));
         const ks = Math.max(0.35, 1 - above / 8);
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
            <meshBasicMaterial color="#0b0420" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
