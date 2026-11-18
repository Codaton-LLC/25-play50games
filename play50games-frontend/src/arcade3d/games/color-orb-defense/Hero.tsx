"use client";

// The picked hero on menu2/heroAnim (run, jump, Nyla's flip, a stagger when the drone knocks him, cheer
// when the waves are held), with a ring at his feet in the colour of the zone he stands on (white off a
// zone) and his power's aura. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { COLORS } from "./look";
import { PALETTE } from "./arena";
import { V_JUMP, V_RUN, type DefenseRun } from "./rules";

export interface HeroAnim {
   jumpAt: number;
   airJumpAt: number;
   hurtAt: number;
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { jumpAt: -9, airJumpAt: -9, hurtAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

export function Hero({ run, anim }: { run: DefenseRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const aura = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(() => ({ jumpAt: -9, airJumpAt: -9, hurtAt: -9, grounded: true, yaw: 0 }), []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: 0 });
   const tint = heroById(run.heroId).color;
   const fallback = useMemo(
      () => (
         <mesh position={[0, 0.8, 0]}>
            <capsuleGeometry args={[0.3, 0.8, 6, 10]} />
            <meshStandardMaterial color={tint} roughness={0.45} />
         </mesh>
      ),
      [tint],
   );

   useFrame(() => {
      const h = run.hero;
      motion.vx = h.vx;
      motion.vz = h.vz;
      motion.vy = h.vy;
      motion.grounded = h.grounded;
      motion.rolling = false;
      motion.celebrating = time.now - anim.winAt >= 0 && time.now - anim.winAt < 2.6;
      motion.defeated = false;
      motion.power = run.dashUntil >= run.simMs ? "dash" : run.magnetUntil >= run.simMs ? "magnet" : run.phaseUntil >= run.simMs ? "phase" : null;
      if (anim.jumpAt !== memo.jumpAt) {
         memo.jumpAt = anim.jumpAt;
         motion.events.jumped = true;
      }
      if (anim.airJumpAt !== memo.airJumpAt) {
         memo.airJumpAt = anim.airJumpAt;
         motion.events.airJumped = true;
      }
      if (!memo.grounded && h.grounded) {
         motion.events.landed = true;
         motion.events.landSpeed = 5;
      }
      memo.grounded = h.grounded;
      if (anim.hurtAt !== memo.hurtAt) {
         memo.hurtAt = anim.hurtAt;
         motion.events.hurt = true;
         motion.events.hurtX = -h.faceX;
         motion.events.hurtZ = -h.faceZ;
      }
      if (Math.hypot(h.vx, h.vz) > 0.4) memo.yaw = Math.atan2(h.vx, h.vz);
      animator.body.yaw = memo.yaw;
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let y = h.y;
      let visible = true;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 10 * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      if (ring.current) {
         const mat = ring.current.material as MeshBasicMaterial;
         mat.color.set(h.zone >= 0 ? PALETTE[run.arena.zones[h.zone].color].hex : "#ffffff");
         ring.current.position.y = 0.05 - y;
      }
      if (aura.current) {
         const on = run.dashUntil >= run.simMs || run.magnetUntil >= run.simMs || run.phaseUntil >= run.simMs;
         aura.current.visible = on;
         const mat = aura.current.material as MeshStandardMaterial;
         mat.color.set(run.magnetUntil >= run.simMs ? COLORS.golden : run.phaseUntil >= run.simMs ? COLORS.phase : "#fca5a5");
         aura.current.scale.setScalar(run.magnetUntil >= run.simMs ? 4 : 1);
      }
   });

   return (
      <group ref={root}>
         <AnimatedHero animator={animator} fallback={fallback} />
         <mesh ref={ring} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.5, 0.68, 28]} />
            <meshBasicMaterial transparent opacity={0.9} toneMapped={false} depthWrite={false} />
         </mesh>
         <mesh ref={aura} position={[0, 0.9, 0]} visible={false}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial transparent opacity={0.18} emissive="#ffffff" emissiveIntensity={0.4} depthWrite={false} />
         </mesh>
      </group>
   );
}
