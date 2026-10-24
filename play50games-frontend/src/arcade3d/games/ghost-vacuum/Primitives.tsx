import { COLORS } from "./looks";

/**
 * Deliberate, rounded vacuum pack stand-in with 2-3 tones from COLORS:
 * violet canister, charcoal chassis, and brass glowing pressure gauge.
 */
export function PackPrimitive() {
   return (
      <group name="pack-primitive">
         {/* Main canister body */}
         <mesh position={[0, 0.28, 0.006]}>
            <cylinderGeometry args={[0.135, 0.135, 0.52, 12]} />
            <meshStandardMaterial color={COLORS.hunterAccent} roughness={0.55} />
         </mesh>
         {/* Top canister dome cap */}
         <mesh position={[0, 0.54, 0.006]}>
            <sphereGeometry args={[0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.hunterDark} roughness={0.6} />
         </mesh>
         {/* Chassis frame & mounting bracket */}
         <mesh position={[0, 0.26, -0.09]}>
            <boxGeometry args={[0.26, 0.48, 0.08]} />
            <meshStandardMaterial color={COLORS.hunterDark} roughness={0.8} />
         </mesh>
         {/* Pressure gauge meter (brass bezel + glowing dial) */}
         <mesh position={[0, 0.38, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.03, 12]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.7} roughness={0.3} />
         </mesh>
         <mesh position={[0, 0.38, 0.158]}>
            <circleGeometry args={[0.05, 12]} />
            <meshBasicMaterial color={COLORS.candleFlame} />
         </mesh>
      </group>
   );
}

/**
 * Deliberate, rounded hunter stand-in:
 * mint green jumpsuit with charcoal panels, utility belt, knee pads, and boots.
 */
export function HunterPrimitive() {
   return (
      <group name="hunter-primitive">
         {/* Torso: mint jumpsuit */}
         <mesh position={[0, 0.91, 0]}>
            <capsuleGeometry args={[0.21, 0.44, 4, 10]} />
            <meshStandardMaterial color={COLORS.hunterSuit} roughness={0.7} />
         </mesh>
         {/* Chest panel / harness */}
         <mesh position={[0, 0.96, 0.12]}>
            <boxGeometry args={[0.24, 0.22, 0.08]} />
            <meshStandardMaterial color={COLORS.hunterDark} roughness={0.8} />
         </mesh>
         {/* Utility belt & buckle */}
         <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.07, 12]} />
            <meshStandardMaterial color={COLORS.hunterBoots} roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.72, 0.21]}>
            <boxGeometry args={[0.06, 0.05, 0.03]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.7} roughness={0.3} />
         </mesh>
         {/* Head, headset & beard */}
         <mesh position={[0, 1.38, 0]}>
            <sphereGeometry args={[0.175, 12, 10]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.8} />
         </mesh>
         {/* Headset band & ear cups */}
         <mesh position={[0, 1.48, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.175, 0.02, 6, 16, Math.PI]} />
            <meshStandardMaterial color={COLORS.hunterDark} roughness={0.6} />
         </mesh>
         {[-0.18, 0.18].map((x) => (
            <mesh key={x} position={[x, 1.38, 0]} rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
               <meshStandardMaterial color={COLORS.hunterAccent} roughness={0.6} />
            </mesh>
         ))}
         {/* Visor glasses */}
         <mesh position={[0, 1.41, 0.14]}>
            <boxGeometry args={[0.16, 0.05, 0.06]} />
            <meshStandardMaterial color={COLORS.hunterAccent} metalness={0.5} roughness={0.4} />
         </mesh>

         {/* Arms, legs and boots */}
         {[-1, 1].map((side) => (
            <group key={side}>
               {/* Arm: mint sleeve with dark glove */}
               <mesh position={[side * 0.26, 0.94, 0.08]} rotation={[0.45, 0, side * 0.2]}>
                  <capsuleGeometry args={[0.065, 0.32, 4, 8]} />
                  <meshStandardMaterial color={COLORS.hunterSuit} roughness={0.7} />
               </mesh>
               <mesh position={[side * 0.34, 0.76, 0.18]}>
                  <sphereGeometry args={[0.06, 8, 8]} />
                  <meshStandardMaterial color={COLORS.hunterDark} roughness={0.8} />
               </mesh>
               {/* Leg: charcoal pants with knee pad */}
               <mesh position={[side * 0.13, 0.36, 0]}>
                  <capsuleGeometry args={[0.075, 0.44, 4, 8]} />
                  <meshStandardMaterial color={COLORS.hunterDark} roughness={0.8} />
               </mesh>
               <mesh position={[side * 0.13, 0.36, 0.07]}>
                  <boxGeometry args={[0.1, 0.1, 0.04]} />
                  <meshStandardMaterial color={COLORS.hunterAccent} roughness={0.7} />
               </mesh>
               {/* Boot: rounded bevelled boot */}
               <mesh position={[side * 0.13, 0.065, 0.04]}>
                  <boxGeometry args={[0.14, 0.12, 0.24]} />
                  <meshStandardMaterial color={COLORS.hunterBoots} roughness={0.9} />
               </mesh>
               <mesh position={[side * 0.13, 0.015, 0.04]}>
                  <boxGeometry args={[0.15, 0.03, 0.25]} />
                  <meshStandardMaterial color="#475569" roughness={1} />
               </mesh>
            </group>
         ))}

         {/* Primitive pack mounted on back */}
         <group position={[0, 0.97, -0.19]} rotation={[0, Math.PI, 0]}>
            <PackPrimitive />
         </group>
      </group>
   );
}
