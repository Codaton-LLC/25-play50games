"use client";

// Scrap Magnus (L5): a golem of six scrap-metal blocks (m2MetalBlockV2) under a horseshoe-magnet head
// (m2HorseshoeMagnet), with a glowing core in his chest in his current sign's tone. Reads rules.ts only:
// the pulse of his sign (P1), the slam (a stomp), the block he hurls (P2, drawn here), the core rising
// out of his chest (P3), an armour block flying off per hit, the hit flash, the slow-motion defeat.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { Model } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { ASSETS, SIZE } from "./assets";
import { MAGNUS } from "./progression";
import type { World } from "./rules";
import { poleColor } from "./look";
import { roomX } from "./space";

const B = SIZE.magnusBlock;
/** the body: two columns of three blocks (index 0 at the bottom left) */
const SLOTS: [number, number][] = [
   [-B / 2, 0],
   [B / 2, 0],
   [-B / 2, B],
   [B / 2, B],
   [-B / 2, B * 2],
   [B / 2, B * 2],
];

export function Magnus({ world }: { world: World }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const blocks = useRef<(Group | null)[]>([]);
   const core = useRef<Mesh>(null);
   const glow = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const thrown = useRef<Group>(null);
   const time = useGameTime();
   const st = useRef({ fly: [0, 0, 0, 0, 0, 0], defeat: 0 });
   const arena = world.rooms.findIndex((r) => r.def.boss);
   useFrame((_, delta) => {
      const m = world.magnus;
      const g = root.current;
      if (!m || !g || !body.current || arena < 0) return;
      const s = m.state;
      g.visible = m.active || s.step === "intro";
      g.position.set(roomX(arena) + m.x, m.y, -0.2);
      const t = time.now;
      // telegraph: he winds up (leans back, trembles); attack: the slam stomps down
      const lean = s.step === "telegraph" ? -0.12 + Math.sin(t * 30) * 0.02 : s.step === "attack" && s.phase === 0 ? 0.18 : 0;
      body.current.rotation.z = lean * 0.4;
      body.current.rotation.x = lean;
      body.current.position.y = s.step === "attack" && s.phase === 0 ? -Math.abs(Math.sin(t * 20)) * 0.12 : Math.sin(t * 2) * 0.04;
      const flash = s.flashMs > 0;
      body.current.scale.setScalar(flash ? 1.06 : 1);
      // armour: one block flies off per hit (the top ones first), the rest hold the shape
      const lost = Math.max(0, MAGNUS.maxHp - s.hp - 1);
      const sts = st.current;
      SLOTS.forEach(([x, y], i) => {
         const b = blocks.current[i];
         if (!b) return;
         const gone = 5 - i < lost;
         sts.fly[i] = gone ? Math.min(1.5, sts.fly[i] + delta) : 0;
         const f = sts.fly[i];
         b.visible = f < 1.4;
         b.position.set(x + (x > 0 ? 1 : -1) * f * 5, y + f * 4 - f * f * 6, f * 2);
         b.rotation.set(f * 5, f * 3, 0);
      });
      // the core: his sign's tone, pulsing; P3 lifts it out of his chest
      const c = core.current;
      if (c) {
         const open = s.step === "vulnerable";
         c.position.set(0, 2.4 + m.coreLift, 0.75);
         c.scale.setScalar((open ? 1.25 : 0.9) + Math.sin(t * (open ? 14 : 5)) * 0.08);
         const mat = c.material as MeshStandardMaterial;
         mat.color.set(poleColor(m.sign));
         mat.emissive.set(poleColor(m.sign));
         mat.emissiveIntensity = open ? 2.6 : 1.1;
      }
      if (glow.current) {
         glow.current.position.set(0, 2.4 + m.coreLift, 0.7);
         const mat = glow.current.material as MeshBasicMaterial;
         mat.color.set(poleColor(m.sign));
         mat.opacity = s.step === "vulnerable" ? 0.55 : 0.22;
      }
      if (ring.current) {
         ring.current.visible = s.step === "vulnerable";
         ring.current.position.set(0, 2.4 + m.coreLift, 0.8);
         ring.current.rotation.z = t * 3;
      }
      // the hurled block (P2)
      const p = m.block;
      if (thrown.current) {
         thrown.current.visible = p.alive;
         if (p.alive) {
            thrown.current.position.set(roomX(arena) + p.x - (roomX(arena) + m.x), p.y - m.y - 0.5, 0.4);
            thrown.current.rotation.set(t * 4, t * 3, 0);
         }
      }
      // defeat: he sags and sinks
      if (s.step === "defeat" || s.step === "done") sts.defeat = Math.min(1, sts.defeat + delta * 0.6);
      g.position.y -= sts.defeat * 3.5;
      g.rotation.z = sts.defeat * 0.5;
      g.visible = g.visible && sts.defeat < 1;
   });
   if (arena < 0) return null;
   return (
      <group ref={root} visible={false}>
         <group ref={body}>
            {SLOTS.map((_, i) => (
               <group key={i} ref={(el) => {
                  blocks.current[i] = el;
               }}>
                  <Model asset={ASSETS.magnusBlock} />
               </group>
            ))}
            <group position={[0, B * 3, 0]}>
               <Model asset={ASSETS.magnusHead} />
            </group>
            {/* the eyes on the head, glowing amber */}
            <mesh position={[-0.35, B * 3 + 0.55, 0.9]}>
               <sphereGeometry args={[0.13, 12, 8]} />
               <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <mesh position={[0.35, B * 3 + 0.55, 0.9]}>
               <sphereGeometry args={[0.13, 12, 8]} />
               <meshBasicMaterial color="#fbbf24" />
            </mesh>
         </group>
         <mesh ref={core}>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} roughness={0.25} />
         </mesh>
         <mesh ref={glow}>
            <circleGeometry args={[1.1, 32]} />
            <meshBasicMaterial transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} />
         </mesh>
         <mesh ref={ring} visible={false}>
            <ringGeometry args={[0.85, 1.0, 6]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.9} depthWrite={false} />
         </mesh>
         <group ref={thrown} visible={false}>
            <Model asset={ASSETS.block} />
         </group>
      </group>
   );
}
