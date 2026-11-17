"use client";

// Bevelled stand-ins (two or three tones) for the carpet and the rider, drawn if their GLBs fail.
// Geometries here are already in metres. Instanced decor in Scene.tsx is unit-sized and scaled by the spot.
import { COLORS as LOOK } from "./looks";

/** The stand-ins' own tones (two or three per part). */
const COLORS = {
   ...LOOK,
   carpet: "#6d28d9",
   carpetTrim: "#c4b5fd",
   carpetGold: "#fbbf24",
   cloth: "#4c1d95",
   clothDark: "#2e1065",
   skin: "#f1d0b4",
   scarf: "#a78bfa",
} as const;

/** Seated rider. A standing 1.72 m person sits about 0.95 m from the cushion to the crown. */
export function RiderFigure() {
   return (
      <group>
         <mesh position={[0.16, 0.08, 0.12]} rotation={[0.5, 0.4, 0.9]}>
            <boxGeometry args={[0.16, 0.14, 0.42]} />
            <meshStandardMaterial color={COLORS.clothDark} roughness={0.6} />
         </mesh>
         <mesh position={[-0.16, 0.08, 0.12]} rotation={[0.5, -0.4, -0.9]}>
            <boxGeometry args={[0.16, 0.14, 0.42]} />
            <meshStandardMaterial color={COLORS.clothDark} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.42, 0.02]}>
            <boxGeometry args={[0.42, 0.4, 0.26]} />
            <meshStandardMaterial color={COLORS.cloth} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.5, 0.14]}>
            <boxGeometry args={[0.36, 0.1, 0.04]} />
            <meshStandardMaterial color={COLORS.scarf} emissive={COLORS.accent} emissiveIntensity={0.25} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.74, 0.02]}>
            <sphereGeometry args={[0.15, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.9, 0.02]}>
            <boxGeometry args={[0.22, 0.1, 0.2]} />
            <meshStandardMaterial color={COLORS.clothDark} roughness={0.45} />
         </mesh>
         <mesh position={[0.22, 0.4, 0.22]} rotation={[1.15, 0, 0.15]}>
            <boxGeometry args={[0.08, 0.08, 0.32]} />
            <meshStandardMaterial color={COLORS.cloth} roughness={0.5} />
         </mesh>
         <mesh position={[-0.22, 0.4, 0.22]} rotation={[1.15, 0, -0.15]}>
            <boxGeometry args={[0.08, 0.08, 0.32]} />
            <meshStandardMaterial color={COLORS.cloth} roughness={0.5} />
         </mesh>
      </group>
   );
}

export function CarpetPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[1.55, 0.06, 2.45]} />
            <meshStandardMaterial color={COLORS.carpet} roughness={0.45} />
         </mesh>
         <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[1.35, 0.025, 2.2]} />
            <meshStandardMaterial color={COLORS.carpetTrim} roughness={0.35} />
         </mesh>
         <mesh position={[0, 0.05, 1.28]}>
            <boxGeometry args={[1.15, 0.03, 0.12]} />
            <meshStandardMaterial color={COLORS.carpetGold} emissive={COLORS.ring} emissiveIntensity={0.2} roughness={0.4} />
         </mesh>
         <mesh position={[0.78, 0.02, 1.05]}>
            <boxGeometry args={[0.06, 0.05, 0.16]} />
            <meshStandardMaterial color={COLORS.carpetGold} roughness={0.4} />
         </mesh>
         <mesh position={[-0.78, 0.02, 1.05]}>
            <boxGeometry args={[0.06, 0.05, 0.16]} />
            <meshStandardMaterial color={COLORS.carpetGold} roughness={0.4} />
         </mesh>
      </group>
   );
}
