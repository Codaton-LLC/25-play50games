"use client";

// Bevelled stand-ins (two or three tones) until the farm GLBs are in the manifest.
// Pieces are authored at their real size. Instanced decor stays unit-sized in the scene.
import { COLORS } from "./looks";
import { FARMER_HEIGHT } from "./assets";

export function TractorPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.42, 0.15]}>
            <boxGeometry args={[1.15, 0.38, 1.7]} />
            <meshStandardMaterial color={COLORS.tractorDark} roughness={0.62} />
         </mesh>
         <mesh position={[0, 0.72, 0.35]}>
            <boxGeometry args={[1.02, 0.32, 1.15]} />
            <meshStandardMaterial color={COLORS.tractor} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.15, -0.15]}>
            <boxGeometry args={[1.05, 0.72, 0.95]} />
            <meshStandardMaterial color={COLORS.tractor} roughness={0.48} />
         </mesh>
         <mesh position={[0, 1.22, 0.28]}>
            <boxGeometry args={[0.92, 0.48, 0.08]} />
            <meshStandardMaterial color={COLORS.cab} roughness={0.2} metalness={0.15} />
         </mesh>
         <mesh position={[0, 0.55, 0.95]}>
            <boxGeometry args={[0.7, 0.28, 0.45]} />
            <meshStandardMaterial color={COLORS.tractorDark} roughness={0.55} />
         </mesh>
         <mesh position={[0.62, 0.38, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 12]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
         <mesh position={[-0.62, 0.38, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 12]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
         <mesh position={[0.62, 0.32, -0.62]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
         <mesh position={[-0.62, 0.32, -0.62]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
         <mesh position={[0.62, 0.38, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.24, 8]} />
            <meshStandardMaterial color={COLORS.hub} roughness={0.4} metalness={0.3} />
         </mesh>
         <mesh position={[-0.62, 0.38, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.24, 8]} />
            <meshStandardMaterial color={COLORS.hub} roughness={0.4} metalness={0.3} />
         </mesh>
      </group>
   );
}

export function TrailerPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[1.35, 0.16, 2.05]} />
            <meshStandardMaterial color={COLORS.trailerBed} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[1.22, 0.08, 1.85]} />
            <meshStandardMaterial color={COLORS.trailer} roughness={0.62} />
         </mesh>
         <mesh position={[0.62, 0.48, 0]}>
            <boxGeometry args={[0.08, 0.28, 2.05]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.65} />
         </mesh>
         <mesh position={[-0.62, 0.48, 0]}>
            <boxGeometry args={[0.08, 0.28, 2.05]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.65} />
         </mesh>
         <mesh position={[0.55, 0.22, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 10]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
         <mesh position={[-0.55, 0.22, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 10]} />
            <meshStandardMaterial color={COLORS.wheel} roughness={0.8} />
         </mesh>
      </group>
   );
}

/** Open barn frame. The bay stays visible from the chase camera. */
export function BarnFrame() {
   return (
      <group>
         <mesh position={[-3.6, 1.35, 0]}>
            <boxGeometry args={[0.28, 2.7, 6.4]} />
            <meshStandardMaterial color={COLORS.barn} roughness={0.62} />
         </mesh>
         <mesh position={[3.6, 1.35, 0]}>
            <boxGeometry args={[0.28, 2.7, 6.4]} />
            <meshStandardMaterial color={COLORS.barn} roughness={0.62} />
         </mesh>
         <mesh position={[0, 1.45, 3.05]}>
            <boxGeometry args={[7.5, 2.9, 0.28]} />
            <meshStandardMaterial color={COLORS.barnDark} roughness={0.6} />
         </mesh>
         <mesh position={[0, 2.85, 1.7]}>
            <boxGeometry args={[7.6, 0.16, 2.8]} />
            <meshStandardMaterial color={COLORS.barnTrim} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[6.6, 0.08, 5.8]} />
            <meshStandardMaterial color={COLORS.soilDark} roughness={0.85} />
         </mesh>
      </group>
   );
}

/** Seated stand-in, 1.78 m from boot to crown if he stood. The pose is the seat. */
export function FarmerFigure() {
   const s = FARMER_HEIGHT / 1.78;
   return (
      <group scale={s}>
         <mesh position={[0.16, 0.28, 0.28]} rotation={[1.15, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.1, 0.48, 8]} />
            <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
         </mesh>
         <mesh position={[-0.16, 0.28, 0.28]} rotation={[1.15, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.1, 0.48, 8]} />
            <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
         </mesh>
         <mesh position={[0.16, 0.12, 0.48]}>
            <boxGeometry args={[0.14, 0.1, 0.22]} />
            <meshStandardMaterial color={COLORS.boot} roughness={0.75} />
         </mesh>
         <mesh position={[-0.16, 0.12, 0.48]}>
            <boxGeometry args={[0.14, 0.1, 0.22]} />
            <meshStandardMaterial color={COLORS.boot} roughness={0.75} />
         </mesh>
         <mesh position={[0, 0.72, -0.02]}>
            <boxGeometry args={[0.46, 0.42, 0.28]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.58} />
         </mesh>
         <mesh position={[0, 0.78, 0.1]}>
            <boxGeometry args={[0.48, 0.1, 0.08]} />
            <meshStandardMaterial color={COLORS.tractor} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.24, 0]}>
            <cylinderGeometry args={[0.17, 0.15, 0.08, 10]} />
            <meshStandardMaterial color={COLORS.scarecrowHat} roughness={0.6} />
         </mesh>
         <mesh position={[0.28, 0.7, 0.22]} rotation={[0.8, 0, -0.4]}>
            <cylinderGeometry args={[0.06, 0.07, 0.42, 8]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.6} />
         </mesh>
         <mesh position={[-0.28, 0.7, 0.22]} rotation={[0.8, 0, 0.4]}>
            <cylinderGeometry args={[0.06, 0.07, 0.42, 8]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function SiloPrimitive() {
   return (
      <group>
         <mesh position={[0.35, 0.35, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.siloLeg} roughness={0.55} />
         </mesh>
         <mesh position={[-0.35, 0.35, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.siloLeg} roughness={0.55} />
         </mesh>
         <mesh position={[0, 2.05, 0]}>
            <cylinderGeometry args={[0.85, 0.9, 2.6, 14]} />
            <meshStandardMaterial color={COLORS.silo} roughness={0.45} />
         </mesh>
         <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.92, 0.92, 0.16, 14]} />
            <meshStandardMaterial color={COLORS.siloBand} roughness={0.5} />
         </mesh>
         <mesh position={[0, 3.45, 0]}>
            <coneGeometry args={[0.95, 0.55, 14]} />
            <meshStandardMaterial color={COLORS.siloBand} roughness={0.5} />
         </mesh>
      </group>
   );
}

export function ScarecrowPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 1.4, 8]} />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.85, 0.1, 0.1]} />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[0.42, 0.48, 0.16]} />
            <meshStandardMaterial color={COLORS.scarecrowShirt} roughness={0.65} />
         </mesh>
         <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={COLORS.scarecrow} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.66, 0]}>
            <cylinderGeometry args={[0.2, 0.16, 0.1, 10]} />
            <meshStandardMaterial color={COLORS.scarecrowHat} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function TroughPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[1.15, 0.42, 0.48]} />
            <meshStandardMaterial color={COLORS.trough} roughness={0.45} metalness={0.25} />
         </mesh>
         <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.95, 0.12, 0.3]} />
            <meshStandardMaterial color={COLORS.water} roughness={0.2} metalness={0.1} />
         </mesh>
         <mesh position={[0.42, 0.12, 0.16]}>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.7} />
         </mesh>
         <mesh position={[-0.42, 0.12, 0.16]}>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.7} />
         </mesh>
      </group>
   );
}

export function GatePostPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.28, 1.4, 0.28]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.65} />
         </mesh>
         <mesh position={[0, 1.35, 0]}>
            <boxGeometry args={[0.36, 0.12, 0.36]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.45} />
         </mesh>
      </group>
   );
}
