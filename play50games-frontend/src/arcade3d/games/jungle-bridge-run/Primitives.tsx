import { memo } from "react";
import { COLORS } from "./looks";

export const ExplorerPrimitive = memo(function ExplorerPrimitive() {
   return (
      <group name="fallback-explorer">
         {/* Legs */}
         <mesh position={[-0.14, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.09, 0.76, 12]} />
            <meshStandardMaterial color="#365314" roughness={0.7} />
         </mesh>
         <mesh position={[0.14, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.09, 0.76, 12]} />
            <meshStandardMaterial color="#365314" roughness={0.7} />
         </mesh>
         {/* Boots */}
         <mesh position={[-0.14, 0.08, 0.04]} castShadow>
            <boxGeometry args={[0.18, 0.16, 0.28]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
         </mesh>
         <mesh position={[0.14, 0.08, 0.04]} castShadow>
            <boxGeometry args={[0.18, 0.16, 0.28]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
         </mesh>
         {/* Torso / Shirt */}
         <mesh position={[0, 1.08, 0]} castShadow>
            <boxGeometry args={[0.44, 0.58, 0.28]} />
            <meshStandardMaterial color="#ca8a04" roughness={0.6} />
         </mesh>
         {/* Backpack */}
         <mesh position={[0, 1.12, -0.2]} castShadow>
            <boxGeometry args={[0.34, 0.44, 0.2]} />
            <meshStandardMaterial color="#713f12" roughness={0.8} />
         </mesh>
         {/* Head */}
         <mesh position={[0, 1.5, 0]} castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.4} />
         </mesh>
         {/* Explorer Hat */}
         <mesh position={[0, 1.62, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.04, 16]} />
            <meshStandardMaterial color="#a16207" roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.17, 0.14, 16]} />
            <meshStandardMaterial color="#a16207" roughness={0.7} />
         </mesh>
      </group>
   );
});

export const PlankLanePrimitive = memo(function PlankLanePrimitive({ width = 1.8, length = 24 }: { width?: number; length?: number }) {
   return (
      <group name="plank-lane">
         {/* Solid deck */}
         <mesh position={[0, -0.06, 0]} receiveShadow>
            <boxGeometry args={[width, 0.12, length]} />
            <meshStandardMaterial color={COLORS.planks} roughness={0.8} />
         </mesh>
         {/* Left and right rustic rope / wood guide rails */}
         <mesh position={[-width / 2 + 0.08, 0.35, 0]}>
            <boxGeometry args={[0.08, 0.08, length]} />
            <meshStandardMaterial color={COLORS.rope} roughness={0.7} />
         </mesh>
         <mesh position={[width / 2 - 0.08, 0.35, 0]}>
            <boxGeometry args={[0.08, 0.08, length]} />
            <meshStandardMaterial color={COLORS.rope} roughness={0.7} />
         </mesh>
      </group>
   );
});

export const RopeBridgePrimitive = memo(function RopeBridgePrimitive({ length = 8 }: { length?: number }) {
   return (
      <group name="rope-bridge">
         {/* Narrow suspended wooden planks */}
         <mesh position={[0, -0.05, 0]} receiveShadow>
            <boxGeometry args={[1.5, 0.1, length]} />
            <meshStandardMaterial color={COLORS.planksDark} roughness={0.85} />
         </mesh>
         {/* Swaying side suspension ropes */}
         <mesh position={[-0.8, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, length, 8]} />
            <meshStandardMaterial color={COLORS.rope} roughness={0.6} />
         </mesh>
         <mesh position={[0.8, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, length, 8]} />
            <meshStandardMaterial color={COLORS.rope} roughness={0.6} />
         </mesh>
      </group>
   );
});

export const TemplePillarPrimitive = memo(function TemplePillarPrimitive() {
   return (
      <group name="temple-pillar">
         {/* Square base */}
         <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.5, 1.1]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.9} />
         </mesh>
         {/* Carved shaft */}
         <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.48, 2.4, 16]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.85} />
         </mesh>
         {/* Ornate capital */}
         <mesh position={[0, 3.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 0.4, 1.15]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.9} />
         </mesh>
      </group>
   );
});

export const VinePrimitive = memo(function VinePrimitive({ width = 3.8 }: { width?: number }) {
   return (
      <group name="hanging-vine">
         {/* Low slide-under bar (at y = 0.9 m) */}
         <mesh position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, width, 12]} />
            <meshStandardMaterial color={COLORS.foliageDark} roughness={0.7} />
         </mesh>
         {/* Side hanging vertical vines */}
         <mesh position={[-width / 2, 1.8, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.0, 8]} />
            <meshStandardMaterial color={COLORS.foliage} roughness={0.7} />
         </mesh>
         <mesh position={[width / 2, 1.8, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.0, 8]} />
            <meshStandardMaterial color={COLORS.foliage} roughness={0.7} />
         </mesh>
      </group>
   );
});

export const LogPrimitive = memo(function LogPrimitive({ length = 1.8 }: { length?: number }) {
   return (
      <group name="jungle-log">
         <mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.22, length, 12]} />
            <meshStandardMaterial color={COLORS.logBark} roughness={0.9} />
         </mesh>
      </group>
   );
});

export const LavaVentPrimitive = memo(function LavaVentPrimitive() {
   return (
      <group name="lava-vent">
         {/* Surrounding scorched black rock ring */}
         <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[1.5, 0.08, 1.5]} />
            <meshStandardMaterial color={COLORS.lavaRock} roughness={0.95} />
         </mesh>
         {/* Glowing molten lava center */}
         <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[1.1, 0.04, 1.1]} />
            <meshStandardMaterial color={COLORS.lava} emissive={COLORS.lavaGlow} emissiveIntensity={0.8} />
         </mesh>
      </group>
   );
});

export const RuinGatePrimitive = memo(function RuinGatePrimitive() {
   return (
      <group name="ruin-gate">
         {/* Left pillar */}
         <mesh position={[-3.2, 2.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 5.0, 1.2]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.85} />
         </mesh>
         {/* Right pillar */}
         <mesh position={[3.2, 2.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 5.0, 1.2]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.85} />
         </mesh>
         {/* Heavy lintel arch */}
         <mesh position={[0, 5.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[7.8, 1.0, 1.5]} />
            <meshStandardMaterial color={COLORS.stone} roughness={0.85} />
         </mesh>
         {/* Moss accents */}
         <mesh position={[0, 5.75, 0]}>
            <boxGeometry args={[6.5, 0.15, 1.2]} />
            <meshStandardMaterial color={COLORS.moss} roughness={0.9} />
         </mesh>
      </group>
   );
});

export const WaterfallCliffPrimitive = memo(function WaterfallCliffPrimitive() {
   return (
      <group name="waterfall-cliff">
         {/* Rock wall */}
         <mesh position={[0, 14, 0]}>
            <boxGeometry args={[40, 32, 6]} />
            <meshStandardMaterial color={COLORS.cliff} roughness={0.9} />
         </mesh>
         {/* Cascading water sheet */}
         <mesh position={[0, 13, 3.1]}>
            <planeGeometry args={[12, 30]} />
            <meshStandardMaterial color={COLORS.water} roughness={0.1} transparent opacity={0.85} />
         </mesh>
      </group>
   );
});

export const VolcanoBackdropPrimitive = memo(function VolcanoBackdropPrimitive() {
   return (
      <group name="volcano-backdrop">
         {/* Mountain cone */}
         <mesh position={[0, 22, 0]}>
            <coneGeometry args={[35, 45, 16]} />
            <meshStandardMaterial color="#291c14" roughness={0.95} />
         </mesh>
         {/* Glowing crater rim */}
         <mesh position={[0, 44, 0]}>
            <cylinderGeometry args={[6, 8, 2, 16]} />
            <meshStandardMaterial color={COLORS.lava} emissive={COLORS.lavaGlow} emissiveIntensity={1.2} />
         </mesh>
      </group>
   );
});

export const JungleFernPrimitive = memo(function JungleFernPrimitive() {
   return (
      <group name="jungle-fern">
         <mesh position={[0, 0.5, 0]} castShadow>
            <coneGeometry args={[0.8, 1.2, 8]} />
            <meshStandardMaterial color={COLORS.foliage} roughness={0.7} />
         </mesh>
      </group>
   );
});
