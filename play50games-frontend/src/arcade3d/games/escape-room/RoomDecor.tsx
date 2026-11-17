"use client";

import { Suspense } from "react";
import { RoundedBox } from "@react-three/drei";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS } from "./assets";
import { ROOM_PROPS, ROOM_STYLES } from "./roomStyles";
import type { EscapeLevel } from "./rules";

/** Non-colliding floor inlays and scenery; the central landmark fills the existing blocker. */
export default function RoomDecor({ id }: { id: EscapeLevel["id"] }) {
   if (id === 1) return null;
   const style = ROOM_STYLES[id];
   return <group name={`room-decor-${id}`}>
      <pointLight position={[-3, 3.5, -2]} color={style.accent} intensity={id === 4 ? 10 : 6} distance={12} />
      <Suspense fallback={null}>
         {ROOM_PROPS[id].map((p, i) => <Model key={i} asset={p.asset} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]} fallback={null} />)}
         {id >= 3 && <group position={[0, 0, 0]} scale={id === 5 ? [1.2, 0.9, 0.65] : [1.8, 0.65, 0.55]}>
            <Model asset={id === 5 ? ASSETS.shipConsole : ASSETS.desk} fallback={
               <RoundedBox args={id === 5 ? [1.7, 0.93, 1.06] : [1.2, 1.4, 1.4]} position={[0, 0.45, 0]} radius={0.06}>
                  <meshStandardMaterial color={style.wall} />
               </RoundedBox>
            } />
         </group>}
      </Suspense>
      {/* Floor details have no raised edges: joystick and keyboard routes stay identical. */}
      {Array.from({ length: id === 4 ? 19 : 9 }, (_, i) => (
         <mesh key={i} position={[0, 0.008, -4.5 + i * (id === 4 ? 0.5 : 1.1)]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[11.9, id === 4 ? 0.025 : 0.035]} />
            <meshBasicMaterial color={id === 4 ? "#36291f" : style.wall} />
         </mesh>
      ))}
      {id !== 4 && [-2.5, 2.5].map((x) => <mesh key={x} position={[x, 0.012, 0]} rotation-x={-Math.PI / 2}>
         <planeGeometry args={[id === 2 ? 0.12 : 0.055, 9.7]} />
         <meshBasicMaterial color={style.accent} transparent opacity={0.6} />
      </mesh>)}
      {/* Rear-wall fixtures are shallow and beyond the arena, clear of the door and badges. */}
      {[-3, 3].map((x) => <RoundedBox key={x} position={[x, 1.45, -5.35]} args={[id === 4 ? 1.5 : 2.3, 0.55, 0.12]} radius={0.04}>
         <meshStandardMaterial color={id === 4 ? "#183b53" : style.wall} emissive={style.accent} emissiveIntensity={id === 5 ? 0.6 : 0.15} />
      </RoundedBox>)}
      {id === 3 && [-4, -2.5, 2.5, 4].map((x) => <mesh key={x} position={[x, 0.22, -5.8]}>
         <cylinderGeometry args={[0.25, 0.25, 0.45, 16, 1, true]} />
         <meshStandardMaterial color={style.accent} transparent opacity={0.22} depthWrite={false} />
      </mesh>)}
      {id === 5 && <mesh position={[0, 0.018, 0]} rotation-x={-Math.PI / 2}>
         <ringGeometry args={[0.65, 0.85, 32]} />
         <meshBasicMaterial color={style.accent} />
      </mesh>}
   </group>;
}
