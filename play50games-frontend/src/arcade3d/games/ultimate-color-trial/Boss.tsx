"use client";

// The Chroma Sentinel (level 5): m2ChromaSentinelBoss hovering over the arena's far end, rising out
// of the floor as his beacon wakes him, turning to face the hero, a prism over his crest in the colour
// his beacon asks (Gates), a sweep ring across the arena through his attack, a white hit flash, the
// slow-mo tumble on his defeat. Visual only: the rules own every hit.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Color } from "three";
import { Model } from "@/arcade3d/core/assets";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS } from "./assets";
import { BOSS_HOVER } from "./camera";
import { HALF_W, PALETTE } from "./levels";
import { SENTINEL } from "./progression";
import type { TrialRun } from "./rules";
import type { VisualClock } from "./TrialView";
import { COLORS } from "./look";

const PAL = PALETTE.map((p) => new Color(p.hex));

export function Boss({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const root = useRef<Group>(null);
   const prism = useRef<Mesh>(null);
   const sweep = useRef<Mesh>(null);
   const tip = useRef(0);
   const bs = run.course.bossSpec;
   useFrame((_s, delta) => {
      const b = run.boss;
      if (!b || !bs) return;
      const dt = Math.min(0.1, delta) * bossTimeScale(b, SENTINEL);
      const ms = clock.ms;
      const g = root.current;
      const h = run.hero;
      if (g) {
         const awake = run.bossAwake;
         const rise = awake && b.step === "intro" ? stepProgress(b, SENTINEL) : awake ? 1 : 0;
         const e = rise * rise * (3 - 2 * rise);
         const y = -4 + (BOSS_HOVER + 4) * e + (awake ? 0.25 * Math.sin(ms / 420) : 0);
         g.position.set(bs.x, y, bs.z);
         const dx = h.x - bs.x;
         const dz = h.z - bs.z;
         if (Math.hypot(dx, dz) > 0.5) g.rotation.y = Math.atan2(dx, dz);
         const flash = b.flashMs > 0 ? 1.08 : 1;
         const open = b.step === "vulnerable" ? 1 + 0.03 * Math.sin(ms / 120) : 1;
         g.scale.setScalar(flash * open);
         const defeat = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / SENTINEL.defeatMs) : 0;
         tip.current += (defeat - tip.current) * (1 - Math.exp(-3 * dt));
         g.rotation.x = -tip.current * 1.3;
         g.position.y -= tip.current * 3;
         g.visible = awake || b.step === "intro";
      }
      const p = prism.current;
      if (p) {
         const col = run.bossAwake && b.phase === 0 && b.step !== "transition" && b.hp > 0 ? run.bossColor : -1;
         p.visible = col >= 0;
         if (col >= 0) {
            (p.material as MeshBasicMaterial).color.copy(PAL[col]).lerp(new Color("#ffffff"), 0.3);
            p.scale.setScalar(1 + 0.2 * Math.sin(ms / 70));
         }
      }
      const s = sweep.current;
      if (s) {
         const on = run.bossAwake && b.step === "attack";
         s.visible = on;
         if (on) (s.material as MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(ms / 60);
      }
   });
   if (!run.boss || !bs) return null;
   return (
      <>
         <group ref={root} visible={false}>
            <Model asset={ASSETS.boss} tint="#5b4b8a" />
            <mesh ref={prism} position={[0, 5.2, 0]} visible={false}>
               <octahedronGeometry args={[0.8, 0]} />
               <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <pointLight position={[0, 2.5, -1]} intensity={1.8} distance={18} color={COLORS.glow} />
         </group>
         {/* the sweep: the arena floor lit through his attack */}
         <mesh ref={sweep} position={[0, 0.06, (run.course.sections[run.course.sections.length - 1].z0 + bs.z) / 2]} rotation-x={-Math.PI / 2} visible={false}>
            <planeGeometry args={[2 * HALF_W - 0.5, bs.z - run.course.sections[run.course.sections.length - 1].z0]} />
            <meshBasicMaterial color={COLORS.orb} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
