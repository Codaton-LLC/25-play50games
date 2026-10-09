"use client";

import { useMemo } from "react";
import { SphereGeometry, MeshStandardMaterial } from "three";
import type { InstancePart } from "@/arcade3d/core/render/dynamicInstances";

/**
 * Baby dino fallback stand-in when EXPANSION_ASSETS.dino is missing or loading.
 * Modeled standing on y = 0, facing +z, ~1.1 m long, 0.8 m tall.
 */
export function DinoPrimitive() {
   return (
      <group name="dino-primitive">
         {/* Body */}
         <mesh position={[0, 0.4, 0]}>
            <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
            <meshStandardMaterial color="#84cc16" roughness={0.6} />
         </mesh>
         {/* Head & Snout */}
         <mesh position={[0, 0.62, 0.35]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#84cc16" roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.55, 0.48]}>
            <capsuleGeometry args={[0.12, 0.16, 8, 16]} />
            <meshStandardMaterial color="#a3e635" roughness={0.6} />
         </mesh>
         {/* Back Frill */}
         <mesh position={[0, 0.65, -0.05]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.06, 0.22, 0.35]} />
            <meshStandardMaterial color="#f97316" roughness={0.7} />
         </mesh>
         {/* Tail */}
         <mesh position={[0, 0.35, -0.42]} rotation={[-0.4, 0, 0]}>
            <coneGeometry args={[0.15, 0.45, 12]} />
            <meshStandardMaterial color="#84cc16" roughness={0.6} />
         </mesh>
         {/* Eyes */}
         <mesh position={[0.12, 0.66, 0.45]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} />
         </mesh>
         <mesh position={[-0.12, 0.66, 0.45]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} />
         </mesh>
      </group>
   );
}

/** Fallback leafy tree stand-in (trunk + foliage canopy). */
export function TreePrimitive() {
   return (
      <group name="tree-primitive">
         {/* Trunk */}
         <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 2.0, 10]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
         </mesh>
         {/* Foliage */}
         <mesh position={[0, 2.6, 0]}>
            <sphereGeometry args={[1.1, 12, 12]} />
            <meshStandardMaterial color="#4d7c0f" roughness={0.7} />
         </mesh>
         <mesh position={[0, 3.2, 0]}>
            <coneGeometry args={[0.85, 1.2, 10]} />
            <meshStandardMaterial color="#65a30d" roughness={0.7} />
         </mesh>
      </group>
   );
}

/** Fallback boulder sphere. */
export function BoulderPrimitive() {
   return (
      <mesh position={[0, 0.5, 0]}>
         <sphereGeometry args={[0.5, 16, 16]} />
         <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>
   );
}

/**
 * Fallback parts for DynamicInstancedModel rock pool when GLB is missing.
 */
export function useBoulderParts(): InstancePart[] {
   return useMemo(() => {
      const geom = new SphereGeometry(0.5, 12, 10);
      const mat = new MeshStandardMaterial({ color: "#78716c", roughness: 0.85 });
      return [{ geometry: geom, material: mat }];
   }, []);
}
