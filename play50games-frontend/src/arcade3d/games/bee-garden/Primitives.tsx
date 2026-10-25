"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { COLORS } from "./looks";

export function BeePrimitive({ tint = COLORS.accent }: { tint?: string }) {
   return (
      <group>
         {/* Main body (striped bee abdomen) */}
         <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color={tint} roughness={0.4} />
         </mesh>
         {/* Dark stripes */}
         <mesh position={[0, 0, -0.05]}>
            <cylinderGeometry args={[0.29, 0.29, 0.08, 16]} />
            <meshStandardMaterial color="#1c1917" roughness={0.6} />
         </mesh>
         <mesh position={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.28, 0.28, 0.08, 16]} />
            <meshStandardMaterial color="#1c1917" roughness={0.6} />
         </mesh>
         {/* Head */}
         <mesh castShadow position={[0, 0.05, 0.28]}>
            <sphereGeometry args={[0.2, 14, 10]} />
            <meshStandardMaterial color="#292524" roughness={0.5} />
         </mesh>
         {/* Eyes */}
         <mesh position={[-0.1, 0.1, 0.42]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#0c0a09" roughness={0.2} metalness={0.4} />
         </mesh>
         <mesh position={[0.1, 0.1, 0.42]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#0c0a09" roughness={0.2} metalness={0.4} />
         </mesh>
         {/* Wings */}
         <group position={[-0.14, 0.22, 0.02]} rotation={[0.2, -0.25, 0.35]}>
            <mesh>
               <boxGeometry args={[0.38, 0.02, 0.18]} />
               <meshStandardMaterial color="#e0f2fe" opacity={0.75} transparent roughness={0.1} />
            </mesh>
         </group>
         <group position={[0.14, 0.22, 0.02]} rotation={[0.2, 0.25, -0.35]}>
            <mesh>
               <boxGeometry args={[0.38, 0.02, 0.18]} />
               <meshStandardMaterial color="#e0f2fe" opacity={0.75} transparent roughness={0.1} />
            </mesh>
         </group>
         {/* Stinger */}
         <mesh position={[0, 0, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.06, 0.15, 8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
         </mesh>
      </group>
   );
}

export function BeehivePrimitive() {
   return (
      <group>
         {/* Hive base stand */}
         <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 1.0, 0.2, 8]} />
            <meshStandardMaterial color="#78350f" roughness={0.7} />
         </mesh>
         {/* Tier 1 box */}
         <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.82, 0.85, 0.4, 8]} />
            <meshStandardMaterial color={COLORS.hive} roughness={0.5} />
         </mesh>
         {/* Tier 2 box */}
         <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.74, 0.8, 0.38, 8]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.5} />
         </mesh>
         {/* Tier 3 box */}
         <mesh position={[0, 1.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.66, 0.72, 0.32, 8]} />
            <meshStandardMaterial color="#d97706" roughness={0.5} />
         </mesh>
         {/* Hive roof cap */}
         <mesh position={[0, 1.38, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.78, 0.22, 8]} />
            <meshStandardMaterial color={COLORS.hiveAccent} roughness={0.6} />
         </mesh>
         {/* Entrance slot */}
         <mesh position={[0, 0.35, 0.82]}>
            <boxGeometry args={[0.36, 0.1, 0.08]} />
            <meshStandardMaterial color={COLORS.hiveSlot} roughness={0.9} />
         </mesh>
         {/* Honey drip accent */}
         <mesh position={[0.22, 0.65, 0.78]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color={COLORS.nectar} roughness={0.2} />
         </mesh>
      </group>
   );
}

export function FlowerPrimitive({
   type,
   hasNectar = true,
}: {
   type: "A" | "B" | "C";
   hasNectar?: boolean;
}) {
   const petalColor = type === "A" ? COLORS.flowerA : type === "B" ? COLORS.flowerB : COLORS.flowerC;

   const petals = useMemo(() => {
      const list = [];
      const count = 6;
      for (let i = 0; i < count; i++) {
         const angle = (i * 2 * Math.PI) / count;
         list.push({
            x: Math.cos(angle) * 0.28,
            z: Math.sin(angle) * 0.28,
            rotY: angle,
         });
      }
      return list;
   }, []);

   return (
      <group>
         {/* Stem */}
         <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.stem} roughness={0.7} />
         </mesh>
         {/* Leaves on stem */}
         <mesh position={[-0.14, 0.28, 0]} rotation={[0.4, 0, 0.7]} castShadow>
            <boxGeometry args={[0.24, 0.02, 0.12]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.6} />
         </mesh>
         <mesh position={[0.14, 0.38, 0]} rotation={[-0.4, 0, -0.7]} castShadow>
            <boxGeometry args={[0.24, 0.02, 0.12]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.6} />
         </mesh>
         {/* Flower head */}
         <group position={[0, 0.72, 0]}>
            {/* Center disc */}
            <mesh position={[0, 0.02, 0]} castShadow>
               <cylinderGeometry args={[0.16, 0.18, 0.06, 12]} />
               <meshStandardMaterial color={COLORS.flowerCenter} roughness={0.4} />
            </mesh>
            {/* Petals */}
            {petals.map((p, i) => (
               <mesh key={i} position={[p.x, 0, p.z]} rotation={[0, -p.rotY, 0.2]} castShadow>
                  <sphereGeometry args={[0.14, 10, 8]} />
                  <meshStandardMaterial color={petalColor} roughness={0.5} />
               </mesh>
            ))}
            {/* Nectar orb hovering in center */}
            {hasNectar && (
               <mesh position={[0, 0.2, 0]} castShadow>
                  <sphereGeometry args={[0.16, 14, 10]} />
                  <meshStandardMaterial
                     color={COLORS.nectar}
                     emissive={COLORS.nectar}
                     emissiveIntensity={0.6}
                     roughness={0.15}
                     metalness={0.2}
                  />
               </mesh>
            )}
         </group>
      </group>
   );
}

export function BranchPrimitive({ radius = 0.5 }: { radius?: number }) {
   return (
      <group>
         {/* Woody trunk log */}
         <mesh position={[0, 0.35, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[radius * 0.9, radius, 1.6, 10]} />
            <meshStandardMaterial color={COLORS.branch} roughness={0.8} />
         </mesh>
         {/* Cut ends */}
         <mesh position={[-0.81, 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[radius * 0.88, 10]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.7} />
         </mesh>
         <mesh position={[0.81, 0.35, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[radius * 0.98, 10]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.7} />
         </mesh>
         {/* Green moss / sprout on branch */}
         <mesh position={[0.1, 0.72, 0]} rotation={[0.2, 0.4, 0]}>
            <sphereGeometry args={[0.14, 8, 6]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function WebPrimitive({ radius = 0.65 }: { radius?: number }) {
   return (
      <group position={[0, 1.15, 0]}>
         {/* Side twig posts */}
         <mesh position={[-radius * 0.9, -0.4, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
            <meshStandardMaterial color={COLORS.branch} roughness={0.8} />
         </mesh>
         <mesh position={[radius * 0.9, -0.4, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
            <meshStandardMaterial color={COLORS.branch} roughness={0.8} />
         </mesh>
         {/* Web mesh disc */}
         <mesh>
            <ringGeometry args={[0.05, radius, 8, 3]} />
            <meshStandardMaterial
               color={COLORS.web}
               side={DoubleSide}
               transparent
               opacity={0.65}
               roughness={0.2}
               wireframe
            />
         </mesh>
         {/* Inner glowing center */}
         <mesh>
            <circleGeometry args={[0.1, 8]} />
            <meshStandardMaterial color="#cbd5e1" side={DoubleSide} transparent opacity={0.4} />
         </mesh>
      </group>
   );
}

export function PlanterPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.5, 0.8]} />
            <meshStandardMaterial color={COLORS.planter} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.49, 0]}>
            <boxGeometry args={[1.44, 0.04, 0.68]} />
            <meshStandardMaterial color={COLORS.soilDark} roughness={0.9} />
         </mesh>
         {/* Tiny sprouts */}
         {[-0.4, 0, 0.4].map((x, i) => (
            <mesh key={i} position={[x, 0.58, 0]}>
               <sphereGeometry args={[0.08, 8, 6]} />
               <meshStandardMaterial color={COLORS.leaf} roughness={0.5} />
            </mesh>
         ))}
      </group>
   );
}

export function WateringCanPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 0.5, 12]} />
            <meshStandardMaterial color={COLORS.wateringCan} roughness={0.3} metalness={0.2} />
         </mesh>
         {/* Spout */}
         <mesh position={[0.26, 0.35, 0]} rotation={[0, 0, -0.6]} castShadow>
            <cylinderGeometry args={[0.04, 0.06, 0.4, 8]} />
            <meshStandardMaterial color={COLORS.wateringCan} roughness={0.3} />
         </mesh>
         <mesh position={[0.42, 0.5, 0]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.1, 0.05, 0.06, 10]} />
            <meshStandardMaterial color={COLORS.nectar} roughness={0.3} metalness={0.4} />
         </mesh>
      </group>
   );
}
