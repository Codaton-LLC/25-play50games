"use client";

import { RoundedBox } from "@react-three/drei";
import type { WarehouseLook } from "./scenery";

/** Low perimeter silhouettes, fitted by Scene's camera. Nothing solid overhangs the floor. */
export function Scenery({ look }: { look: WarehouseLook }) {
   return (
      <group name={`workstations-${look.kind}`}>
         {look.stations.map(({ x, z }, i) => (
            <group key={i} position={[x, 0, z]} rotation-y={z > 0 ? Math.PI : 0}>
               <RoundedBox args={[3, 0.18, 0.8]} radius={0.06} position-y={0.09}>
                  <meshStandardMaterial color={look.wall} roughness={0.7} />
               </RoundedBox>
               {look.kind === "rack" ? (
                  <>
                     {[-1.35, 1.35].map((px) => (
                        <mesh key={px} position={[px, 0.9, 0]}>
                           <boxGeometry args={[0.12, 1.8, 0.7]} />
                           <meshStandardMaterial color={look.accent} />
                        </mesh>
                     ))}
                     {[0.55, 1.25].map((y) => (
                        <mesh key={y} position={[0, y, 0]}>
                           <boxGeometry args={[2.8, 0.16, 0.7]} />
                           <meshStandardMaterial color={look.wall} />
                        </mesh>
                     ))}
                     <RoundedBox args={[1.2, 0.5, 0.6]} radius={0.06} position={[0.5, 1.58, 0]}>
                        <meshStandardMaterial color="#bd8c55" />
                     </RoundedBox>
                  </>
               ) : look.kind === "motor" ? (
                  <>
                     <RoundedBox args={[2.6, 0.65, 0.7]} radius={0.1} position-y={0.5}>
                        <meshStandardMaterial color={look.wall} metalness={0.4} roughness={0.5} />
                     </RoundedBox>
                     {[-0.9, -0.3, 0.3, 0.9].map((px) => (
                        <mesh key={px} position={[px, 0.92, 0]} rotation-x={Math.PI / 2}>
                           <cylinderGeometry args={[0.18, 0.18, 0.65, 12]} />
                           <meshStandardMaterial color={look.accent} metalness={0.5} roughness={0.35} />
                        </mesh>
                     ))}
                  </>
               ) : (
                  <>
                     <RoundedBox args={[2.7, look.kind === "freight" ? 1.65 : 1.9, 0.7]} radius={0.08} position-y={1.1}>
                        <meshStandardMaterial color={look.kind === "freight" ? "#a3633d" : look.wall} roughness={0.8} />
                     </RoundedBox>
                     {[-1, -0.5, 0, 0.5, 1].map((px) => (
                        <mesh key={px} position={[px, 1.1, 0.36]}>
                           <boxGeometry args={[0.05, 1.5, 0.025]} />
                           <meshStandardMaterial color={look.accent} emissive={look.accent} emissiveIntensity={look.kind === "cabinet" ? 0.5 : 0} />
                        </mesh>
                     ))}
                  </>
               )}
               {/* A fixture above each station, readable without expensive shadow-casting lights. */}
               <mesh position={[0, 2.12, 0]}>
                  <boxGeometry args={[1.6, 0.08, 0.3]} />
                  <meshBasicMaterial color={look.accent} />
               </mesh>
            </group>
         ))}
      </group>
   );
}
