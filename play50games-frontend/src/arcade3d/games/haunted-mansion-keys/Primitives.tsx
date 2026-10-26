// Deliberate 2-3 tone fallback primitives for Haunted Mansion Keys.
// Unit-sized decor geometries scaled by spot (never double-scaled).
import { useMemo } from "react";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry } from "three";
import { COLORS } from "./looks";
import type { KeyShape } from "./rules";

export function DetectiveFigure() {
   return (
      <group position={[0, 0, 0]}>
         {/* Legs */}
         <mesh position={[-0.14, 0.42, 0]}>
            <cylinderGeometry args={[0.09, 0.08, 0.84, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
         </mesh>
         <mesh position={[0.14, 0.42, 0]}>
            <cylinderGeometry args={[0.09, 0.08, 0.84, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
         </mesh>
         {/* Torso / Trench coat */}
         <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.44, 0.62, 0.28]} />
            <meshStandardMaterial color={COLORS.detectiveCoat} roughness={0.65} />
         </mesh>
         {/* Coat hem */}
         <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.26, 0.32, 0.36, 12]} />
            <meshStandardMaterial color={COLORS.detectiveCoat} roughness={0.65} />
         </mesh>
         {/* Head */}
         <mesh position={[0, 1.54, 0]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color={COLORS.detectiveSkin} roughness={0.5} />
         </mesh>
         {/* Fedora hat */}
         <mesh position={[0, 1.66, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.74, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.14, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
         </mesh>
      </group>
   );
}

export function KeyPrimitive({ color, shape }: { color: string; shape?: KeyShape }) {
   return (
      <group position={[0, 0, 0]}>
         {/* Key Ring/Bow */}
         <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
         </mesh>
         {/* Key Shaft */}
         <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.4, 8]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
         </mesh>
         {/* Bit */}
         <mesh position={[0.08, 0.02, 0]}>
            <boxGeometry args={[0.12, 0.12, 0.04]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
         </mesh>
         {/* Shape Emblem Plate */}
         {shape && (
            <mesh position={[0, 0.4, 0.03]}>
               {shape === "circle" && <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />}
               {shape === "square" && <boxGeometry args={[0.12, 0.12, 0.02]} />}
               {shape === "triangle" && <cylinderGeometry args={[0.08, 0.08, 0.02, 3]} />}
               {shape === "diamond" && <boxGeometry args={[0.1, 0.1, 0.02]} />}
               {shape === "star" && <cylinderGeometry args={[0.09, 0.09, 0.02, 5]} />}
               <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.4} roughness={0.2} />
            </mesh>
         )}
      </group>
   );
}

export function DoorPrimitive({ color, shape }: { color?: string | null; shape?: KeyShape | null }) {
   return (
      <group position={[0, 0, 0]}>
         {/* Frame */}
         <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[1.36, 2.2, 0.16]} />
            <meshStandardMaterial color={COLORS.doorTrim} roughness={0.7} />
         </mesh>
         {/* Panel Leaf */}
         <mesh position={[0, 1.05, 0.02]}>
            <boxGeometry args={[1.16, 2.05, 0.1]} />
            <meshStandardMaterial color={COLORS.door} roughness={0.65} />
         </mesh>
         {/* Brass Knob */}
         <mesh position={[0.42, 1.05, 0.09]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.6} />
         </mesh>
         {/* Plaque if locked */}
         {color && shape && (
            <group position={[0, 1.35, 0.08]}>
               <mesh>
                  <boxGeometry args={[0.26, 0.26, 0.03]} />
                  <meshStandardMaterial color="#1c1917" roughness={0.6} />
               </mesh>
               <mesh position={[0, 0, 0.02]}>
                  {shape === "circle" && <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />}
                  {shape === "square" && <boxGeometry args={[0.14, 0.14, 0.02]} />}
                  {shape === "triangle" && <cylinderGeometry args={[0.09, 0.09, 0.02, 3]} />}
                  {shape === "diamond" && <boxGeometry args={[0.12, 0.12, 0.02]} />}
                  {shape === "star" && <cylinderGeometry args={[0.1, 0.1, 0.02, 5]} />}
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} />
               </mesh>
            </group>
         )}
      </group>
   );
}

export function LeverPrimitive({ pulled }: { pulled: boolean }) {
   return (
      <group position={[0, 0, 0]}>
         {/* Wall Baseplate */}
         <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.28, 0.38, 0.06]} />
            <meshStandardMaterial color={COLORS.leverPlate} roughness={0.6} metalness={0.2} />
         </mesh>
         {/* Handle / Arm */}
         <group position={[0, -0.05, 0.05]} rotation-x={pulled ? 0.7 : -0.7}>
            <mesh position={[0, 0.16, 0]}>
               <cylinderGeometry args={[0.02, 0.02, 0.32, 8]} />
               <meshStandardMaterial color={COLORS.leverHandle} roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Grip Knob */}
            <mesh position={[0, 0.32, 0]}>
               <sphereGeometry args={[0.045, 8, 8]} />
               <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>
         </group>
      </group>
   );
}

export function ArmourStandPrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Base Stand */}
         <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.34, 0.36, 0.12, 12]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
         </mesh>
         {/* Legs / Greaves */}
         <mesh position={[-0.14, 0.46, 0]}>
            <cylinderGeometry args={[0.1, 0.08, 0.76, 8]} />
            <meshStandardMaterial color={COLORS.armour} roughness={0.4} metalness={0.5} />
         </mesh>
         <mesh position={[0.14, 0.46, 0]}>
            <cylinderGeometry args={[0.1, 0.08, 0.76, 8]} />
            <meshStandardMaterial color={COLORS.armour} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Cuirass / Breastplate */}
         <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.48, 0.65, 0.3]} />
            <meshStandardMaterial color={COLORS.armour} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Pauldrons (Shoulders) */}
         <mesh position={[-0.28, 1.35, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={COLORS.armourTrim} roughness={0.35} metalness={0.6} />
         </mesh>
         <mesh position={[0.28, 1.35, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={COLORS.armourTrim} roughness={0.35} metalness={0.6} />
         </mesh>
         {/* Close Helm */}
         <mesh position={[0, 1.64, 0]}>
            <cylinderGeometry args={[0.15, 0.16, 0.32, 10]} />
            <meshStandardMaterial color={COLORS.armour} roughness={0.4} metalness={0.5} />
         </mesh>
         {/* Visor slit */}
         <mesh position={[0, 1.64, 0.14]}>
            <boxGeometry args={[0.18, 0.04, 0.06]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
         </mesh>
      </group>
   );
}

export function GrandfatherClockPrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Case Base & Trunk */}
         <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[0.62, 2.1, 0.44]} />
            <meshStandardMaterial color={COLORS.clock} roughness={0.68} />
         </mesh>
         {/* Clock Bonnet Hood */}
         <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[0.7, 0.28, 0.48]} />
            <meshStandardMaterial color={COLORS.doorTrim} roughness={0.6} />
         </mesh>
         {/* Face dial */}
         <mesh position={[0, 1.76, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.4} />
         </mesh>
         {/* Pendulum glass window */}
         <mesh position={[0, 0.85, 0.23]}>
            <boxGeometry args={[0.32, 0.75, 0.02]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} roughness={0.1} />
         </mesh>
      </group>
   );
}

export function PaintingPrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Frame */}
         <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.95, 1.25, 0.08]} />
            <meshStandardMaterial color={COLORS.frame} roughness={0.45} metalness={0.3} />
         </mesh>
         {/* Canvas */}
         <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.78, 1.08, 0.02]} />
            <meshStandardMaterial color={COLORS.canvas} roughness={0.8} />
         </mesh>
      </group>
   );
}

export function TablePrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Tabletop */}
         <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[1.5, 0.08, 0.9]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
         </mesh>
         {/* Legs */}
         <mesh position={[-0.66, 0.34, -0.38]}>
            <boxGeometry args={[0.08, 0.68, 0.08]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
         </mesh>
         <mesh position={[0.66, 0.34, -0.38]}>
            <boxGeometry args={[0.08, 0.68, 0.08]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
         </mesh>
         <mesh position={[-0.66, 0.34, 0.38]}>
            <boxGeometry args={[0.08, 0.68, 0.08]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
         </mesh>
         <mesh position={[0.66, 0.34, 0.38]}>
            <boxGeometry args={[0.08, 0.68, 0.08]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
         </mesh>
      </group>
   );
}

export function ChairPrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Seat */}
         <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[0.46, 0.06, 0.46]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
         {/* Backrest */}
         <mesh position={[0, 0.78, -0.19]}>
            <boxGeometry args={[0.42, 0.64, 0.05]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
         {/* Legs */}
         <mesh position={[-0.18, 0.21, -0.18]}>
            <boxGeometry args={[0.05, 0.42, 0.05]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
         <mesh position={[0.18, 0.21, -0.18]}>
            <boxGeometry args={[0.05, 0.42, 0.05]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
         <mesh position={[-0.18, 0.21, 0.18]}>
            <boxGeometry args={[0.05, 0.42, 0.05]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
         <mesh position={[0.18, 0.21, 0.18]}>
            <boxGeometry args={[0.05, 0.42, 0.05]} />
            <meshStandardMaterial color={COLORS.chair} roughness={0.72} />
         </mesh>
      </group>
   );
}

export function BookshelfPrimitive() {
   return (
      <group position={[0, 0, 0]}>
         {/* Outer frame */}
         <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[1.2, 2.2, 0.42]} />
            <meshStandardMaterial color={COLORS.bookshelf} roughness={0.75} />
         </mesh>
         {/* Book shelf rows */}
         <mesh position={[0, 0.65, 0.04]}>
            <boxGeometry args={[1.06, 0.32, 0.32]} />
            <meshStandardMaterial color="#991b1b" roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.15, 0.04]}>
            <boxGeometry args={[1.06, 0.32, 0.32]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.65, 0.04]}>
            <boxGeometry args={[1.06, 0.32, 0.32]} />
            <meshStandardMaterial color="#065f46" roughness={0.8} />
         </mesh>
      </group>
   );
}

/**
 * The key's shape on a flat plate (so colour is never the only channel): a circle, square, triangle,
 * diamond or star, in the key's colour on a pale rim. Faces +z, centred on its origin, 0.2 m across.
 */
export function ShapePlate({ shape, color, size = 0.2 }: { shape: KeyShape; color: string; size?: number }) {
   const r = size / 2;
   return (
      <group>
         <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[r * 1.18, r * 1.18, 0.015, 24]} />
            <meshStandardMaterial color="#e7e5e4" roughness={0.5} />
         </mesh>
         <mesh position={[0, 0, 0.012]} rotation={shape === "diamond" ? [0, 0, Math.PI / 4] : shape === "triangle" || shape === "star" ? [Math.PI / 2, 0, 0] : [Math.PI / 2, 0, 0]}>
            {shape === "circle" && <cylinderGeometry args={[r * 0.8, r * 0.8, 0.012, 24]} />}
            {shape === "square" && <boxGeometry args={[r * 1.3, 0.012, r * 1.3]} />}
            {shape === "diamond" && <boxGeometry args={[r * 1.1, r * 1.1, 0.012]} />}
            {shape === "triangle" && <cylinderGeometry args={[r * 0.95, r * 0.95, 0.012, 3]} />}
            {shape === "star" && <cylinderGeometry args={[r * 0.95, r * 0.95, 0.012, 5]} />}
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
         </mesh>
      </group>
   );
}

/** A two-tone stone pedestal a key rests on (PEDESTAL_TOP tall, 0.5 m square). */
export function PedestalParts({ height }: { height: number }) {
   return (
      <>
         <mesh position={[0, height * 0.45, 0]}>
            <boxGeometry args={[0.38, height * 0.9, 0.38]} />
            <meshStandardMaterial color={COLORS.pedestal} roughness={0.8} />
         </mesh>
         <mesh position={[0, height * 0.95, 0]}>
            <boxGeometry args={[0.5, height * 0.1, 0.5]} />
            <meshStandardMaterial color={COLORS.pedestalTop} roughness={0.6} />
         </mesh>
      </>
   );
}
