"use client";

// The Menu 2 hero on the clouds: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: useHeroAnimator + <AnimatedHero>), the code stand-in (Armadillo.tsx) as the
// fallback. Every frame the run (rules.ts) and the Scene's moments (HeroAnim) become the animator's
// HeroMotion: velocity, grounded, the power that is up, the ball (the intro drop and a fall), the
// cheer at the bell, and one-frame events (jump, Nami's air jump = the somersault, land, a hit).
// A glide reads as the animator's fall state held at the glide's slow sink (arms out, legs reaching),
// with a feather trail streamed by the Scene. The pop-in on respawn, the shrink of a fall, a slight
// forward lean while gliding and the blob shadow stay here.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_JUMP, V_RUN, cloudTop, cloudX, heroVy, type CloudRun } from "./rules";
import { V_DASH } from "./heroes";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   // winAt starts in the future (never won): the cheer runs from winAt on
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start cloud, curled up. */
export const INTRO_DROP = 24;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
   fallSpeed: number;
   wasGrounded: boolean;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9, fallSpeed: 0, wasGrounded: true };
}

/** The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CloudRun, anim: HeroAnim, now: number, yaw = 0): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = heroVy(h, ms);
   const dashing = h.dashUntil >= ms;
   if (dashing) {
      m.vx = h.dashX * V_DASH;
      m.vz = h.dashZ * V_DASH;
   }
   m.grounded = h.grounded && h.state === "play";
   m.power = dashing ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
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
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      // a hit (thunder, hail, the boss) rather than a plain fall: the hurt recoil
      if (run.events.struck || memo.wasGrounded) {
         m.events.hurt = true;
         m.events.hurtX = -Math.sin(yaw);
         m.events.hurtZ = -Math.cos(yaw);
      }
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
   memo.wasGrounded = h.grounded && h.state === "play";
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

export function Hero({ run, anim, ground }: { run: CloudRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const lean = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);
   const tilt = useRef(0);

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
      if (h.state === "lost") s = Math.max(0, 1 - (now - anim.lostAt) / 0.9);
      else if (h.state === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         s = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI)) : 1;
      }
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible && s > 0.001;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      // a glide leans the body into the flight (eased)
      const want = h.gliding ? 0.32 : 0;
      tilt.current += (want - tilt.current) * (1 - Math.exp(-8 * Math.min(0.1, delta)));
      if (lean.current) lean.current.rotation.x = -tilt.current;

      const sh = shadow.current;
      if (sh) {
         const top = ground.current;
         const above = y - top;
         sh.visible = visible && h.state !== "lost" && Number.isFinite(top) && above < 14;
         sh.position.set(h.x, top + 0.03, h.z);
         const k = Math.max(0.35, 1 - above / 10);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.32 * k;
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
            <meshBasicMaterial color="#5b6c94" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}

/** The crown of the highest cloud under (x, z) at or below the feet (the shadow's floor), -Infinity if none. */
export function groundUnder(run: CloudRun, x: number, z: number, feet: number, ms: number): number {
   let best = -Infinity;
   const clouds = run.course.clouds;
   for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const t = cloudTop(run, i, ms);
      if (!(t === t) || t > feet + 0.05 || t <= best) continue;
      if (Math.abs(x - cloudX(c, ms)) <= c.hw && Math.abs(z - c.cz) <= c.hd) best = t;
   }
   return best;
}
