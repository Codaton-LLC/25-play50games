"use client";

// The hero as the pinball (menu2/heroAnim, always curled in ball form): drawn in table coordinates
// inside the tilted table group, rolling with its speed. Golden after a ramp shot (level 5's armour
// breaker), a shield bubble (Kiro), a phase shimmer (Vexa), a pulse while Zuno sticks to a pad, a dash
// streak (Riko). A soft shadow under it on the field or the deck. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { COLORS } from "./look";
import { DECK } from "./table";
import { V_MAX, type PinRun } from "./rules";

export interface BallAnim {
   intro: number;
   winAt: number;
}

export function createBallAnim(): BallAnim {
   return { intro: Number.NaN, winAt: Number.POSITIVE_INFINITY };
}

export function Ball({ run, anim }: { run: PinRun; anim: BallAnim }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const aura = useRef<Mesh>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_MAX, jumpSpeed: 6, yaw: 0 });
   const color = heroById(run.heroId).color;
   const st = useMemo(() => ({ yaw: 0 }), []);
   const fallback = useMemo(
      () => (
         <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.5, 20, 14]} />
            <meshStandardMaterial color={color} roughness={0.35} />
         </mesh>
      ),
      [color],
   );

   useFrame(() => {
      const b = run.ball;
      motion.vx = b.mode === "ramp" ? b.rampV * 0.7 : b.vx;
      motion.vz = b.mode === "ramp" ? 0 : b.vz;
      motion.vy = b.vh;
      motion.grounded = b.h <= 0.01;
      motion.rolling = true;
      motion.celebrating = time.now - anim.winAt >= 0 && time.now - anim.winAt < 2.6;
      motion.defeated = false;
      motion.power = run.dashUntil >= run.simMs ? "dash" : run.shieldUntil >= run.simMs ? "shield" : b.mode === "held" ? "magnet" : run.phaseUntil >= run.simMs ? "phase" : null;
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0.5) st.yaw = Math.atan2(b.vx, b.vz);
      animator.body.yaw = st.yaw;
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const b = run.ball;
      let visible = b.mode !== "lost";
      let y = b.h;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 10 * (1 - k) * (1 - k);
      }
      g.visible = visible;
      g.position.set(b.x, y, b.z);
      const a = aura.current;
      if (a) {
         const golden = run.goldenUntil >= run.simMs;
         const shield = run.shieldUntil >= run.simMs;
         const phase = run.phaseUntil >= run.simMs;
         const held = b.mode === "held";
         a.visible = visible && (golden || shield || phase || held);
         const mat = a.material as MeshStandardMaterial;
         mat.color.set(golden ? COLORS.golden : shield ? "#86efac" : phase ? COLORS.ghost : "#fde047");
         mat.emissive.copy(mat.color);
         const s = 1 + 0.08 * Math.sin(time.now * 9);
         a.scale.setScalar(s);
         mat.opacity = golden ? 0.45 : 0.3;
      }
      const sh = shadow.current;
      if (sh) {
         const floor = b.layer === 1 ? DECK.h : 0;
         const above = Math.max(0, y - floor);
         sh.visible = visible && above < 6;
         sh.position.set(b.x, floor + 0.03, b.z);
         const k = Math.max(0.35, 1 - above / 4);
         sh.scale.setScalar(k);
         (sh.material as MeshBasicMaterial).opacity = 0.35 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <AnimatedHero animator={animator} fallback={fallback} />
            <mesh ref={aura} position={[0, 0.5, 0]} visible={false}>
               <sphereGeometry args={[0.72, 20, 14]} />
               <meshStandardMaterial transparent opacity={0.3} emissiveIntensity={0.8} depthWrite={false} />
            </mesh>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.55, 18]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.35} depthWrite={false} />
         </mesh>
      </>
   );
}
