"use client";

// Stand-ins until a GLB is on screen. Two or three tones, never a raw grey box.
import { COLORS } from "./looks";
import type { ExhibitKind } from "./rules";

export function StatueFallback({ kind }: { kind: ExhibitKind }) {
   if (kind === "penguin") return <Penguin />;
   if (kind === "dino") return <Dino />;
   if (kind === "robot") return <Robot />;
   return <Knight />;
}

function Knight() {
   return (
      <group>
         <mesh position={[0, 0.72, 0]}>
            <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.95} />
         </mesh>
         <mesh position={[0, 1.38, 0]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color="#78716c" roughness={0.9} />
         </mesh>
         <mesh position={[0, 1.42, 0.16]}>
            <boxGeometry args={[0.22, 0.06, 0.04]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.4} roughness={0.4} />
         </mesh>
      </group>
   );
}

function Robot() {
   return (
      <group>
         <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.18, 0.55, 4, 8]} />
            <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.32} />
         </mesh>
         <mesh position={[0, 1.05, 0.12]}>
            <boxGeometry args={[0.28, 0.08, 0.04]} />
            <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={0.8} roughness={0.3} />
         </mesh>
      </group>
   );
}

function Penguin() {
   return (
      <group>
         <mesh position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.22, 14, 12]} />
            <meshStandardMaterial color="#b8834f" metalness={0.6} roughness={0.45} />
         </mesh>
         <mesh position={[0, 0.58, 0.08]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshStandardMaterial color="#78716c" metalness={0.4} roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.56, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.04, 0.12, 8]} />
            <meshStandardMaterial color={COLORS.sneak} roughness={0.5} />
         </mesh>
      </group>
   );
}

function Dino() {
   return (
      <group>
         <mesh position={[0, 0.28, 0]} scale={[0.7, 0.55, 1.3]}>
            <sphereGeometry args={[0.28, 12, 10]} />
            <meshStandardMaterial color="#ebe1c8" roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.42, 0.38]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.75} />
         </mesh>
      </group>
   );
}

export function BenchFallback() {
   return (
      <group>
         <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.8, 0.08, 0.46]} />
            <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
         </mesh>
         <mesh position={[-0.8, 0.2, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.4]} />
            <meshStandardMaterial color="#44403c" roughness={0.8} />
         </mesh>
         <mesh position={[0.8, 0.2, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.4]} />
            <meshStandardMaterial color="#44403c" roughness={0.8} />
         </mesh>
      </group>
   );
}
