"use client";

// The pair's two bodies: the picked hero's GLB on the shared menu2 animator (left runway), and its
// reflection (right runway): the same hero drawn as violet glass (its materials swapped for one
// see-through, faintly glowing copy, mirrored left-right). Each runs, jumps, slides (a low crouch),
// flickers through grace after a crack, and shows the power looks: Kiro's shield bubble round both,
// Vexa's phase (both turn to faint glass), Riko's dash streak.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, MeshStandardMaterial, type Group, type Material, type Mesh, type Object3D } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useGameTime } from "../../core/gameTime";
import { bodyX, type Pair } from "./rules";

function Body({ pair, k, ox, intro }: { pair: Pair; k: 0 | 1; ox: number; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shield = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(pair.heroId, motion, { topSpeed: 12, yaw: Math.PI });
   const time = useGameTime();
   const glass = useMemo(
      () => new MeshStandardMaterial({ color: new Color("#ddd6fe"), emissive: new Color("#7c3aed"), emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.55, depthWrite: false, side: DoubleSide }),
      []
   );
   const swapped = useRef(new WeakSet<Object3D>());
   const phaseLook = useRef(false);
   useFrame(() => {
      const b = pair.bodies[k];
      motion.vx = 0;
      motion.vz = -pair.speed;
      motion.vy = b.vy;
      motion.grounded = b.y <= 0.001;
      motion.rolling = b.slideMs > 0 || pair.dashMs > 0;
      motion.celebrating = pair.ended === "win";
      motion.defeated = pair.ended === "timeup";
      motion.power = pair.powerMs > 0 || pair.dashMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[pair.heroId] : null;
      const e = pair.ev;
      if (e.jump) motion.events.jumped = true;
      if (e.land) {
         motion.events.landed = true;
         motion.events.landSpeed = 8;
      }
      if (e.crack && e.crackBody === k) {
         motion.events.hurt = true;
         motion.events.hurtX = k === 0 ? -1 : 1;
         motion.events.hurtZ = 0;
      }
   }, FRAME_PRIORITY.pose - 0.01);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const b = pair.bodies[k];
      g.position.set(ox + bodyX(pair, k), b.y, -pair.s);
      if (intro) g.position.y += (1 - intro.current) * 7;
      if (body.current) {
         body.current.visible = !(pair.graceMs > 0 && Math.floor(pair.graceMs / 90) % 2 === 0) && pair.freezeMs === 0;
         // the reflection: swap every mesh's material for the glass (once per mesh, the model loads late)
         const phase = pair.heroId === "vexa" && pair.powerMs > 0;
         if (k === 1 || phase || phaseLook.current) {
            body.current.traverse((o) => {
               const m = o as Mesh;
               if (!m.isMesh) return;
               if (!swapped.current.has(m)) {
                  swapped.current.add(m);
                  m.userData.ownMaterial = m.material;
               }
               m.material = k === 1 || phase ? glass : (m.userData.ownMaterial as Material);
            });
            phaseLook.current = phase;
         }
         glass.opacity = phase ? 0.28 : 0.55;
         // the reflection is the mirror image: flipped left-right
         body.current.scale.set(k === 1 ? -1 : 1, 1, 1);
      }
      if (shield.current) {
         const on = pair.heroId === "kiro" && pair.powerMs > 0;
         shield.current.visible = on;
         if (on) shield.current.scale.setScalar(1 + Math.sin(time.now * 12) * 0.03);
      }
   });
   return (
      <group ref={root}>
         <group ref={body}>
            <AnimatedHero animator={animator} />
         </group>
         <mesh ref={shield} position={[0, 0.7, 0]} visible={false}>
            <sphereGeometry args={[0.95, 24, 16]} />
            <meshStandardMaterial color="#4ade80" emissive="#22c55e" emissiveIntensity={0.6} transparent opacity={0.28} depthWrite={false} />
         </mesh>
      </group>
   );
}

export function Bodies({ pair, ox, intro }: { pair: Pair; ox: number; intro?: MutableRefObject<number> }) {
   return (
      <>
         <Body pair={pair} k={0} ox={ox} intro={intro} />
         <Body pair={pair} k={1} ox={ox} intro={intro} />
      </>
   );
}
