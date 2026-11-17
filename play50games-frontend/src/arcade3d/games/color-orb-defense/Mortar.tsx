"use client";

// The Orb Mortar (level 5): the new m2OrbMortarBoss GLB squatting on the north rim beyond the portals,
// facing the beacon. He rises out of the clouds when the waves end, rears back in his telegraph, recoils
// as he lobs his core orbs, glows while they are in the air (his window), flashes white on a hit and sinks
// when he is beaten. His ammo, a pile of orb blobs, sits at his feet. Visual only.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS } from "./look";
import { R_PORTAL } from "./arena";
import type { DefenseRun } from "./rules";

const HEIGHT = 6.5;
const AMMO: [number, number, number][] = [[-3.2, 0.8, 1.4], [3.0, 0.6, 1.2], [-2.3, -1.6, 1.0]];
const Z = -(R_PORTAL + 2.2);

export default function Mortar({ run }: { run: DefenseRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const glow = useRef<Mesh>(null);
   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g || !b) return;
      const started = run.simMs >= run.arena.wavesEndMs;
      const rise = started ? Math.min(1, (run.simMs - run.arena.wavesEndMs) / 1500) : 0;
      const sink = b.step === "done" ? 1 : b.defeatMs >= 0 ? Math.min(1, b.defeatMs / 2000) : 0;
      g.visible = rise > 0 && sink < 1;
      const lean = b.step === "telegraph" ? -0.25 : b.step === "attack" ? 0.18 : 0;
      g.position.set(0, -8 + 8 * rise - 8 * sink + Math.sin(time.now * 2) * 0.15, Z);
      g.rotation.x = lean;
      const gm = glow.current;
      if (gm) {
         gm.visible = g.visible && (b.step === "vulnerable" || b.flashMs > 0);
         const mat = gm.material as MeshBasicMaterial;
         mat.color.set(b.flashMs > 0 ? "#ffffff" : COLORS.golden);
         mat.opacity = b.flashMs > 0 ? 0.7 : 0.25 + 0.15 * Math.sin(time.now * 8);
      }
   });
   return (
      <group ref={root} visible={false}>
         <Model asset={ASSETS.mortar} scale={fit(GLB_SIZE.mortar.y, HEIGHT)} />
         {/* his ammo: orb blobs piled at his feet */}
         {AMMO.map(([x, z, s], i) => (
            <group key={i} position={[x, 0, z]}>
               <Model asset={ASSETS.blob} scale={fit(GLB_SIZE.blob.y, s)} />
            </group>
         ))}
         <mesh ref={glow} position={[0, HEIGHT * 0.55, 0]}>
            <sphereGeometry args={[HEIGHT * 0.45, 20, 14]} />
            <meshBasicMaterial transparent opacity={0.3} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}
