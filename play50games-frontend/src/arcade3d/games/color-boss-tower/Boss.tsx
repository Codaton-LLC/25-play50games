"use client";

// The guardian in the shaft. Levels 1-4: the Stone Guardian (m2StoneGuardianBoss); level 5: the Grand
// Color Guardian (m2ColorGuardianBoss). He rides the shaft on his arena disc (m2BossArenaDisc) at the
// hero's height, always turned to face the hero. His sweep: a glowing dust line round the ring at the
// band's height while he winds up (telegraph), then his stone arm swings once round the tower (the
// rules' arm angle, so what you see is what hits). His weak plate opens on his chest (white, or the
// lit colour on level 5's first phase); a hit flashes him. Level 5's Grey Heart: the prism heart in
// his chest (m2PrismHeart) and the five glyphs round it, lit one by one. The defeat: he sags into the shaft.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TAG_COLOUR, TAG_ORDER } from "@/arcade3d/menu2/heroTag/rules";
import { ASSETS, GRAND_H, STONE_H } from "./assets";
import { R_PATH, R_WALL } from "./levels";
import { GLYPH_MS } from "./progression";
import { SWEEP_BAND, isGrand, litColour, type CbtRun } from "./rules";
import { COLORS, TAG_HEX } from "./look";

/** Where the guardian stands in the shaft this frame (eased by the caller): his feet's height. */
export function bossFeetY(run: CbtRun): number {
   return Math.max(0, Math.min(run.tower.topY - 2, run.hero.y - 3.2));
}

/** His chest (the weak plate; where the cannon beams land). */
export function bossChest(run: CbtRun, feet: number, out: { x: number; y: number; z: number }) {
   const th = run.hero.a / R_PATH;
   const h = isGrand(run) ? GRAND_H : STONE_H;
   out.x = Math.sin(th) * 1.4;
   out.y = feet + h * 0.62;
   out.z = Math.cos(th) * 1.4;
   return out;
}

export interface BossView {
   feet: number;
}

export function Boss({ run, view }: { run: CbtRun; view: BossView }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const plate = useRef<Mesh>(null);
   const band = useRef<Mesh>(null);
   const arm = useRef<Group>(null);
   const heart = useRef<Group>(null);
   const glyphs = useRef<(Mesh | null)[]>([]);
   const flash = useRef<Mesh>(null);
   const grand = isGrand(run);
   const height = grand ? GRAND_H : STONE_H;
   const last = useRef(time.now);

   useFrame(() => {
      const dt = Math.min(0.1, Math.max(0, time.now - last.current));
      last.current = time.now;
      const b = run.boss;
      const g = body.current;
      if (!g) return;
      // ride the shaft at the hero's height; sag on the defeat
      const want = b.defeatMs >= 0 ? -height * 0.55 : bossFeetY(run);
      view.feet += (want - view.feet) * (1 - Math.exp(-(b.defeatMs >= 0 ? 0.8 : 2.2) * dt));
      const th = run.hero.a / R_PATH;
      g.position.set(0, view.feet, 0);
      g.rotation.y = th;
      g.rotation.z = b.defeatMs >= 0 ? Math.min(0.5, b.defeatMs / 4000) : Math.sin(time.now * 0.8) * 0.02;
      const pop = b.flashMs > 0 ? 1.05 : 1;
      g.scale.setScalar(pop);

      const p = plate.current;
      if (p) {
         const open = b.step === "vulnerable" && !(grand && b.phase === 2);
         p.visible = open;
         const lit = litColour(run);
         (p.material as MeshBasicMaterial).color.set(lit ? TAG_HEX[lit] : "#fef9c3");
         p.scale.setScalar(1 + Math.sin(time.now * 9) * 0.08);
      }
      const f = flash.current;
      if (f) {
         f.visible = b.flashMs > 0;
         f.scale.setScalar(1 + (160 - b.flashMs) / 60);
      }
      // the sweep: the dust line while he winds up, then the arm round the ring
      const atk = run.tower.bossCfg.phases[Math.min(b.phase, run.tower.bossCfg.phases.length - 1)].attacks[0];
      const sweeping = !(grand && b.phase === 2);
      const bd = band.current;
      if (bd) {
         bd.visible = sweeping && b.step === "telegraph" && b.stepMs > atk.telegraphMs * 0.35;
         bd.position.y = run.sweepY + 0.5;
         const k = Math.min(1, b.stepMs / atk.telegraphMs);
         (bd.material as MeshBasicMaterial).opacity = 0.15 + 0.55 * k * (0.75 + 0.25 * Math.sin(time.now * 14));
      }
      const a = arm.current;
      if (a) {
         a.visible = sweeping && b.step === "attack";
         a.position.y = run.sweepY + 0.5;
         a.rotation.y = run.sweepA0 + Math.PI + (2 * Math.PI * b.stepMs) / atk.attackMs;
      }
      // level 5's Grey Heart
      const hg = heart.current;
      if (hg) {
         hg.visible = grand && b.phase === 2 && b.defeatMs < 0;
         hg.rotation.y = time.now * 0.8;
         const k = b.step === "vulnerable" ? Math.floor(b.stepMs / GLYPH_MS) : -1;
         glyphs.current.forEach((m, i) => {
            if (!m) return;
            const done = run.glyphs[i] === 1;
            const litNow = i === k;
            const mat = m.material as MeshBasicMaterial;
            mat.color.set(done || litNow ? TAG_HEX[TAG_COLOUR[TAG_ORDER[i]]] : "#4b5563");
            m.scale.setScalar(litNow ? 1.6 + Math.sin(time.now * 16) * 0.15 : done ? 1.1 : 0.8);
         });
      }
   }, FRAME_PRIORITY.visuals);

   const reach = R_WALL - 1.6;
   return (
      <>
         <group ref={body}>
            <group position={[0, -0.35, 0]}>
               <Model asset={ASSETS.disc} />
            </group>
            <Model asset={grand ? ASSETS.grand : ASSETS.stone} />
            {/* the weak plate on his chest, toward the hero */}
            <mesh ref={plate} position={[0, height * 0.62, grand ? 0.9 : 0.75]}>
               <circleGeometry args={[0.7, 28]} />
               <meshBasicMaterial color="#fef9c3" toneMapped={false} transparent opacity={0.9} />
            </mesh>
            <mesh ref={flash} position={[0, height * 0.62, 0.8]}>
               <sphereGeometry args={[0.8, 16, 12]} />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
            </mesh>
            {grand ? (
               <group ref={heart} position={[0, height * 0.6, 0.6]}>
                  <Model asset={ASSETS.heart} />
                  {TAG_ORDER.map((id, i) => {
                     const ang = (i / 5) * Math.PI * 2;
                     return (
                        <mesh
                           key={id}
                           ref={(m) => {
                              glyphs.current[i] = m;
                           }}
                           position={[Math.sin(ang) * 1.5, 0.9 + Math.cos(ang) * 1.5, 0.3]}
                        >
                           <octahedronGeometry args={[0.24, 0]} />
                           <meshBasicMaterial color="#4b5563" toneMapped={false} />
                        </mesh>
                     );
                  })}
               </group>
            ) : null}
         </group>
         {/* the dust line round the ring: where the arm will sweep */}
         <mesh ref={band} rotation-x={Math.PI / 2}>
            <torusGeometry args={[R_PATH, SWEEP_BAND * 0.32, 8, 96]} />
            <meshBasicMaterial color={COLORS.arm} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={arm}>
            <mesh position={[0, 0, (reach + 1.6) / 2]}>
               <boxGeometry args={[1.1, SWEEP_BAND * 0.9, reach]} />
               <meshStandardMaterial color="#57534e" emissive={COLORS.arm} emissiveIntensity={0.6} roughness={0.8} />
            </mesh>
         </group>
      </>
   );
}
