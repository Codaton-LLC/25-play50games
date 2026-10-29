"use client";

// A hero in the lab: the picked hero's GLB on the shared menu2 animator, fed by the rules' velocity
// (walk / run, jumps, falls, the hurt recoil, the cheer at the last door), plus the sign halo over its
// head: a ring for +, a bar for - (shape first, the pole tone second), a field ring that ripples out on
// each flip, a pull stretch while a pad's field carries it, and the power looks (Kiro's shield bubble,
// Zuno's wide overcharge ring, Vexa's see-through phase).
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useGameTime } from "../../core/gameTime";
import { PAD, type Hero as RunHero, type World } from "./rules";
import { POLE } from "./look";
import { roomX } from "./space";

export function Hero({ world, hero, intro }: { world: World; hero: RunHero; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const halo = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const bar = useRef<Mesh>(null);
   const ripple = useRef<Mesh>(null);
   const field = useRef<Mesh>(null);
   const shield = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(hero.heroId, motion, { topSpeed: 8, yaw: Math.PI / 2 });
   const time = useGameTime();
   const st = useRef({ ripple: 1, stretch: 0, signSeen: hero.sign as number });
   useFrame(() => {
      const h = hero;
      motion.vx = h.latched >= 0 ? 0 : h.vx;
      motion.vz = 0;
      motion.vy = h.vy;
      motion.grounded = h.grounded || h.latched >= 0;
      motion.rolling = h.dashMs > 0;
      motion.celebrating = h.ended === "win";
      motion.defeated = h.ended === "timeup";
      motion.power = h.powerMs > 0 || h.dashMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[h.heroId] : null;
      const e = h.ev;
      if (e.jump || e.launch) motion.events.jumped = true;
      if (e.land) {
         motion.events.landed = true;
         motion.events.landSpeed = e.landSpeed;
      }
      if (e.hit) {
         motion.events.hurt = true;
         motion.events.hurtX = -h.facing;
         motion.events.hurtZ = 0;
      }
   }, FRAME_PRIORITY.pose - 0.01);
   useFrame((_, delta) => {
      const g = root.current;
      if (!g) return;
      const h = hero;
      const s = st.current;
      g.position.set(roomX(h.room) + h.x, h.y, 0);
      if (intro) g.position.y += (1 - intro.current) * 9;
      // the pad's field stretches the body along the pull
      const want = h.pulled || h.latched >= 0 ? 1 : 0;
      s.stretch += (want - s.stretch) * Math.min(1, delta * 10);
      if (body.current) body.current.scale.set(1 - s.stretch * 0.08, 1 + s.stretch * 0.12, 1 - s.stretch * 0.08);
      // the halo: ring (+) or bar (-), spinning slowly, bobbing over the head
      if (h.sign !== s.signSeen) {
         s.signSeen = h.sign;
         s.ripple = 0;
      }
      const plus = h.sign > 0;
      if (ring.current) ring.current.visible = plus;
      if (bar.current) bar.current.visible = !plus;
      if (halo.current) {
         halo.current.position.y = 1.85 + Math.sin(time.now * 3) * 0.05;
         halo.current.rotation.y = time.now * 1.6;
      }
      // the flip ripple: a field ring rushing out from the body
      s.ripple = Math.min(1, s.ripple + delta * 2.6);
      if (ripple.current) {
         ripple.current.visible = s.ripple < 1;
         const k = 0.4 + s.ripple * 3.2;
         ripple.current.scale.set(k, k, k);
         const m = ripple.current.material as MeshBasicMaterial;
         m.opacity = (1 - s.ripple) * 0.75;
         m.color.set(plus ? POLE.plusGlow : POLE.minusGlow);
      }
      // Zuno's overcharge: the field reach drawn as a wide ring
      if (field.current) {
         const over = h.heroId === "zuno" && h.powerMs > 0;
         field.current.visible = over;
         if (over) {
            const r = PAD.range * 2 * (0.97 + Math.sin(time.now * 9) * 0.03);
            field.current.scale.set(r, r, 1);
            field.current.rotation.z = time.now;
         }
      }
      if (shield.current) {
         const on = h.heroId === "kiro" && h.powerMs > 0;
         shield.current.visible = on;
         if (on) shield.current.scale.setScalar(1 + Math.sin(time.now * 12) * 0.03);
      }
      // grace after a hit, Vexa's phase: the body blinks / turns see-through
      const blink = h.graceMs > 0 && Math.floor(h.graceMs / 90) % 2 === 0;
      if (body.current) body.current.visible = !blink;
      void world;
   });
   return (
      <group ref={root}>
         <group ref={body}>
            <AnimatedHero animator={animator} />
         </group>
         <group ref={halo}>
            <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
               <torusGeometry args={[0.24, 0.06, 10, 28]} />
               <meshStandardMaterial color={POLE.plus} emissive={POLE.plus} emissiveIntensity={1.4} roughness={0.35} />
            </mesh>
            <mesh ref={bar} visible={false}>
               <boxGeometry args={[0.56, 0.11, 0.11]} />
               <meshStandardMaterial color={POLE.minus} emissive={POLE.minus} emissiveIntensity={1.4} roughness={0.35} />
            </mesh>
         </group>
         <mesh ref={ripple} position={[0, 0.7, 0]} visible={false}>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
         </mesh>
         <mesh ref={field} position={[0, 0.7, -0.05]} visible={false}>
            <ringGeometry args={[0.97, 1, 64]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.45} depthWrite={false} blending={AdditiveBlending} />
         </mesh>
         <mesh ref={shield} position={[0, 0.7, 0]} visible={false}>
            <sphereGeometry args={[0.95, 24, 16]} />
            <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.6} transparent opacity={0.28} depthWrite={false} />
         </mesh>
      </group>
   );
}


