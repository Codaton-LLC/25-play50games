"use client";

// Bevelled stand-ins (two or three tones) until the firefighter-rescue GLBs are in the manifest.
import { COLORS } from "./looks";
import { FIREFIGHTER_HEIGHT } from "./assets";

const coat = COLORS.coat;
const coatDark = COLORS.coatDark;

/** 1.82 m firefighter: helmet, coat with a stripe, boots, extinguisher in the right hand. */
export function FirefighterFigure() {
   const s = FIREFIGHTER_HEIGHT / 1.82;
   return (
      <group scale={s}>
         <mesh position={[0.11, 0.16, 0]} castShadow={false}>
            <boxGeometry args={[0.16, 0.18, 0.28]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.7} />
         </mesh>
         <mesh position={[-0.11, 0.16, 0]}>
            <boxGeometry args={[0.16, 0.18, 0.28]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.7} />
         </mesh>
         <mesh position={[0.11, 0.52, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.52, 8]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.65} />
         </mesh>
         <mesh position={[-0.11, 0.52, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.52, 8]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.65} />
         </mesh>
         <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.5, 0.56, 0.28]} />
            <meshStandardMaterial color={coat} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.54, 0.16, 0.3]} />
            <meshStandardMaterial color={coatDark} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.16, 0.15]}>
            <boxGeometry args={[0.34, 0.1, 0.04]} />
            <meshStandardMaterial color={COLORS.stripe} emissive={COLORS.stripe} emissiveIntensity={0.25} roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.15, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.64, 0]}>
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshStandardMaterial color={COLORS.helmet} roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.58, 0.12]}>
            <boxGeometry args={[0.2, 0.06, 0.06]} />
            <meshStandardMaterial color={COLORS.emberCore} emissive={COLORS.ember} emissiveIntensity={0.4} roughness={0.3} />
         </mesh>
         <mesh position={[0.34, 0.95, 0.1]} rotation={[0.2, 0, 0.35]}>
            <cylinderGeometry args={[0.07, 0.08, 0.46, 8]} />
            <meshStandardMaterial color={COLORS.hydrant} roughness={0.45} />
         </mesh>
         <mesh position={[0.42, 1.12, 0.16]}>
            <cylinderGeometry args={[0.035, 0.035, 0.16, 6]} />
            <meshStandardMaterial color={COLORS.hose} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function ExtinguisherPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.32, 8]} />
            <meshStandardMaterial color={COLORS.hydrant} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.08, 8]} />
            <meshStandardMaterial color={COLORS.hose} roughness={0.35} />
         </mesh>
      </group>
   );
}

export function TruckPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.55, 0.2]}>
            <boxGeometry args={[1.7, 0.7, 2.4]} />
            <meshStandardMaterial color={COLORS.truck} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.05, 0.85]}>
            <boxGeometry args={[1.55, 0.55, 0.9]} />
            <meshStandardMaterial color={COLORS.truckDark} roughness={0.45} />
         </mesh>
         <mesh position={[0, 1.05, 1.22]}>
            <boxGeometry args={[1.3, 0.38, 0.08]} />
            <meshStandardMaterial color={COLORS.truckGlass} roughness={0.2} metalness={0.1} />
         </mesh>
         <mesh position={[0.7, 0.28, 0.7]}>
            <cylinderGeometry args={[0.22, 0.22, 0.2, 10]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.6} />
         </mesh>
         <mesh position={[-0.7, 0.28, 0.7]}>
            <cylinderGeometry args={[0.22, 0.22, 0.2, 10]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.6} />
         </mesh>
         <mesh position={[0.7, 0.28, -0.6]}>
            <cylinderGeometry args={[0.22, 0.22, 0.2, 10]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.6} />
         </mesh>
         <mesh position={[-0.7, 0.28, -0.6]}>
            <cylinderGeometry args={[0.22, 0.22, 0.2, 10]} />
            <meshStandardMaterial color={COLORS.navy} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function HydrantPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.5, 10]} />
            <meshStandardMaterial color={COLORS.hydrant} roughness={0.45} />
         </mesh>
         <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.16, 8]} />
            <meshStandardMaterial color={COLORS.hydrantCap} roughness={0.4} />
         </mesh>
         <mesh position={[0.16, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 6]} />
            <meshStandardMaterial color={COLORS.hose} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function HoseReelPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.55, 0.8, 0.28]} />
            <meshStandardMaterial color={COLORS.hose} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.5, 0.16]}>
            <cylinderGeometry args={[0.22, 0.22, 0.12, 12]} />
            <meshStandardMaterial color={COLORS.hoseRubber} roughness={0.55} />
         </mesh>
      </group>
   );
}

export function ExitSignPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.4, 6]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.7, 0.32, 0.08]} />
            <meshStandardMaterial color={COLORS.exit} emissive={COLORS.exit} emissiveIntensity={0.35} roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.5, 0.05]}>
            <boxGeometry args={[0.28, 0.12, 0.02]} />
            <meshStandardMaterial color={COLORS.exitGlow} emissive={COLORS.exitGlow} emissiveIntensity={0.5} />
         </mesh>
      </group>
   );
}
