"use client";

// Bevelled stand-ins. Two or three tones each. The GLB replaces the whole group.
import { COLORS } from "./looks";

export function TaxiPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.42, 0.05]} castShadow={false}>
            <boxGeometry args={[1.55, 0.42, 3.15]} />
            <meshStandardMaterial color={COLORS.taxi} roughness={0.42} metalness={0.08} />
         </mesh>
         <mesh position={[0, 0.78, -0.15]}>
            <boxGeometry args={[1.38, 0.36, 1.55]} />
            <meshStandardMaterial color={COLORS.window} roughness={0.35} metalness={0.12} />
         </mesh>
         <mesh position={[0, 0.22, 0.05]}>
            <boxGeometry args={[1.62, 0.16, 2.4]} />
            <meshStandardMaterial color={COLORS.taxiDark} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.05, -0.15]}>
            <boxGeometry args={[0.46, 0.1, 0.46]} />
            <meshStandardMaterial color={COLORS.sign} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function RiderPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.18, 0.42, 4, 8]} />
            <meshStandardMaterial color={COLORS.rider} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.72, 0.16]}>
            <boxGeometry args={[0.28, 0.22, 0.12]} />
            <meshStandardMaterial color={COLORS.riderTrim} roughness={0.5} />
         </mesh>
      </group>
   );
}

export function LightPrimitive() {
   return (
      <group>
         <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 2.3, 8]} />
            <meshStandardMaterial color={COLORS.pole} roughness={0.45} metalness={0.2} />
         </mesh>
         <mesh position={[0, 2.15, 0.12]}>
            <boxGeometry args={[0.28, 0.62, 0.22]} />
            <meshStandardMaterial color={COLORS.pole} roughness={0.4} metalness={0.15} />
         </mesh>
      </group>
   );
}
