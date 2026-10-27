"use client";

// The Menu 2 hero on the course: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: useHeroAnimator + <AnimatedHero>), with the code stand-in (Armadillo.tsx) as the
// fallback. Every frame the run (rules.ts) and the Scene's moments (HeroAnim) are turned into the
// animator's HeroMotion: velocity, grounded, the power that is up, the ball (bounce flights, the
// intro drop, a fall), the cheer at the gate, and one-frame events (jump, Nami's double jump, land,
// a lightning hit). The animator picks and blends idle, run (feet planted), takeoff / rise / fall /
// land, the somersault, the ball-roll, the dash streak, hurt and cheer. The pop-in on respawn and
// the shrink of a fall stay here, and a blob shadow sits on the platform under the hero.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_BOUNCE, V_JUMP, V_RUN, arcVy, supportX, supportZ, type SkyRun } from "./rules";
import { V_DASH } from "./heroes";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   bounceAt: number;
   jumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, bounceAt: -9, jumpAt: -9, lostAt: -9, spawnAt: -9, winAt: -9, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start platform, curled up. */
export const INTRO_DROP = 24;

/** What the motion writer remembers between frames (to turn the Scene's stamps into one-frame events). */
export interface MotionMemo {
   jumpAt: number;
   landAt: number;
   lostAt: number;
   /** the last airborne vertical speed (m/s): the landing's impact */
   fallSpeed: number;
   wasGrounded: boolean;
   /** the hero's airJump last frame: true -> false in the air is Nami's double jump */
   airJump: boolean;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, landAt: -9, lostAt: -9, fallSpeed: 0, wasGrounded: true, airJump: true };
}

/**
 * The animator's motion for this frame, from the run and the Scene's stamps (pure: no three.js;
 * hero.test.ts drives it). `now` = useGameTime().now, `yaw` the hero's facing (a hit tips it back).
 */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: SkyRun, anim: HeroAnim, now: number, yaw = 0): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   m.vy = h.grounded ? 0 : arcVy(h, ms);
   if (h.dashUntil >= ms) {
      // the dash: the rules move the hero at V_DASH along (dashX, dashZ)
      m.vx = h.dashX * V_DASH;
      m.vz = h.dashZ * V_DASH;
   }
   m.grounded = h.grounded && h.state === "play";
   m.power = h.dashUntil >= ms ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   // the ball: a bounce flight (from the pad until it lands), the intro's drop, and a fall (lost)
   const bounced = !h.grounded && anim.bounceAt > anim.landAt && h.arcV >= V_BOUNCE - 1e-9;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = h.state === "lost" || introDrop || bounced;
   if (introDrop) {
      m.vy = -18 * (1 - anim.intro);
      m.grounded = false;
   }
   const tw = now - anim.winAt;
   m.celebrating = tw >= 0;
   m.defeated = false;
   // the events, once per stamp
   if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      // Nami's double jump spends her air jump in the air: the somersault; any other jump takes off
      if (!memo.wasGrounded && memo.airJump && !h.airJump) m.events.airJumped = true;
      else m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      // lost while standing = struck by lightning on the rim: a hit before the fall
      if (memo.wasGrounded) {
         m.events.hurt = true;
         m.events.hurtX = -Math.sin(yaw);
         m.events.hurtZ = -Math.cos(yaw);
      }
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
   memo.wasGrounded = h.grounded && h.state === "play";
   memo.airJump = h.airJump;
}

/** The stand-in's own joint pose, read from the animator (the stand-in swings its groups from it). */
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

export function Hero({ run, anim, ground }: { run: SkyRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);

   // after the simulation (useRunFrame) and the camera, before the animator's drive (pose)
   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now, animator.body.yaw);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      standInPose(animator, standIn.current);
      let y = h.y;
      let visible = true;
      let s = 1;
      // the intro's drop onto the start platform
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
      // a spin at the gate on top of the cheer's hops
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 6 * (1 - tw / 2);
      g.visible = visible && s > 0.001;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));

      const sh = shadow.current;
      if (sh) {
         const top = ground.current;
         const above = y - top;
         sh.visible = visible && h.state !== "lost" && Number.isFinite(top) && above < 14;
         sh.position.set(h.x, top + 0.03, h.z);
         const k = Math.max(0.35, 1 - above / 10);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.38 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} fallback={fallback} />
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#0b2340" transparent opacity={0.35} depthWrite={false} />
         </mesh>
      </>
   );
}

/** The top of the highest platform under (x, z) at or below the feet (the shadow's floor), -Infinity if none. */
export function groundUnder(run: SkyRun, x: number, z: number, feet: number, ms: number): number {
   let best = -Infinity;
   for (const s of run.course.supports) {
      if (s.top > feet + 0.05 || s.top <= best) continue;
      if (Math.abs(x - supportX(s, ms)) <= s.hw && Math.abs(z - supportZ(s, ms)) <= s.hd) best = s.top;
   }
   return best;
}
