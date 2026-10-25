"use client";

import React, { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import {
   DUMMY_HEIGHT,
   KNIGHT_HEIGHT,
   SWORD_BLADE_AHEAD,
   SWORD_HILT_BACK,
   TOWER_HEIGHT,
   TREE_HEIGHT,
} from "./assets";
import { COLORS } from "./looks";

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
         {/* Royal blue surcoat */}
         <mesh position={[0, 0.98, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.28, 0.68, 8]} />
            <meshStandardMaterial color={COLORS.banner} roughness={0.6} />
         </mesh>
         {/* Gold belt */}
         <mesh position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.07, 8]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Steel pauldrons */}
         <mesh position={[-0.30, 1.24, 0]} castShadow>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={COLORS.steel} flatShading roughness={0.35} metalness={0.6} />
         </mesh>
         <mesh position={[0.30, 1.24, 0]} castShadow>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={COLORS.steel} flatShading roughness={0.35} metalness={0.6} />
         </mesh>
         {/* Faceted helm, a round visor bar, and a plume that still tops out at 1.75 m */}
         <mesh position={[0, 1.52, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.20, 0.34, 8]} />
            <meshStandardMaterial color={COLORS.steel} flatShading roughness={0.3} metalness={0.65} />
         </mesh>
         <mesh position={[0, 1.53, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.22, 8]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.5} />
         </mesh>
         <mesh position={[0, KNIGHT_HEIGHT - 0.08, -0.02]} rotation={[0.5, 0, 0]}>
            <coneGeometry args={[0.05, 0.22, 5]} />
            <meshStandardMaterial color={COLORS.banner} flatShading roughness={0.7} />
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
            <meshStandardMaterial color={COLORS.steel} flatShading roughness={0.25} metalness={0.75} />
         </mesh>
         {/* Forged crossguard */}
         <mesh position={[-0.04, 0, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.24, 6]} />
            <meshStandardMaterial color={COLORS.gold} flatShading roughness={0.35} metalness={0.6} />
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
   const face = useMemo(() => {
      const shape = new Shape();
      shape.moveTo(-0.2, 0.27);
      shape.lineTo(0.2, 0.27);
      shape.lineTo(0.18, 0.02);
      shape.lineTo(0, -0.28);
      shape.lineTo(-0.18, 0.02);
      shape.closePath();
      const geo = new ExtrudeGeometry(shape, {
         depth: 0.05,
         bevelEnabled: true,
         bevelThickness: 0.012,
         bevelSize: 0.012,
         bevelSegments: 1,
         curveSegments: 1,
      });
      geo.translate(0.04, 0, 0.05);
      return geo;
   }, []);
   useEffect(() => () => face.dispose(), [face]);
   return (
      <group>
         <mesh geometry={face} dispose={null} castShadow>
            <meshStandardMaterial color={COLORS.banner} roughness={0.45} metalness={0.22} />
         </mesh>
         <mesh position={[0.04, 0.02, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.035, 8]} />
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
            <meshStandardMaterial color={COLORS.stoneDark} flatShading roughness={0.8} />
         </mesh>
         <mesh position={[0, DUMMY_HEIGHT * 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, DUMMY_HEIGHT * 0.85, 8]} />
            <meshStandardMaterial color={COLORS.woodDark} flatShading roughness={0.85} />
         </mesh>
         <mesh position={[0, 0.92, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.22, 0.56, 10]} />
            <meshStandardMaterial color={COLORS.woodMid} flatShading roughness={0.75} />
         </mesh>
         <mesh position={[0, 0.92, 0]}>
            <torusGeometry args={[0.23, 0.02, 6, 12]} />
            <meshStandardMaterial color={COLORS.woodDark} roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.64, 8]} />
            <meshStandardMaterial color={COLORS.wood} flatShading roughness={0.85} />
         </mesh>
         <mesh position={[0, DUMMY_HEIGHT - 0.14, 0]} castShadow>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color={COLORS.woodLight} flatShading roughness={0.75} />
         </mesh>
      </group>
   );
}

export function TowerPrimitive(): React.ReactElement {
   return (
      <group>
         <mesh position={[0, TOWER_HEIGHT * 0.38, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.05, 1.20, TOWER_HEIGHT * 0.76, 8]} />
            <meshStandardMaterial color={COLORS.stone} flatShading roughness={0.9} />
         </mesh>
         <mesh position={[0, TOWER_HEIGHT * 0.76, 0]} castShadow>
            <cylinderGeometry args={[1.16, 1.1, 0.28, 8]} />
            <meshStandardMaterial color={COLORS.stoneDark} flatShading roughness={0.9} />
         </mesh>
         {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
               <mesh key={i} position={[Math.cos(angle) * 0.92, TOWER_HEIGHT * 0.9, Math.sin(angle) * 0.92]} castShadow>
                  <cylinderGeometry args={[0.14, 0.16, 0.32, 5]} />
                  <meshStandardMaterial color={COLORS.stoneMid} flatShading roughness={0.9} />
               </mesh>
            );
         })}
         <mesh position={[0, TOWER_HEIGHT * 0.96, 0]} castShadow>
            <coneGeometry args={[0.85, TOWER_HEIGHT * 0.16, 8]} />
            <meshStandardMaterial color={COLORS.banner} flatShading roughness={0.6} />
         </mesh>
      </group>
   );
}

export function TreePrimitive(): React.ReactElement {
   return (
      <group>
         <mesh position={[0, TREE_HEIGHT * 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.26, TREE_HEIGHT * 0.5, 6]} />
            <meshStandardMaterial color={COLORS.woodDark} flatShading roughness={0.95} />
         </mesh>
         <mesh position={[0, TREE_HEIGHT * 0.62, 0]} castShadow>
            <dodecahedronGeometry args={[TREE_HEIGHT * 0.3, 0]} />
            <meshStandardMaterial color={COLORS.grassShade} flatShading roughness={1} />
         </mesh>
         <mesh position={[0.22, TREE_HEIGHT * 0.8, -0.08]} castShadow>
            <dodecahedronGeometry args={[TREE_HEIGHT * 0.2, 0]} />
            <meshStandardMaterial color={COLORS.grass} flatShading roughness={1} />
         </mesh>
      </group>
   );
}
