"use client";

// The picked hero on the rope, animated by the shared Menu 2 animator (menu2/heroAnim): idle, walk,
// sprint, the jump, the crouch, the wobble (arms flailing), the fall into the mist and the cheer. The
// body leans with the needle and the long balance pole (m2BalancePole, laid across his hands) dips at
// the end he leans to. A shield bubble rides along; Vexa glows violet while she phases.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { Model } from "@/arcade3d/core/assets";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { ASSETS, POLE_LEN, POLE_SCALE } from "./assets";
import { V_SPRINT, heroPoint, type TightRun } from "./rules";
import { COLORS, levelLook } from "./look";

export interface HeroAnim {
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export const INTRO_DROP = 10;

/** The animator's motion for this frame (pure: no three.js). */
export function writeHeroMotion(m: HeroMotion, run: TightRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   // the hero's group is already turned along the link: the animator works in that frame (+z forward)
   const v = h.air ? h.airV : h.v;
   m.vx = 0;
   m.vz = v;
   m.vy = h.air ? h.vy : h.fallMs >= 0 ? -10 : 0;
   m.grounded = !h.air && h.fallMs < 0;
   const ms = run.simMs;
   m.power = ms <= h.dashUntil ? "dash" : ms <= h.shieldUntil ? "shield" : ms <= h.magnetUntil ? "magnet" : ms <= h.phaseUntil ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = introDrop;
   if (introDrop) {
      m.vy = -12 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = h.fallMs >= 0;
}

const AT = { x: 0, y: 0, z: 0 };

export function Hero({ run, anim }: { run: TightRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const lean = useRef<Group>(null);
   const pole = useRef<Group>(null);
   const bubble = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_SPRINT + 0.001, jumpSpeed: 6, yaw: Math.PI });
   const drawnLean = useRef(0);

   useFrame(() => {
      writeHeroMotion(motion, run, anim, time.now);
      // local forward: the root group carries the link's heading
      animator.body.yaw = turnTowards(animator.body.yaw, 0, 0.2);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, dt) => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const l = run.course.links[h.link];
      heroPoint(run, AT);
      let y = AT.y;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      g.visible = visible && !(h.fallMs > 900);
      g.position.set(AT.x, y, AT.z);
      g.rotation.y = Math.atan2(l.dx, l.dz);
      // the body leans with the needle (eased), wobbling past 100 %
      const want = Math.max(-1.3, Math.min(1.3, h.lean)) * 0.32 + (h.wobbleMs > 0 ? Math.sin(time.now * 22) * 0.12 : 0);
      drawnLean.current += (want - drawnLean.current) * Math.min(1, dt * 12);
      const ln = lean.current;
      if (ln) {
         ln.rotation.z = drawnLean.current;
         ln.scale.y = h.crouch ? 0.72 : 1;
      }
      const p = pole.current;
      if (p) {
         // the pole dips at the end he leans to
         p.rotation.z = drawnLean.current * 0.9;
         p.position.y = h.crouch ? 0.72 : 1.0;
      }
      const b = bubble.current;
      if (b) {
         b.visible = run.simMs <= h.shieldUntil && g.visible;
         b.position.set(AT.x, y + 0.9, AT.z);
         b.scale.setScalar(1.1 + 0.04 * Math.sin(time.now * 8));
      }
   });

   return (
      <>
         <group ref={root}>
            <group ref={lean}>
               <AnimatedHero animator={animator} />
               <group ref={pole} position={[0, 1, 0.28]}>
                  <Model asset={ASSETS.pole} rotation-z={Math.PI / 2} position={[POLE_LEN / 2, 0, 0]} scale={POLE_SCALE} fallback={<PoleStandIn />} />
               </group>
            </group>
         </group>
         {levelLook(run.level).lighting === "night" ? <HeroLamp run={run} /> : null}
         <mesh ref={bubble} visible={false}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

/** Night (level 4): a warm lamp over the hero lights the next few metres of rope (the card: 8 m of sight). */
function HeroLamp({ run }: { run: TightRun }) {
   const ref = useRef<Group>(null);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      heroPoint(run, at);
      g.position.set(at.x, at.y + 2.2, at.z);
   });
   return (
      <group ref={ref}>
         <pointLight color={COLORS.torch} intensity={9} distance={9} decay={1.4} />
      </group>
   );
}

/** The pole's code stand-in: a light wood shaft with bronze end caps (the card's fallback). */
function PoleStandIn() {
   return (
      <group>
         <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 1.9, 8]} />
            <meshStandardMaterial color="#d6b37a" roughness={0.7} />
         </mesh>
         {[0, 1.9].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
               <sphereGeometry args={[0.09, 10, 8]} />
               <meshStandardMaterial color="#b08a4a" metalness={0.7} roughness={0.3} />
            </mesh>
         ))}
      </group>
   );
}
