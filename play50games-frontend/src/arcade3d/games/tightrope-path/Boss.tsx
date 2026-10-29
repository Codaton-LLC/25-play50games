"use client";

// Umbra (level 5): the shared m2ShadowArmadillo walking the joust towards the hero, facing him. His
// tells: he rears up before a stomp (and the rope bucks on the attack), lifts a blade to cut a strand,
// winds up a plate. While he is open he wobbles (P1 mid-wave, P2 his needle tipping); a hit flashes him
// violet; the defeat is his slow glide off into the mist (no harm). The plates fly at the hero in P3.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, UMBRA_SCALE } from "./assets";
import { arenaLink, heroPoint, umbraPoint, type TightRun } from "./rules";
import { UMBRA } from "./progression";

const P = { x: 0, y: 0, z: 0 };
const H = { x: 0, y: 0, z: 0 };

export function Umbra({ run }: { run: TightRun }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const plate = useRef<Mesh>(null);
   const aura = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g || !b) return;
      umbraPoint(run, P);
      const l = arenaLink(run.course, run.umbraArena);
      g.visible = b.step !== "done";
      let x = P.x;
      let y = P.y;
      let z = P.z;
      if (b.defeatMs >= 0) {
         // he glides off sideways and down into the mist
         const t = b.defeatMs / 1000;
         x += -l.dz * t * 2.2;
         z += l.dx * t * 2.2;
         y -= t * t * 1.4;
      }
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-l.dx, -l.dz);
      const bd = body.current;
      if (bd) {
         const tel = b.step === "telegraph" ? Math.min(1, b.stepMs / 600) : 0;
         bd.position.y = tel * (b.phase === 0 ? 0.35 : 0.12);
         bd.rotation.z = b.step === "vulnerable" ? Math.sin(time.now * 9) * 0.28 : b.defeatMs >= 0 ? 0.6 : 0;
         bd.rotation.x = b.step === "attack" && b.phase === 0 ? 0.25 : 0;
      }
      const a = aura.current;
      if (a) {
         a.visible = b.flashMs > 0 || b.step === "vulnerable";
         a.scale.setScalar(b.flashMs > 0 ? 1.4 : 1.1 + Math.sin(time.now * 6) * 0.05);
      }
      const pl = plate.current;
      if (pl) {
         const flying = b.phase === 2 && b.step === "attack";
         pl.visible = flying;
         if (flying) {
            heroPoint(run, H);
            const k = Math.min(1, b.stepMs / UMBRA.phases[2].attacks[0].attackMs);
            pl.position.set(x + (H.x - x) * k, y + 1.2 + Math.sin(k * Math.PI) * 0.6, z + (H.z - z) * k);
            pl.rotation.y = time.now * 18;
         }
      }
   });
   if (!run.boss) return null;
   return (
      <>
         <group ref={root}>
            <group ref={body}>
               <Model asset={ASSETS.umbra} scale={UMBRA_SCALE} tint="#8b7fb8" />
            </group>
            <mesh ref={aura} position={[0, 0.85, 0]} visible={false}>
               <sphereGeometry args={[1, 18, 12]} />
               <meshBasicMaterial color="#c4b5fd" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         <mesh ref={plate} visible={false}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 18]} />
            <meshStandardMaterial color="#d8d2c4" metalness={0.4} roughness={0.4} />
         </mesh>
      </>
   );
}
