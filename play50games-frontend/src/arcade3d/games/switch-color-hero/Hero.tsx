"use client";

// The picked hero running on menu2/heroAnim (run, jump, Nami's second jump, the slide as the curled ball,
// a stagger after a bounce, cheer at the finish), wrapped in a shell of its current colour: a glowing
// ring at the feet and a translucent aura that flashes on every switch, with the colour's shape floating
// over its head. Kiro's shield, Vexa's phase and Riko's dash show as their own auras. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { COLORS } from "./look";
import { PALETTE } from "./track";
import { V_JUMP, type SwitchRun } from "./rules";

export interface HeroAnim {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   hurtAt: number;
   switchAt: number;
   winAt: number;
   spawnAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, switchAt: -9, winAt: Number.POSITIVE_INFINITY, spawnAt: -9, intro: Number.NaN };
}

const SIDES = [28, 3, 4, 4, 6];
const ROT = [0, Math.PI / 2, Math.PI / 4, 0, 0];

export function Hero({ run, anim }: { run: SwitchRun; anim: HeroAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const aura = useRef<Mesh>(null);
   const power = useRef<Mesh>(null);
   const badge = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(() => ({ jumpAt: -9, airJumpAt: -9, landAt: -9, hurtAt: -9, mode: "run" as string }), []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: run.speed + 6, jumpSpeed: V_JUMP, yaw: Math.PI });
   const geos = useMemo(() => SIDES.map((s, i) => new CircleGeometry(0.22, s, ROT[i])), []);
   const shapeRefs = useRef<(Mesh | null)[]>([]);
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
      const stunned = h.stunUntil >= run.simMs;
      const v = stunned || h.mode === "spawn" || h.mode === "fall" ? 0 : run.speed;
      motion.vx = 0;
      motion.vz = -v;
      motion.vy = h.vy;
      motion.grounded = h.mode === "run";
      motion.rolling = h.slideUntil >= run.simMs && h.mode === "run";
      motion.celebrating = time.now - anim.winAt >= 0 && time.now - anim.winAt < 2.6;
      motion.defeated = false;
      motion.power = run.dashUntil >= run.simMs ? "dash" : run.shieldUntil >= run.simMs ? "shield" : run.magnetUntil >= run.simMs ? "magnet" : run.phaseUntil >= run.simMs ? "phase" : null;
      if (anim.jumpAt !== memo.jumpAt) {
         memo.jumpAt = anim.jumpAt;
         motion.events.jumped = true;
      }
      if (anim.airJumpAt !== memo.airJumpAt) {
         memo.airJumpAt = anim.airJumpAt;
         motion.events.airJumped = true;
      }
      if (memo.mode === "air" && h.mode === "run") {
         motion.events.landed = true;
         motion.events.landSpeed = 6;
      }
      memo.mode = h.mode;
      if (anim.hurtAt !== memo.hurtAt) {
         memo.hurtAt = anim.hurtAt;
         motion.events.hurt = true;
         motion.events.hurtX = 0;
         motion.events.hurtZ = 1;
      }
      animator.body.yaw = Math.PI;
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      let y = h.y;
      let visible = h.mode !== "fall" || h.y > -3;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 10 * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(h.x, y, h.z);
      const c = PALETTE[h.color].hex;
      const flash = Math.max(0, 1 - (time.now - anim.switchAt) * 4);
      if (ring.current) {
         const mat = ring.current.material as MeshBasicMaterial;
         mat.color.set(c);
         ring.current.position.y = 0.04 - y + Math.max(0, h.y > 0 ? 0 : 0);
         ring.current.visible = h.mode !== "fall";
         ring.current.scale.setScalar(1 + flash * 0.6);
      }
      if (aura.current) {
         const mat = aura.current.material as MeshStandardMaterial;
         mat.color.set(c);
         mat.emissive.set(c);
         mat.opacity = 0.16 + flash * 0.4;
         aura.current.scale.setScalar(1 + flash * 0.25);
      }
      if (badge.current) {
         badge.current.position.y = 2.25 + Math.sin(time.now * 4) * 0.05;
         for (let i = 0; i < shapeRefs.current.length; i++) {
            const m = shapeRefs.current[i];
            if (!m) continue;
            m.visible = i === h.color;
            (m.material as MeshBasicMaterial).color.set(c);
         }
      }
      if (power.current) {
         const sh = run.shieldUntil >= run.simMs;
         const ph = run.phaseUntil >= run.simMs;
         const da = run.dashUntil >= run.simMs;
         power.current.visible = sh || ph || da;
         (power.current.material as MeshStandardMaterial).color.set(sh ? COLORS.shield : ph ? COLORS.phase : "#fca5a5");
      }
   });

   return (
      <group ref={root}>
         <AnimatedHero animator={animator} fallback={fallback} />
         <mesh ref={ring} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.55, 0.78, 32]} />
            <meshBasicMaterial transparent opacity={0.9} toneMapped={false} depthWrite={false} />
         </mesh>
         <mesh ref={aura} position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.85, 20, 14]} />
            <meshStandardMaterial transparent opacity={0.2} emissiveIntensity={0.8} depthWrite={false} />
         </mesh>
         <mesh ref={power} position={[0, 0.9, 0]} visible={false}>
            <sphereGeometry args={[1.05, 20, 14]} />
            <meshStandardMaterial transparent opacity={0.25} emissive="#ffffff" emissiveIntensity={0.4} depthWrite={false} />
         </mesh>
         <group ref={badge}>
            {geos.map((g, i) => (
               <mesh key={i} ref={(m) => { shapeRefs.current[i] = m; }} geometry={g}>
                  <meshBasicMaterial toneMapped={false} />
               </mesh>
            ))}
         </group>
      </group>
   );
}
