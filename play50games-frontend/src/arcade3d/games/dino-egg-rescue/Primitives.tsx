"use client";

import { useMemo } from "react";
import { IcosahedronGeometry, MeshStandardMaterial } from "three";
import type { InstancePart } from "@/arcade3d/core/render/dynamicInstances";
import { COLORS } from "./looks";

/**
 * Baby dino fallback stand-in when EXPANSION_ASSETS.dino is missing or loading.
 * Deliberate, rounded shapes with 3 tones from COLORS (vibrant skin, pale belly, coral frills).
 * Modeled standing on y = 0, facing +z, ~1.1 m long, 0.8 m tall.
 */
export function DinoPrimitive() {
   return (
      <group name="dino-primitive">
         {/* Main Body */}
         <mesh position={[0, 0.4, 0]}>
            <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.6} />
         </mesh>

         {/* Pale Belly Patch */}
         <mesh position={[0, 0.32, 0.08]} scale={[0.85, 0.85, 0.85]}>
            <capsuleGeometry args={[0.24, 0.42, 8, 16]} />
            <meshStandardMaterial color={COLORS.dinoBelly} roughness={0.65} />
         </mesh>

         {/* Head & Snout */}
         <mesh position={[0, 0.62, 0.35]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.55, 0.48]}>
            <capsuleGeometry args={[0.12, 0.16, 8, 16]} />
            <meshStandardMaterial color={COLORS.dinoBelly} roughness={0.6} />
         </mesh>

         {/* Dorsal Crest / Back Frills (coral-orange) */}
         <mesh position={[0, 0.65, -0.05]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.06, 0.22, 0.35]} />
            <meshStandardMaterial color={COLORS.dinoFrill} roughness={0.65} />
         </mesh>
         <mesh position={[0, 0.72, 0.2]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.06, 0.16, 4]} />
            <meshStandardMaterial color={COLORS.dinoFrill} roughness={0.65} />
         </mesh>

         {/* Tail */}
         <mesh position={[0, 0.35, -0.42]} rotation={[-0.4, 0, 0]}>
            <coneGeometry args={[0.15, 0.45, 12]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.6} />
         </mesh>

         {/* Eyes (dark glossy pupil on clean eye-white) */}
         <mesh position={[0.13, 0.66, 0.44]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={COLORS.dinoEyeWhite} roughness={0.2} />
         </mesh>
         <mesh position={[0.14, 0.66, 0.46]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color={COLORS.dinoEye} roughness={0.1} />
         </mesh>

         <mesh position={[-0.13, 0.66, 0.44]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={COLORS.dinoEyeWhite} roughness={0.2} />
         </mesh>
         <mesh position={[-0.14, 0.66, 0.46]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color={COLORS.dinoEye} roughness={0.1} />
         </mesh>

         {/* Chubby feet */}
         <mesh position={[0.2, 0.12, 0.16]}>
            <capsuleGeometry args={[0.09, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.7} />
         </mesh>
         <mesh position={[-0.2, 0.12, 0.16]}>
            <capsuleGeometry args={[0.09, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.7} />
         </mesh>
         <mesh position={[0.2, 0.12, -0.2]}>
            <capsuleGeometry args={[0.09, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.7} />
         </mesh>
         <mesh position={[-0.2, 0.12, -0.2]}>
            <capsuleGeometry args={[0.09, 0.12, 6, 8]} />
            <meshStandardMaterial color={COLORS.dinoSkin} roughness={0.7} />
         </mesh>
      </group>
   );
}

/** Fallback leafy tree stand-in (stepped trunk + multi-toned foliage canopy). */
export function TreePrimitive() {
   return (
      <group name="tree-primitive">
         {/* Segmented Bark Trunk */}
         <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.24, 0.28, 1.2, 8]} />
            <meshStandardMaterial color={COLORS.barkDark} roughness={0.9} />
         </mesh>
         <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.2, 0.24, 1.0, 8]} />
            <meshStandardMaterial color={COLORS.bark} roughness={0.85} />
         </mesh>

         {/* Layered Foliage Canopy (2-3 green tones from COLORS) */}
         <mesh position={[0, 2.3, 0]}>
            <sphereGeometry args={[1.15, 10, 10]} />
            <meshStandardMaterial color={COLORS.leafDark} flatShading roughness={0.7} />
         </mesh>
         <mesh position={[0, 2.9, 0]}>
            <coneGeometry args={[0.9, 1.3, 8]} />
            <meshStandardMaterial color={COLORS.leafMedium} flatShading roughness={0.7} />
         </mesh>
         <mesh position={[0, 3.4, 0]}>
            <coneGeometry args={[0.65, 0.9, 8]} />
            <meshStandardMaterial color={COLORS.leafLight} flatShading roughness={0.7} />
         </mesh>
      </group>
   );
}

/** Fallback boulder: low-poly faceted volcanic basalt with flat shading. */
export function BoulderPrimitive() {
   return (
      <group name="boulder-primitive" position={[0, 0.5, 0]}>
         <mesh>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial
               color={COLORS.boulder}
               flatShading
               roughness={0.85}
            />
         </mesh>
      </group>
   );
}

/** Fallback parts for DynamicInstancedModel rock pool when GLB is missing. */
export function useBoulderParts(): InstancePart[] {
   return useMemo(() => {
      const geom = new IcosahedronGeometry(0.5, 0);
      const mat = new MeshStandardMaterial({
         color: COLORS.boulder,
         flatShading: true,
         roughness: 0.85,
      });
      return [{ geometry: geom, material: mat }];
   }, []);
}

/**
 * Fallback volcano backdrop cone: 5.5 m radius, 8 m tall at (16, -13).
 * Multi-toned faceted volcanic peak with rugged basalt slopes and glowing crater rim.
 */
export function VolcanoConePrimitive() {
   return (
      <group name="volcano-cone-primitive">
         {/* Craggy Mountain Body */}
         <mesh position={[0, 4.0, 0]}>
            <coneGeometry args={[5.5, 8.0, 12, 2, true]} />
            <meshStandardMaterial
               color={COLORS.volcanoRock}
               flatShading
               roughness={0.95}
            />
         </mesh>
         {/* Dark Basalt Base Skirt */}
         <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[4.8, 5.8, 2.4, 12]} />
            <meshStandardMaterial
               color={COLORS.volcanoDark}
               flatShading
               roughness={0.95}
            />
         </mesh>
         {/* Molten Crater Opening */}
         <mesh position={[0, 7.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.2, 16]} />
            <meshStandardMaterial
               color={COLORS.lavaGlow}
               emissive={COLORS.lavaCore}
               emissiveIntensity={2.5}
               roughness={0.3}
            />
         </mesh>
      </group>
   );
}
