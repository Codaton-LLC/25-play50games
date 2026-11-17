"use client";

// Prism Shade (level 5): m2ShadowArmadillo hovering over the summit arena's centre, rising out of
// the spire as he wakes, turning to face the hero, a prism of light over his crest that takes each
// colour of his show, the shockwave ring of his attack running out to the rim, a white hit flash,
// the slow-mo tumble on his defeat. The five slot marks on the arena floor take their crystal's
// colour (grey in Blackout). Visual only: the rules own every hit.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Color } from "three";
import { Model } from "@/arcade3d/core/assets";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS } from "./assets";
import { BOSS_HOVER } from "./camera";
import { PALETTE } from "./levels";
import { PRISM } from "./progression";
import type { TowerRun } from "./rules";
import { waveRadius } from "./tower";
import { bossShowColorNow, type VisualClock } from "./TowerView";
import { COLORS } from "./look";

const PAL = PALETTE.map((p) => new Color(p.hex));
const GREY = new Color("#6b7280");

export function Boss({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const root = useRef<Group>(null);
   const prism = useRef<Mesh>(null);
   const wave = useRef<Mesh>(null);
   const marks = useRef<(Mesh | null)[]>([]);
   const tip = useRef(0);
   const c = run.course;
   const arena = c.arena;
   useFrame((_s, delta) => {
      const b = run.boss;
      if (!b || !arena) return;
      const dt = Math.min(0.1, delta) * bossTimeScale(b, PRISM);
      const ms = clock.ms;
      const g = root.current;
      const h = run.hero;
      if (g) {
         const awake = run.bossAwake;
         const rise = awake && b.step === "intro" ? stepProgress(b, PRISM) : awake ? 1 : 0;
         const e = rise * rise * (3 - 2 * rise);
         const y = arena.y - 3 + (BOSS_HOVER + 3) * e + (awake ? 0.25 * Math.sin(ms / 420) : 0);
         g.position.set(arena.x, y, arena.z);
         const dx = h.x - arena.x;
         const dz = h.z - arena.z;
         if (Math.hypot(dx, dz) > 0.5) g.rotation.y = Math.atan2(dx, dz);
         const flash = b.flashMs > 0 ? 1.08 : 1;
         const open = b.step === "vulnerable" ? 1 + 0.03 * Math.sin(ms / 120) : 1;
         g.scale.setScalar(flash * open);
         const defeat = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / PRISM.defeatMs) : 0;
         tip.current += (defeat - tip.current) * (1 - Math.exp(-3 * dt));
         g.rotation.x = -tip.current * 1.3;
         g.position.y -= tip.current * 2.5;
         g.visible = awake;
      }
      const p = prism.current;
      if (p) {
         const col = bossShowColorNow(run);
         p.visible = col >= 0;
         if (col >= 0) {
            (p.material as MeshBasicMaterial).color.copy(PAL[col]).lerp(new Color("#ffffff"), 0.3);
            const k = 1 + 0.25 * Math.sin(ms / 60);
            p.scale.setScalar(k);
         }
      }
      const w = wave.current;
      if (w) {
         const on = run.bossAwake && b.step === "attack";
         w.visible = on;
         if (on) {
            const r = Math.max(0.2, waveRadius(b.stepMs, PRISM.phases[b.phase].attacks[0].attackMs));
            w.scale.set(r, r, 1);
            (w.material as MeshBasicMaterial).opacity = 0.9 - 0.5 * stepProgress(b, PRISM);
         }
      }
      marks.current.forEach((mk, col) => {
         if (!mk) return;
         const slot = c.slots[run.bossSlot[col]];
         mk.position.set(slot.x, slot.y + 0.04, slot.z);
         const mat = mk.material as MeshBasicMaterial;
         mat.color.copy(run.bossDark && b.step !== "telegraph" ? GREY : PAL[col]);
         mat.opacity = run.bossAwake ? 0.55 + 0.2 * Math.sin(ms / 240 + col) : 0.15;
      });
   });
   if (!run.boss || !arena) return null;
   return (
      <>
         <group ref={root} visible={false}>
            <Model asset={ASSETS.boss} tint="#3b2a6b" />
            <mesh ref={prism} position={[0, 2.6, 0]} visible={false}>
               <octahedronGeometry args={[0.7, 0]} />
               <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <pointLight position={[0, 1.5, 0]} intensity={1.6} distance={16} color={COLORS.glow} />
         </group>
         <mesh ref={wave} position={[arena.x, arena.y + 0.1, arena.z]} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.86, 1, 64]} />
            <meshBasicMaterial color={COLORS.wave} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
         </mesh>
         {c.slots.map((_s, col) => (
            <mesh
               key={col}
               ref={(m) => {
                  marks.current[col] = m;
               }}
               rotation-x={-Math.PI / 2}
            >
               <ringGeometry args={[1.1, 1.3, 32]} />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}
