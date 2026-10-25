"use client";

// Procedural fallback geometries for Mars Rover Mission.
// Rendered whenever GLBs are unlisted or loading.
import { COLORS } from "./looks";

export function RoverPrimitive() {
   return (
      <group>
         {/* Main chassis */}
         <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.5, 0.45, 2.0]} />
            <meshStandardMaterial color={COLORS.rover} roughness={0.6} metalness={0.2} />
         </mesh>

         {/* Equipment deck */}
         <mesh position={[0, 0.85, -0.1]}>
            <boxGeometry args={[1.2, 0.2, 1.4]} />
            <meshStandardMaterial color={COLORS.roverMetal} roughness={0.4} metalness={0.6} />
         </mesh>

         {/* Sensor mast */}
         <mesh position={[0.4, 1.25, -0.6]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.roverMetal} metalness={0.8} />
         </mesh>
         <mesh position={[0.4, 1.6, -0.6]}>
            <boxGeometry args={[0.25, 0.15, 0.15]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.3} emissive={COLORS.accent} emissiveIntensity={0.4} />
         </mesh>

         {/* Sample tray at the rear */}
         <mesh position={[0, 0.8, 0.7]}>
            <boxGeometry args={[0.9, 0.12, 0.5]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
         </mesh>

         {/* Four wheels */}
         <mesh position={[-0.85, 0.35, -0.65]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
            <meshStandardMaterial color={COLORS.roverWheel} roughness={0.85} />
         </mesh>
         <mesh position={[0.85, 0.35, -0.65]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
            <meshStandardMaterial color={COLORS.roverWheel} roughness={0.85} />
         </mesh>
         <mesh position={[-0.85, 0.35, 0.65]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
            <meshStandardMaterial color={COLORS.roverWheel} roughness={0.85} />
         </mesh>
         <mesh position={[0.85, 0.35, 0.65]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
            <meshStandardMaterial color={COLORS.roverWheel} roughness={0.85} />
         </mesh>
      </group>
   );
}

export function BasePrimitive() {
   return (
      <group>
         {/* Central habitat dome */}
         <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[2.2, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
         </mesh>
         {/* Cylindrical base rim */}
         <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[2.3, 2.3, 0.8, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.6} />
         </mesh>
         {/* Airlock tunnel */}
         <mesh position={[0, 0.6, 2.2]}>
            <boxGeometry args={[1.2, 1.2, 1.0]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.6, 2.71]}>
            <planeGeometry args={[0.8, 0.9]} />
            <meshStandardMaterial color={COLORS.basePadActive} emissive={COLORS.basePadActive} emissiveIntensity={0.4} />
         </mesh>
      </group>
   );
}

export function AntennaPrimitive() {
   return (
      <group>
         <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 3.2, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
         </mesh>
         {/* Parabolic dish */}
         <mesh position={[0, 3.1, 0]} rotation-x={-0.4}>
            <cylinderGeometry args={[0.85, 0.1, 0.2, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.5} />
         </mesh>
      </group>
   );
}

export function SolarPanelPrimitive() {
   return (
      <group>
         {/* Support truss */}
         <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.1, 0.15, 1.0, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.6} />
         </mesh>
         {/* Tilted panel frame */}
         <mesh position={[0, 1.1, 0]} rotation-x={0.45}>
            <boxGeometry args={[2.2, 0.08, 1.4]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
         </mesh>
         {/* Photovoltaic cells */}
         <mesh position={[0, 1.15, 0]} rotation-x={0.45}>
            <planeGeometry args={[2.1, 1.3]} />
            <meshStandardMaterial
               color={COLORS.solarBlue}
               roughness={0.2}
               metalness={0.8}
               emissive={COLORS.solarBlue}
               emissiveIntensity={0.2}
            />
         </mesh>
      </group>
   );
}

export function ChargerPrimitive() {
   return (
      <group>
         {/* Ground charging pad ring */}
         <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.5, 2.2, 28]} />
            <meshStandardMaterial color={COLORS.chargerPad} emissive={COLORS.chargerPad} emissiveIntensity={0.6} roughness={0.3} />
         </mesh>
         {/* Inner glowing contact disc */}
         <mesh position={[0, 0.015, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[1.4, 24]} />
            <meshStandardMaterial color="#14532d" roughness={0.7} />
         </mesh>
         {/* Charging pylon */}
         <mesh position={[0, 1.0, -1.6]}>
            <boxGeometry args={[0.4, 2.0, 0.4]} />
            <meshStandardMaterial color="#334155" roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.8, -1.35]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color={COLORS.chargerPadActive} emissive={COLORS.chargerPadActive} emissiveIntensity={1} />
         </mesh>
      </group>
   );
}

export function BeaconPrimitive() {
   return (
      <group>
         {/* Base anchor */}
         <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.3, 0.45, 0.4, 10]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
         </mesh>
         {/* Tall mast to read across the plain */}
         <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 4.0, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
         </mesh>
         {/* Beacon lamp head */}
         <mesh position={[0, 4.3, 0]}>
            <cylinderGeometry args={[0.22, 0.15, 0.35, 12]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={1.2} roughness={0.2} />
         </mesh>
      </group>
   );
}

export function SampleRockPrimitive() {
   return (
      <mesh position={[0, 0.35, 0]}>
         <dodecahedronGeometry args={[0.35, 0]} />
         <meshStandardMaterial color={COLORS.sampleGlow} emissive={COLORS.sampleGlow} emissiveIntensity={0.75} roughness={0.4} />
      </mesh>
   );
}

export function CratePrimitive() {
   return (
      <mesh position={[0, 0.35, 0]}>
         <boxGeometry args={[0.7, 0.7, 0.7]} />
         <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
   );
}

export function CapsulePrimitive() {
   return (
      <group>
         {/* Conical reentry capsule */}
         <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.8, 1.8, 2.2, 16]} />
            <meshStandardMaterial color={COLORS.capsule} roughness={0.5} />
         </mesh>
         {/* Heat shield base */}
         <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[1.82, 1.75, 0.16, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
         </mesh>
      </group>
   );
}

export function AstronautFigure() {
   return (
      <group>
         {/* Legs */}
         <mesh position={[-0.12, 0.38, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.75, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
         </mesh>
         <mesh position={[0.12, 0.38, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.75, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
         </mesh>
         {/* Torso & EVA life-support backpack */}
         <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.22, 0.24, 0.62, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.08, -0.22]}>
            <boxGeometry args={[0.35, 0.5, 0.22]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
         </mesh>
         {/* Helmet with reflective gold visor */}
         <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.52, 0.12]}>
            <sphereGeometry args={[0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
         </mesh>
      </group>
   );
}
