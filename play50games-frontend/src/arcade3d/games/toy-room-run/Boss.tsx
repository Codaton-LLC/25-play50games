"use client";

// Jack Wobble (level 5): three toyboxes along the back of the corner (code: painted boxes whose lids
// rattle on a telegraph and fly open), and m2JackBoxBoss springing out of the one he is in, swaying
// dazed while he is open, bouncing round the room in phase 3 and crouching where he lands. A white
// hit flash, the slow-mo tumble on his defeat. Visual only: the rules own every hit.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS } from "./assets";
import { BOXES, LANDING } from "./levels";
import { JACK } from "./progression";
import type { ToyRun } from "./rules";
import type { VisualClock } from "./Course";

const BOX = 2.6;
const PAINT = ["#ef4444", "#3b82f6", "#22c55e"];

export function Boss({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const jack = useRef<Group>(null);
   const lids = useRef<(Group | null)[]>([]);
   const fronts = useRef<(Mesh | null)[]>([]);
   const tip = useRef(0);
   useFrame((_s, delta) => {
      const b = run.boss;
      if (!b) return;
      const dt = Math.min(0.1, delta) * bossTimeScale(b, JACK);
      const j = run.jack;
      const g = jack.current;
      const ms = clock.ms;
      const open = b.step === "vulnerable";
      if (g) {
         const out = b.phase < 2 ? j.y : j.y;
         g.position.set(j.x, Math.max(-2.2, out - 1.6), j.z);
         // dazed sway while open, a crouch where he lands in phase 3
         g.rotation.z = open ? 0.18 * Math.sin(ms / 160) : 0;
         const crouch = b.phase === 2 && (b.step === "attack" || open) ? 0.75 : 1;
         const flash = b.flashMs > 0 ? 1.08 : 1;
         g.scale.set(flash, crouch * flash, flash);
         const defeat = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / JACK.defeatMs) : 0;
         tip.current += (defeat - tip.current) * (1 - Math.exp(-3 * dt));
         g.rotation.x = -tip.current * 1.2;
         g.visible = b.phase === 2 || j.y > -1.4 || b.step === "intro";
      }
      for (let k = 0; k < 3; k++) {
         const lid = lids.current[k];
         if (!lid) continue;
         const mine = b.phase < 2 && j.box === k;
         let a = 0;
         if (mine && b.step === "telegraph") a = 0.12 * Math.abs(Math.sin(ms / 45)) * stepProgress(b, JACK) + 0.05;
         else if (mine && (b.step === "attack" || open)) a = 1.9;
         lid.rotation.x = -a;
         const f = fronts.current[k];
         if (f) (f.material as MeshStandardMaterial).emissiveIntensity = mine && b.step === "telegraph" ? 0.6 + 0.4 * Math.sin(ms / 60) : 0.05;
      }
   });
   if (!run.boss) return null;
   return (
      <>
         {BOXES.map((b, k) => (
            <group key={k} position={[b.x, 0, b.z]}>
               <mesh position={[0, BOX / 2, 0]}>
                  <boxGeometry args={[BOX, BOX, BOX]} />
                  <meshStandardMaterial color={PAINT[k]} roughness={0.6} />
               </mesh>
               <mesh
                  ref={(m) => {
                     fronts.current[k] = m;
                  }}
                  position={[0, BOX / 2, -BOX / 2 - 0.01]}
               >
                  <planeGeometry args={[BOX * 0.7, BOX * 0.7]} />
                  <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.05} roughness={0.5} />
               </mesh>
               <group
                  ref={(g) => {
                     lids.current[k] = g;
                  }}
                  position={[0, BOX, BOX / 2]}
               >
                  <mesh position={[0, 0.1, -BOX / 2]}>
                     <boxGeometry args={[BOX + 0.15, 0.2, BOX + 0.15]} />
                     <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                  </mesh>
               </group>
            </group>
         ))}
         <group ref={jack}>
            <Model asset={ASSETS.jack} rotation-y={Math.PI} />
         </group>
         {/* the landing mark (phase 3) */}
         <mesh position={[LANDING.x, 0.04, LANDING.z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[3.3, 3.6, 40]} />
            <meshBasicMaterial color="#f87171" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
