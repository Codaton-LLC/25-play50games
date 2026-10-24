"use client";

import React from "react";
import {
   DUMMY_HEIGHT,
   KNIGHT_HEIGHT,
   SHIELD_HEIGHT,
   SWORD_BLADE_AHEAD,
   SWORD_HILT_BACK,
   TOWER_HEIGHT,
   TREE_HEIGHT,
} from "./assets";
import { COLORS } from "./rules";

export function KnightPrimitive(): React.ReactElement {
   return (
      <group>
         {/* Boots / Legs */}
         <mesh position={[-0.14, 0.35, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.50, 4, 8]} />
            <meshStandardMaterial color={COLORS.steelDark} roughness={0.5} metalness={0.4} />
         </mesh>
         <mesh position={[0.14, 0.35, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.50, 4, 8]} />
            <meshStandardMaterial color={COLORS.steelDark} roughness={0.5} metalness={0.4} />
         </mesh>
         {/* Royal blue surcoat torso */}
         <mesh position={[0, 0.98, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.28, 0.68, 8]} />
            <meshStandardMaterial color={COLORS.royalBlue} roughness={0.6} />
         </mesh>
         {/* Gold belt */}
         <mesh position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.07, 8]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Steel pauldrons */}
         <mesh position={[-0.30, 1.24, 0]} castShadow>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={COLORS.steel} roughness={0.35} metalness={0.6} />
         </mesh>
         <mesh position={[0.30, 1.24, 0]} castShadow>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={COLORS.steel} roughness={0.35} metalness={0.6} />
         </mesh>
         {/* Helmet & visor */}
         <mesh position={[0, 1.52, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.20, 0.34, 8]} />
            <meshStandardMaterial color={COLORS.steel} roughness={0.3} metalness={0.65} />
         </mesh>
         <mesh position={[0, 1.53, 0.16]}>
            <boxGeometry args={[0.22, 0.08, 0.08]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Plume at top (reaches 1.75 m) */}
         <mesh position={[0, KNIGHT_HEIGHT - 0.06, -0.04]}>
            <boxGeometry args={[0.08, 0.12, 0.22]} />
            <meshStandardMaterial color={COLORS.royalBlue} roughness={0.7} />
         </mesh>
      </group>
   );
}

/**
 * Fallback sword in `handR` anchor space (grip at origin, blade extending `-0.70 m` along `-x`,
 * hilt/pommel extending `+0.15 m` along `+x`).
 */
export function SwordPrimitive(): React.ReactElement {
   return (
      <group>
         {/* Steel blade along -x */}
         <mesh position={[-SWORD_BLADE_AHEAD * 0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <coneGeometry args={[0.045, SWORD_BLADE_AHEAD, 4]} />
            <meshStandardMaterial color={COLORS.steel} roughness={0.25} metalness={0.75} />
         </mesh>
         {/* Gold crossguard */}
         <mesh position={[-0.04, 0, 0]}>
            <boxGeometry args={[0.04, 0.24, 0.06]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.35} metalness={0.6} />
         </mesh>
         {/* Wood grip */}
         <mesh position={[SWORD_HILT_BACK * 0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, SWORD_HILT_BACK * 0.8, 6]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.8} />
         </mesh>
         {/* Gold pommel */}
         <mesh position={[SWORD_HILT_BACK, 0, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.35} metalness={0.6} />
         </mesh>
      </group>
   );
}

/**
 * Fallback heater shield in `handL` anchor space (`0.55 m` tall).
 */
export function ShieldPrimitive(): React.ReactElement {
   return (
      <group>
         <mesh position={[0.04, 0, 0.06]} castShadow>
            <boxGeometry args={[0.40, SHIELD_HEIGHT, 0.06]} />
            <meshStandardMaterial color={COLORS.royalBlue} roughness={0.5} metalness={0.2} />
         </mesh>
         <mesh position={[0.04, 0.02, 0.10]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.04, 8]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.35} metalness={0.6} />
         </mesh>
      </group>
   );
}

export function DummyPrimitive(): React.ReactElement {
   return (
      <group>
         {/* Base disc */}
         <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.32, 0.34, 0.08, 12]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.8} />
         </mesh>
         {/* Center post */}
         <mesh position={[0, DUMMY_HEIGHT * 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, DUMMY_HEIGHT * 0.85, 8]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
         </mesh>
         {/* Padded barrel torso */}
         <mesh position={[0, 0.92, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.22, 0.56, 10]} />
            <meshStandardMaterial color={COLORS.woodLight} roughness={0.75} />
         </mesh>
         {/* Crossbar arms */}
         <mesh position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.64, 8]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
         </mesh>
         {/* Wooden head */}
         <mesh position={[0, DUMMY_HEIGHT - 0.14, 0]} castShadow>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color={COLORS.woodLight} roughness={0.75} />
         </mesh>
      </group>
   );
}

export function TowerPrimitive(): React.ReactElement {
   return (
      <group>
         <mesh position={[0, TOWER_HEIGHT * 0.38, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.05, 1.20, TOWER_HEIGHT * 0.76, 10]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.85} />
         </mesh>
         <mesh position={[0, TOWER_HEIGHT * 0.78, 0]} castShadow>
            <cylinderGeometry args={[1.18, 1.12, 0.45, 10]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.85} />
         </mesh>
         <mesh position={[0, TOWER_HEIGHT * 0.90, 0]} castShadow>
            <coneGeometry args={[1.25, TOWER_HEIGHT * 0.24, 10]} />
            <meshStandardMaterial color={COLORS.royalBlue} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function TreePrimitive(): React.ReactElement {
   return (
      <group>
         <mesh position={[0, TREE_HEIGHT * 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.26, TREE_HEIGHT * 0.5, 7]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
         </mesh>
         <mesh position={[0, TREE_HEIGHT * 0.65, 0]} castShadow>
            <dodecahedronGeometry args={[TREE_HEIGHT * 0.32, 1]} />
            <meshStandardMaterial color={COLORS.grass} roughness={0.8} />
         </mesh>
         <mesh position={[0.2, TREE_HEIGHT * 0.82, -0.1]} castShadow>
            <dodecahedronGeometry args={[TREE_HEIGHT * 0.22, 1]} />
            <meshStandardMaterial color="#65a30d" roughness={0.8} />
         </mesh>
      </group>
   );
}
