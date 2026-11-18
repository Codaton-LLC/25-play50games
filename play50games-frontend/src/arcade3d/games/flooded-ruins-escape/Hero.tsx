"use client";

// The Menu 2 hero in the drowned temple: the picked hero's own GLB animated by the shared Menu 2
// animator (menu2/heroAnim: useHeroAnimator + <AnimatedHero>), with the code stand-in (Armadillo.tsx)
// as the fallback. Every frame the run (rules.ts) and the Scene's moments (HeroAnim) become the
// animator's HeroMotion: velocity, grounded (a swimmer paddles: it counts as grounded with its swim
// speed, so the animator's run cycle is the paddle), the power that is up, the ball (Riko's dash
// through cracked brick, the intro drop, a loss), the cheer at the gate, and one-frame events (jump,
// a leap out of the water, Nami's breach, land, a hit). Around the hero: the card's air meter as a
// ring (not UI text) while the head is under water, and a blob shadow on the floor or the water.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { AIR_MS, HEAD, NONE, V_JUMP, V_RUN, arcVy, onSupport, supportTop, surfaceAt, type RuinRun } from "./rules";
import { V_DASH } from "./heroes";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   // winAt starts in the future (never won): the cheer runs from winAt on
   return { landAt: -9, jumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start block, curled up. */
export const INTRO_DROP = 20;

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
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: RuinRun, anim: HeroAnim, now: number, yaw = 0): void {
   const h = run.hero;
   const ms = run.simMs;
   m.vx = h.vx;
   m.vz = h.vz;
   const onFoot = (h.grounded || h.swim) && h.state === "play";
   m.vy = onFoot ? 0 : arcVy(h, ms);
   if (h.dashUntil !== NONE && h.dashUntil >= ms) {
      // the dash: the rules move the hero at V_DASH along (dashX, dashZ)
      m.vx = h.dashX * V_DASH;
      m.vz = h.dashZ * V_DASH;
   }
   // a swimmer paddles: the animator's ground cycle at the swim speed
   m.grounded = onFoot;
   m.power = h.dashUntil >= ms ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   // the ball: the dash (Riko rolls through cracked brick), the intro's drop, and a loss
   m.rolling = h.state === "lost" || introDrop || m.power === "dash";
   if (introDrop) {
      m.vy = -18 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = false;
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
      // lost while standing or swimming (a jet, a bat, the boss, the tide): a hit before the fall
      if (memo.wasGrounded) {
         m.events.hurt = true;
         m.events.hurtX = -Math.sin(yaw);
         m.events.hurtZ = -Math.cos(yaw);
      }
   }
   if (!onFoot) memo.fallSpeed = Math.max(0, -m.vy);
   memo.wasGrounded = onFoot;
   memo.airJump = h.airJump;
}

/** The air meter's fill 0..1, and whether the ring shows (the head under water, or the meter not full). */
export function airRing(run: RuinRun, out: { fill: number; show: boolean } = { fill: 0, show: false }): { fill: number; show: boolean } {
   const h = run.hero;
   const fill = Math.max(0, Math.min(1, h.air / AIR_MS));
   const surface = surfaceAt(run.course, run.water, h.x, h.z, run.simMs);
   const under = h.state === "play" && h.y + HEAD < surface;
   out.fill = fill;
   out.show = h.state === "play" && (under || fill < 0.999);
   return out;
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

/** The air meter ring: 24 segments round the hero's chest, lit for the air left (blue to red). */
const RING_SEGMENTS = 24;

function AirRing({ run }: { run: RuinRun }) {
   const group = useRef<Group>(null);
   const segs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   const air = useMemo(() => ({ fill: 1, show: false }), []);
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const h = run.hero;
      const { fill, show } = airRing(run, air);
      g.visible = show;
      if (!show) return;
      g.position.set(h.x, h.y + 0.75, h.z);
      g.rotation.y = time.now * 0.6;
      const lit = Math.round(fill * RING_SEGMENTS);
      const low = fill < 0.3;
      for (let i = 0; i < RING_SEGMENTS; i++) {
         const s = segs.current[i];
         if (!s) continue;
         const mat = s.material as MeshBasicMaterial;
         const on = i < lit;
         mat.color.set(on ? (low ? "#f87171" : "#7dd3fc") : "#1e293b");
         mat.opacity = on ? (low ? 0.6 + 0.4 * Math.abs(Math.sin(time.now * 8)) : 0.9) : 0.35;
      }
   });
   return (
      <group ref={group} visible={false}>
         {Array.from({ length: RING_SEGMENTS }, (_, i) => {
            const a = (i / RING_SEGMENTS) * Math.PI * 2;
            return (
               <mesh key={i} ref={(m) => { segs.current[i] = m; }} position={[Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78]} rotation-y={a} renderOrder={6}>
                  <boxGeometry args={[0.15, 0.07, 0.05]} />
                  <meshBasicMaterial color="#7dd3fc" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
               </mesh>
            );
         })}
      </group>
   );
}

export function Hero({ run, anim, ground, ring = true }: { run: RuinRun; anim: HeroAnim; ground: MutableRefObject<number>; ring?: boolean }) {
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
      // a swimmer bobs a little at the surface
      if (h.swim && h.state === "play") y += Math.sin(now * 3.2) * 0.04;
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
         sh.visible = visible && h.state !== "lost" && !h.swim && Number.isFinite(top) && above < 14;
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
         {ring ? <AirRing run={run} /> : null}
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#0b2340" transparent opacity={0.35} depthWrite={false} />
         </mesh>
      </>
   );
}

/**
 * The shadow's floor under (x, z) at or below the feet: the highest block top (crates where they
 * float now, broken brick left out) or a chamber's water surface; -Infinity if none.
 */
export function groundUnder(run: RuinRun, x: number, z: number, feet: number, ms: number): number {
   const course = run.course;
   let best = surfaceAt(course, run.water, x, z, ms);
   if (best > feet + 0.05) best = -Infinity;
   for (let i = 0; i < course.supports.length; i++) {
      const s = course.supports[i];
      if (s.crack && run.broken[i]) continue;
      const top = supportTop(course, run.water, s, ms);
      if (top > feet + 0.05 || top <= best) continue;
      if (onSupport(s, x, z)) best = top;
   }
   return best;
}
