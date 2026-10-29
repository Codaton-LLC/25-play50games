"use client";

// The rider and the chaser: the mine cart (m2MineCart) on its lane, rolled into the lean and tipped onto
// two wheels by a wrong one, the picked hero's own GLB standing in it (menu2/heroAnim: a hop is a jump,
// a duck curls the hero into the armoured ball, a hit the hurt recoil, the exit the cheer), the dragon's
// egg in the cart once you carry it home, and Cindermaw (m2CinderDragon): asleep on the hoard, then on
// your tail at the meter's distance, glowing orange through a breath's telegraph; on level 5 she flies
// round the loop with her grey collar (three locks that break as the last phase falls).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, PointLight } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { AnimatedHero, HS, createHeroMotion, useHeroAnimator, type HeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { ASSETS, CART_BED, CART_SCALE, DRAGON_BOSS, DRAGON_CHASE, GLB_SIZE } from "./assets";
import { CINDERMAW } from "./progression";
import { BREATH, V_HOP, bossDone, dragonGap, type CaveRun } from "./rules";
import { lanePoint } from "./track";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   hopAt: number;
   airHopAt: number;
   landAt: number;
   hitAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { hopAt: -9, airHopAt: -9, landAt: -9, hitAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export interface MotionMemo {
   hopAt: number;
   airHopAt: number;
   landAt: number;
   hitAt: number;
}

export function createMotionMemo(): MotionMemo {
   return { hopAt: -9, airHopAt: -9, landAt: -9, hitAt: -9 };
}

/** The animator's motion for this frame (pure: hero.test.ts drives it). The hero rides: no run cycle. */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: CaveRun, anim: HeroAnim, now: number): void {
   const c = run.cart;
   const ms = run.ms;
   m.vx = 0;
   m.vz = 0;
   m.vy = c.vy;
   m.grounded = c.h <= 0.01 && c.state === "ride";
   m.power = ms <= c.boostUntil ? "dash" : ms <= c.shieldUntil ? "shield" : ms <= c.magnetUntil ? "magnet" : ms <= c.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   // the duck is the signature roll: the hero curls into the armoured ball in the cart
   m.rolling = c.ducking || c.state === "lost" || introDrop;
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
   out.run = 0;
   out.phase = a.state.phase;
   out.tuck = w[HS.rise] + w[HS.takeoff] + w[HS.flip] + w[HS.fall] * 0.5;
   out.roll = a.body.ball;
   out.spin = a.body.spin;
   out.time = a.state.clock;
   out.cheer = w[HS.cheer];
}

const P = { x: 0, y: 0, z: 0, h: 0 };

/** The cart's world pose this frame (Scene's camera and the juice read it). */
export interface CartPose {
   x: number;
   y: number;
   z: number;
   heading: number;
   roll: number;
}

export function createCartPose(): CartPose {
   return { x: 0, y: 0, z: 0, heading: 0, roll: 0 };
}

/** Where the cart is drawn: its lane point at s, lifted by its hop and the lane's height. */
export function cartPose(run: CaveRun, out: CartPose): CartPose {
   const c = run.cart;
   const lane = run.course.lanes[c.lane];
   lanePoint(run.course, c.s, c.d, lane.y + Math.max(0, c.h), P);
   out.x = P.x;
   out.y = P.y;
   out.z = P.z;
   out.heading = P.h;
   return out;
}

export function Rider({ run, anim, pose }: { run: CaveRun; anim: HeroAnim; pose: CartPose }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const egg = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const standIn = useRef<ArmadilloPose>(createArmadilloPose());
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 6.5, jumpSpeed: V_HOP, yaw: 0 });
   const fallback = useMemo(() => <ArmadilloStandIn pose={standIn} />, []);
   const roll = useRef(0);

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      // the hero faces along the rails (its own yaw is held by the animator; the cart group turns)
      animator.body.yaw = 0;
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, delta) => {
      const g = root.current;
      if (!g) return;
      const c = run.cart;
      standInPose(animator, standIn.current);
      cartPose(run, pose);
      let y = pose.y;
      let visible = true;
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 14 * (1 - k) * (1 - k);
      }
      const now = time.now;
      if (c.state === "lost") s = Math.max(0, 1 - (now - anim.lostAt) / 0.9);
      else if (c.state === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         s = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.2 * Math.sin(t * Math.PI)) : 1;
      }
      const blink = c.invulnUntil > run.ms && c.state === "ride" && Math.floor(now * 14) % 2 === 0;
      g.visible = visible && s > 0.001 && !blink;
      g.position.set(pose.x, y, pose.z);
      g.rotation.y = pose.heading;
      g.scale.setScalar(Math.max(0.001, s));
      // roll into the lean; a wrong lean tips it onto two wheels (and it shakes)
      const want = -c.lean * 0.16 + (c.tilted ? (c.lean >= 0 ? -0.32 : 0.32) + Math.sin(now * 40) * 0.03 : 0);
      roll.current += (want - roll.current) * (1 - Math.exp(-10 * Math.min(0.1, delta)));
      pose.roll = roll.current;
      if (body.current) body.current.rotation.z = roll.current;
      if (egg.current) egg.current.visible = run.level > 1 || (run.course.hoardS > 0 && c.s > run.course.hoardS);
   });
   const ek = 0.55 / GLB_SIZE.egg.y;
   return (
      <group ref={root}>
         <group ref={body}>
            {/* the cart's GLB runs along its z; the rails run along -z here */}
            <group scale={[CART_SCALE.x, CART_SCALE.y, CART_SCALE.z]} rotation-y={Math.PI}>
               <Model asset={ASSETS.cart} />
            </group>
            <group position={[0, CART_BED, 0.2]} rotation-y={Math.PI}>
               <AnimatedHero animator={animator} fallback={fallback} />
            </group>
            <group ref={egg} position={[0.35, CART_BED, -0.75]} scale={ek} visible={false}>
               <Model asset={ASSETS.egg} />
            </group>
         </group>
      </group>
   );
}

/** Cindermaw: asleep on the hoard, then on your tail (or round the loop on level 5); her breath's glow. */
export function Dragon({ run, cart }: { run: CaveRun; cart: CartPose }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const mouth = useRef<Mesh>(null);
   const light = useRef<PointLight>(null);
   const locks = useRef<(Mesh | null)[]>([]);
   const pos = useRef({ x: 0, y: 0, z: 0, placed: false });
   const c = run.course;
   useFrame((_s, delta) => {
      const node = g.current;
      if (!node) return;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      const boss = run.boss;
      const loop = c.loop;
      let tx: number;
      let ty: number;
      let tz: number;
      let face: number;
      let scale = DRAGON_CHASE;
      if (!run.awake) {
         // asleep on the hoard (level 1), curled beside the track
         const s = c.hoardS > 0 ? c.hoardS : 0;
         lanePoint(c, s - 4, -9, -0.2, P);
         tx = P.x;
         ty = P.y;
         tz = P.z;
         face = P.h + Math.PI * 0.6;
      } else if (loop && boss && run.cart.s >= loop.s0 - 4 && !bossDone(run)) {
         scale = DRAGON_BOSS;
         const ph = boss.phase;
         if (ph === 0) {
            // beside you, a little ahead, over the outer track (in view of the chase camera)
            lanePoint(c, run.cart.s + 12, 10, 4.5, P);
         } else if (ph === 1) {
            // ahead of you, turned back to throw fireballs down the track
            lanePoint(c, run.cart.s + 30, 0, 3.2, P);
         } else {
            // hovering over the inside of the loop, ahead of you (the collar locks in view)
            const base = c.samples[Math.round(loop.s0 / 0.5) * 4 + 1];
            lanePoint(c, run.cart.s + 22, 0, 0, P);
            P.x += (loop.centre.x - P.x) * 0.4;
            P.z += (loop.centre.z - P.z) * 0.4;
            P.y = base + 7 + Math.sin(now * 1.2) * 0.6;
         }
         tx = P.x;
         ty = P.y;
         tz = P.z;
         face = Math.atan2(cart.x - tx, cart.z - tz);
         if (boss.step === "defeat") ty += (boss.stepMs / CINDERMAW.defeatMs) * 6;
      } else {
         const gap = bossDone(run) && loop ? -18 : dragonGap(run);
         lanePoint(c, run.cart.s - gap, 0, 2.6 + Math.sin(now * 2.4) * 0.4, P);
         tx = P.x;
         ty = P.y;
         tz = P.z;
         // her head (+z) along the rails (towards -z at heading 0)
         face = P.h + Math.PI;
      }
      const p = pos.current;
      const k = p.placed ? 1 - Math.exp(-6 * dt) : 1;
      p.placed = true;
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      p.z += (tz - p.z) * k;
      node.position.set(p.x, p.y, p.z);
      let dy = face - node.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      node.rotation.y += dy * (1 - Math.exp(-5 * dt));
      node.scale.setScalar(scale * (boss && boss.flashMs > 0 ? 1.06 : 1));
      node.visible = !(boss && boss.step === "done" && !run.awake);
      // the breath's telegraph: her throat glows, an orange light floods from behind
      let glow = 0;
      for (const br of run.breaths) {
         const t = br.fireAt - run.ms;
         if (t > 0 && t <= BREATH.telegraphMs) glow = Math.max(glow, 1 - t / BREATH.telegraphMs);
         else if (t <= 0 && t > -BREATH.fireMs) glow = 1;
      }
      if (boss && boss.step === "telegraph") glow = Math.max(glow, stepProgress(boss, CINDERMAW));
      if (mouth.current) {
         mouth.current.visible = glow > 0.02;
         mouth.current.scale.setScalar(0.4 + glow * 0.9 + Math.sin(now * 30) * 0.05 * glow);
         (mouth.current.material as MeshBasicMaterial).opacity = 0.4 + glow * 0.5;
      }
      if (light.current) light.current.intensity = glow * 40;
      // the collar locks (level 5): one fewer per hit in the last phase
      const left = boss ? (boss.phase >= 2 ? boss.hp : 3) : 0;
      locks.current.forEach((m, i) => {
         if (m) m.visible = !!loop && i < left && !bossDone(run);
      });
   });
   const H = GLB_SIZE.dragon;
   return (
      <group ref={g}>
         <Model asset={ASSETS.dragon} />
         <mesh ref={mouth} position={[0, H.y * 0.62, H.z * 0.48]} visible={false}>
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshBasicMaterial color="#ff8a2a" transparent opacity={0.6} toneMapped={false} />
         </mesh>
         <pointLight ref={light} position={[0, H.y * 0.6, H.z * 0.6]} color="#ff7a2a" distance={30} decay={1.4} intensity={0} />
         {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(m) => { locks.current[i] = m; }} position={[(i - 1) * 0.12, H.y * 0.66, H.z * 0.3]} rotation-x={Math.PI / 2} visible={false}>
               <torusGeometry args={[0.07, 0.02, 6, 16]} />
               <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} emissive="#a78bfa" emissiveIntensity={0.4} />
            </mesh>
         ))}
      </group>
   );
}
