"use client";

// Deliberate 2-3 tone stand-ins, drawn only when a GLB is missing or broken.
import { COLORS } from "./looks";
import { FIT } from "./assets";

/** 1.82 m Lifeguard: yellow shirt, red shorts, red rescue float. */
export function LifeguardFigure({ carrying = false }: { carrying?: boolean }) {
   const s = FIT.lifeguard / 1.82;
   return (
      <group scale={s}>
         {/* Legs */}
         <mesh position={[0.11, 0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.5, 8]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         <mesh position={[-0.11, 0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.5, 8]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         {/* Shorts */}
         <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.36, 0.28, 0.24]} />
            <meshStandardMaterial color={COLORS.guardShorts} roughness={0.5} />
         </mesh>
         {/* Torso (Guard shirt) */}
         <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[0.42, 0.44, 0.24]} />
            <meshStandardMaterial color={COLORS.guardShirt} roughness={0.5} />
         </mesh>
         {/* Red cross emblem on chest */}
         <mesh position={[0, 1.08, 0.13]}>
            <boxGeometry args={[0.14, 0.05, 0.02]} />
            <meshStandardMaterial color={COLORS.guardShorts} roughness={0.3} />
         </mesh>
         <mesh position={[0, 1.08, 0.13]}>
            <boxGeometry args={[0.05, 0.14, 0.02]} />
            <meshStandardMaterial color={COLORS.guardShorts} roughness={0.3} />
         </mesh>
         {/* Head */}
         <mesh position={[0, 1.42, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         {/* Cap */}
         <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.06, 12]} />
            <meshStandardMaterial color={COLORS.guardShorts} roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.48, 0.14]}>
            <boxGeometry args={[0.16, 0.02, 0.12]} />
            <meshStandardMaterial color={COLORS.guardShorts} roughness={0.4} />
         </mesh>
         {/* Rescue float on hand if carrying */}
         {carrying && (
            <group position={[0.32, 0.9, 0.15]} rotation={[0.4, 0, 0.2]}>
               <mesh>
                  <cylinderGeometry args={[0.07, 0.07, 0.48, 8]} />
                  <meshStandardMaterial color={COLORS.floatRed} roughness={0.35} />
               </mesh>
               <mesh position={[0, 0.15, 0]}>
                  <cylinderGeometry args={[0.075, 0.075, 0.08, 8]} />
                  <meshStandardMaterial color={COLORS.floatStrap} roughness={0.4} />
               </mesh>
            </group>
         )}
      </group>
   );
}

/** Swimmer NPC: bobbing in the water. */
export function SwimmerFigure() {
   return (
      <group>
         {/* Torso */}
         <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.4, 8]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         {/* Swim trunks / suit */}
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.22, 8]} />
            <meshStandardMaterial color={COLORS.swimmerSuit} roughness={0.5} />
         </mesh>
         {/* Head */}
         <mesh position={[0, 0.65, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         {/* Hair */}
         <mesh position={[0, 0.74, -0.02]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color={COLORS.hair} roughness={0.7} />
         </mesh>
         {/* Arms splash */}
         <mesh position={[0.26, 0.42, 0]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.05, 0.06, 0.35, 6]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         <mesh position={[-0.26, 0.42, 0]} rotation={[0, 0, 0.6]}>
            <cylinderGeometry args={[0.05, 0.06, 0.35, 6]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
      </group>
   );
}

/** 3 m Lifeguard tower with stilts, railing, and red roof. */
export function TowerPrimitive() {
   return (
      <group>
         {/* 4 Stilts */}
         {[-0.8, 0.8].map((x) =>
            [-0.8, 0.8].map((z) => (
               <mesh key={`${x}-${z}`} position={[x, 1.1, z]}>
                  <cylinderGeometry args={[0.06, 0.07, 2.2, 6]} />
                  <meshStandardMaterial color={COLORS.towerWood} roughness={0.7} />
               </mesh>
            )),
         )}
         {/* Platform */}
         <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[2.0, 0.12, 2.0]} />
            <meshStandardMaterial color={COLORS.towerWhite} roughness={0.5} />
         </mesh>
         {/* Railing */}
         <mesh position={[0, 2.6, 0.95]}>
            <boxGeometry args={[1.9, 0.68, 0.06]} />
            <meshStandardMaterial color={COLORS.towerRed} roughness={0.4} />
         </mesh>
         <mesh position={[0, 2.6, -0.95]}>
            <boxGeometry args={[1.9, 0.68, 0.06]} />
            <meshStandardMaterial color={COLORS.towerRed} roughness={0.4} />
         </mesh>
         <mesh position={[0.95, 2.6, 0]}>
            <boxGeometry args={[0.06, 0.68, 1.9]} />
            <meshStandardMaterial color={COLORS.towerRed} roughness={0.4} />
         </mesh>
         {/* Roof posts */}
         {[-0.85, 0.85].map((x) =>
            [-0.85, 0.85].map((z) => (
               <mesh key={`post-${x}-${z}`} position={[x, 2.85, z]}>
                  <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
                  <meshStandardMaterial color={COLORS.towerWhite} roughness={0.5} />
               </mesh>
            )),
         )}
         {/* Roof */}
         <mesh position={[0, 3.5, 0]}>
            <boxGeometry args={[2.2, 0.16, 2.2]} />
            <meshStandardMaterial color={COLORS.towerRed} roughness={0.4} />
         </mesh>
      </group>
   );
}

/** Rescue float / torpedo can. */
export function RescueFloatPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.48, 8]} />
            <meshStandardMaterial color={COLORS.floatRed} roughness={0.35} />
         </mesh>
         <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.1, 8]} />
            <meshStandardMaterial color={COLORS.floatStrap} roughness={0.4} />
         </mesh>
      </group>
   );
}

/** Rescue Jet Ski: sleek two-tone watercraft. */
export function JetSkiPrimitive() {
   return (
      <group>
         {/* Hull base */}
         <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.95, 0.28, 2.2]} />
            <meshStandardMaterial color={COLORS.jetSkiBlue} roughness={0.35} />
         </mesh>
         {/* Upper deck */}
         <mesh position={[0, 0.42, -0.1]}>
            <boxGeometry args={[0.82, 0.22, 1.8]} />
            <meshStandardMaterial color={COLORS.jetSkiWhite} roughness={0.3} />
         </mesh>
         {/* Seat */}
         <mesh position={[0, 0.58, 0.2]}>
            <boxGeometry args={[0.38, 0.18, 0.9]} />
            <meshStandardMaterial color={COLORS.jetSkiSeat} roughness={0.7} />
         </mesh>
         {/* Handlebars */}
         <mesh position={[0, 0.72, -0.55]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.62, 0.06, 0.08]} />
            <meshStandardMaterial color={COLORS.jetSkiSeat} roughness={0.4} />
         </mesh>
      </group>
   );
}

/** Beach lounger chair. */
export function BeachChairPrimitive() {
   return (
      <group>
         {/* Frame */}
         <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.65, 0.12, 1.4]} />
            <meshStandardMaterial color={COLORS.chairWhite} roughness={0.4} />
         </mesh>
         {/* Fabric lounger */}
         <mesh position={[0, 0.24, 0.1]}>
            <boxGeometry args={[0.55, 0.06, 1.1]} />
            <meshStandardMaterial color={COLORS.chairBlue} roughness={0.6} />
         </mesh>
         {/* Backrest */}
         <mesh position={[0, 0.44, -0.45]} rotation={[0.45, 0, 0]}>
            <boxGeometry args={[0.55, 0.06, 0.55]} />
            <meshStandardMaterial color={COLORS.chairBlue} roughness={0.6} />
         </mesh>
      </group>
   );
}

/** Cooler box. */
export function BeachCoolerPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.55, 0.38, 0.38]} />
            <meshStandardMaterial color={COLORS.coolerBlue} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.43, 0]}>
            <boxGeometry args={[0.58, 0.08, 0.4]} />
            <meshStandardMaterial color={COLORS.coolerWhite} roughness={0.3} />
         </mesh>
      </group>
   );
}

/** Beach Hut / Snack Stand. */
export function BeachHutPrimitive() {
   return (
      <group>
         <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[1.8, 1.9, 1.6]} />
            <meshStandardMaterial color={COLORS.hutWood} roughness={0.7} />
         </mesh>
         <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[2.2, 0.35, 2.0]} />
            <meshStandardMaterial color={COLORS.hutRoof} roughness={0.6} />
         </mesh>
      </group>
   );
}

/** Sandcastle. */
export function SandcastlePrimitive() {
   return (
      <group>
         <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.3, 0.38, 0.5, 8]} />
            <meshStandardMaterial color={COLORS.sandcastle} roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.24, 8]} />
            <meshStandardMaterial color={COLORS.sandcastle} roughness={0.8} />
         </mesh>
      </group>
   );
}

/** Two-tone code torus alert marker (#fb7185 / #f8fafc). */
export function AlertTorusMarker() {
   return (
      <group rotation={[-Math.PI / 2, 0, 0]}>
         <mesh position={[0, 0, 0.02]}>
            <torusGeometry args={[1.2, 0.08, 12, 32]} />
            <meshStandardMaterial
               color={COLORS.torusPink}
               emissive={COLORS.torusPink}
               emissiveIntensity={0.6}
               roughness={0.3}
            />
         </mesh>
         <mesh position={[0, 0, 0.05]}>
            <torusGeometry args={[1.32, 0.03, 8, 32]} />
            <meshStandardMaterial
               color={COLORS.torusWhite}
               emissive={COLORS.torusWhite}
               emissiveIntensity={0.4}
               roughness={0.2}
            />
         </mesh>
      </group>
   );
}
