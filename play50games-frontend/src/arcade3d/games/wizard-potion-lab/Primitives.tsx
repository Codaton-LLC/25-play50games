"use client";

// Bevelled stand-ins (two or three tones) until the wizard-potion-lab GLBs are in the manifest.
import { COLORS } from "./looks";
import { WIZARD_HEIGHT } from "./assets";

/** 1.70 m wizard: robe, open face, pointed hat. The GLB replaces this; the pose drives the rig. */
export function WizardFigure() {
   const s = WIZARD_HEIGHT / 1.7;
   return (
      <group scale={s}>
         <mesh position={[0.1, 0.1, 0.02]}>
            <boxGeometry args={[0.14, 0.12, 0.24]} />
            <meshStandardMaterial color={COLORS.boot} roughness={0.7} />
         </mesh>
         <mesh position={[-0.1, 0.1, 0.02]}>
            <boxGeometry args={[0.14, 0.12, 0.24]} />
            <meshStandardMaterial color={COLORS.boot} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.78, 10]} />
            <meshStandardMaterial color={COLORS.robe} roughness={0.62} />
         </mesh>
         <mesh position={[0, 0.78, 0.12]}>
            <boxGeometry args={[0.16, 0.5, 0.06]} />
            <meshStandardMaterial color={COLORS.robeDark} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.46, 0.1, 0.3]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.45} />
         </mesh>
         <mesh position={[0.2, 0.95, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.42, 8]} />
            <meshStandardMaterial color={COLORS.robeDark} roughness={0.6} />
         </mesh>
         <mesh position={[-0.2, 0.95, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.42, 8]} />
            <meshStandardMaterial color={COLORS.robeDark} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.32, 0.02]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.24, 0.1]}>
            <boxGeometry args={[0.12, 0.08, 0.06]} />
            <meshStandardMaterial color={COLORS.beard} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.46, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />
            <meshStandardMaterial color={COLORS.hat} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.58, 0]}>
            <coneGeometry args={[0.14, 0.26, 10]} />
            <meshStandardMaterial color={COLORS.hat} roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.7, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={0.8} roughness={0.35} />
         </mesh>
      </group>
   );
}

/** Alchemy table, 1.46 × 0.78 × 0.7. Feet on y = 0. */
export function TablePrimitive() {
   return (
      <group>
         <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[1.28, 0.64, 0.58]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.72} />
         </mesh>
         <mesh position={[0, 0.74, 0]}>
            <boxGeometry args={[1.46, 0.08, 0.7]} />
            <meshStandardMaterial color={COLORS.tableTop} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.7, 0.28]}>
            <boxGeometry args={[0.7, 0.04, 0.08]} />
            <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={0.35} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function BookPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.34, 0.06, 0.24]} />
            <meshStandardMaterial color={COLORS.book} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.075, 0]}>
            <boxGeometry args={[0.3, 0.02, 0.2]} />
            <meshStandardMaterial color={COLORS.bookPage} roughness={0.7} />
         </mesh>
      </group>
   );
}

/** Stand-in for the shared cauldron: 0.9 m across, two tones, feet on y = 0. */
export function CauldronPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.4, 0.3, 0.48, 16]} />
            <meshStandardMaterial color={COLORS.pot} roughness={0.42} metalness={0.28} />
         </mesh>
         <mesh position={[0, 0.5, 0]}>
            <torusGeometry args={[0.38, 0.055, 8, 18]} />
            <meshStandardMaterial color={COLORS.potRim} roughness={0.35} metalness={0.45} />
         </mesh>
         <mesh position={[0.46, 0.3, 0]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.07, 0.02, 6, 10]} />
            <meshStandardMaterial color={COLORS.potDark} roughness={0.4} metalness={0.3} />
         </mesh>
      </group>
   );
}

export function BallPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.06, 10]} />
            <meshStandardMaterial color={COLORS.potDark} roughness={0.45} metalness={0.2} />
         </mesh>
         <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial color="#a5f3fc" emissive={COLORS.glow} emissiveIntensity={0.45} roughness={0.15} metalness={0.05} />
         </mesh>
      </group>
   );
}
