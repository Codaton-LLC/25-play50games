"use client";

// The Menu 2 hero on the peak: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: useHeroAnimator + <AnimatedHero>), the code stand-in (Armadillo.tsx) as the
// fallback. Every frame the run (rules.ts) and the Scene's moments (HeroAnim) become the animator's
// HeroMotion: on snow the walk, on ice a glide (no stride: the ice carries you; a short push while the
// stick builds the slide), grounded, the power that is up, the ball (the intro drop, a fall), the cheer at
// the summit, and one-frame events (jump, Nami's re-aimed air jump = the somersault, land, a hit). The
// lean into a slide and a brake, the pop-in on respawn, the shrink of a fall and the blob shadow stay here.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_JUMP, V_WALK, grips, type PeakRun } from "./rules";
import { topAt } from "./course";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   hitAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, hitAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start pad, curled up. */
export const INTRO_DROP = 22;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hitAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hitAt: -9, fallSpeed: 0 };
}

/** Is the hero gliding on ice (no grip under it)? */
export function onIce(run: PeakRun): boolean {
   const h = run.hero;
   if (h.ground < 0 || h.state !== "play") return false;
   return !grips(run, run.course.plats[h.ground]);
}

/** The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: PeakRun, anim: HeroAnim, now: number, yaw = 0): void {
   const h = run.hero;
   const ms = run.ms;
   // on ice the body faces the slide but the legs barely move (a glide); on snow it walks
   const glide = onIce(run) ? 0.18 : 1;
   m.vx = h.vx * glide;
   m.vz = h.vz * glide;
   m.vy = h.vy;
   const dashing = run.dashUntil >= ms;
   m.grounded = (h.ground >= 0 || h.riding >= 0) && h.state === "play";
   m.power = dashing ? "dash" : run.shieldUntil >= ms ? "shield" : run.magnetUntil >= ms ? "magnet" : run.phaseUntil >= ms ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = h.state === "lost" || introDrop;
   if (introDrop) {
      m.vy = -18 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
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
   if (anim.hitAt !== memo.hitAt) {
      memo.hitAt = anim.hitAt;
      m.events.hurt = true;
      m.events.hurtX = -Math.sin(yaw);
      m.events.hurtZ = -Math.cos(yaw);
   }
   if (h.ground < 0) memo.fallSpeed = Math.max(0, -m.vy);
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

export function Hero({ run, anim, ground }: { run: PeakRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const lean = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_WALK, jumpSpeed: V_JUMP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);
   const tiltX = useRef(0);
   const tiltZ = useRef(0);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now, animator.body.yaw);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, delta) => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      standInPose(animator, standIn.current);
      let y = h.y;
      let visible = true;
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      if (h.state === "lost") s = Math.max(0, 1 - (now - anim.lostAt) / 0.6);
      else {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         s = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI)) : 1;
      }
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      // a flicker while invulnerable after a hit
      const blink = run.invulnUntil > run.ms && h.state === "play" && Math.floor(now * 14) % 2 === 0;
      g.visible = visible && s > 0.001 && !blink;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      // a slide leans back a little (a brake leans back hard, digging in)
      const ice = onIce(run);
      const lb = h.braking ? 0.09 : ice ? 0.025 : 0;
      const wantX = Math.max(-0.4, Math.min(0.4, h.vz * lb));
      const wantZ = Math.max(-0.4, Math.min(0.4, -h.vx * lb));
      const k = 1 - Math.exp(-7 * Math.min(0.1, delta));
      tiltX.current += (wantX - tiltX.current) * k;
      tiltZ.current += (wantZ - tiltZ.current) * k;
      if (lean.current) {
         lean.current.rotation.x = tiltX.current;
         lean.current.rotation.z = tiltZ.current;
      }
      const sh = shadow.current;
      if (sh) {
         const top = ground.current;
         const above = y - top;
         sh.visible = visible && h.state !== "lost" && Number.isFinite(top) && above < 14;
         sh.position.set(h.x, top + 0.03, h.z);
         const ks = Math.max(0.35, 1 - above / 10);
         sh.scale.set(ks, ks, ks);
         (sh.material as MeshBasicMaterial).opacity = 0.34 * ks;
      }
   });

   return (
      <>
         <group ref={root}>
            <group ref={lean} position={[0, 0.7, 0]}>
               <group position={[0, -0.7, 0]}>
                  <AnimatedHero animator={animator} fallback={fallback} />
               </group>
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#0b1424" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}

/** The top under the hero (the blob shadow), each frame. */
export function GroundProbe({ run, ground }: { run: PeakRun; ground: { current: number } }) {
   useFrame(() => {
      const h = run.hero;
      let best = Number.NEGATIVE_INFINITY;
      for (const p of run.course.plats) {
         if (Math.abs(h.x - p.x) > p.hx || Math.abs(h.z - p.z) > p.hz) continue;
         const t = topAt(p, h.x, h.z);
         if (t <= h.y + 0.05 && t > best && run.goneAt[p.id] < 0) best = t;
      }
      ground.current = best;
   }, FRAME_PRIORITY.camera);
   return null;
}
