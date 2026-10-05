"use client";

// Kitchen, chef and food stand-ins. Drawn until the GLBs are in core/modelManifest.ts.
// The chef stands on y = 0 and is about 1.6 tall. Food is centred on the group origin, ~0.9 across.
export const COLORS = {
   hat: "#f8fafc",
   apron: "#f1f5f9",
   skin: "#f6c7a1",
   scarf: "#ef4444",
   apple: "#ef4444",
   leaf: "#4ade80",
   bun: "#f6d7a8",
   patty: "#7c4a2d",
   lettuce: "#86efac",
   sock: "#d1d5db",
   patch: "#92400e",
   banana: "#facc15",
   tin: "#cbd5e1",
   tinBand: "#94a3b8",
   ring: "#9f1239",
   counter: "#c4a574",
   counterEdge: "#a16207",
   wall: "#3b2418",
   tile: "#78716c",
   floor: "#1c1410",
} as const;

export function Kitchen() {
   return (
      <group name="kitchen">
         <mesh position={[0, 3.4, -0.85]} receiveShadow={false}>
            <boxGeometry args={[10.2, 7.4, 0.18]} />
            <meshStandardMaterial color={COLORS.wall} />
         </mesh>
         <mesh position={[-2.2, 4.6, -0.74]}>
            <boxGeometry args={[1.1, 0.7, 0.06]} />
            <meshStandardMaterial color={COLORS.tile} />
         </mesh>
         <mesh position={[1.6, 5.1, -0.74]}>
            <boxGeometry args={[1.4, 0.55, 0.06]} />
            <meshStandardMaterial color="#44403c" />
         </mesh>
         <mesh position={[0, -0.28, 0.15]}>
            <boxGeometry args={[9.4, 0.56, 1.7]} />
            <meshStandardMaterial color={COLORS.counter} />
         </mesh>
         <mesh position={[0, 0.02, 0.15]}>
            <boxGeometry args={[9.2, 0.06, 1.55]} />
            <meshStandardMaterial color="#e7c99a" />
         </mesh>
         <mesh position={[0, -0.02, 0.95]}>
            <boxGeometry args={[9.4, 0.1, 0.08]} />
            <meshStandardMaterial color={COLORS.counterEdge} />
         </mesh>
      </group>
   );
}

export function ChefPrimitive() {
   return (
      <group name="chef-primitive">
         <mesh position={[0, 0.62, 0]}>
            <capsuleGeometry args={[0.38, 0.55, 6, 12]} />
            <meshStandardMaterial color={COLORS.apron} />
         </mesh>
         <mesh position={[0, 0.72, 0.28]}>
            <boxGeometry args={[0.55, 0.42, 0.08]} />
            <meshStandardMaterial color={COLORS.apron} />
         </mesh>
         <mesh position={[0, 1.05, 0.22]}>
            <boxGeometry args={[0.28, 0.16, 0.08]} />
            <meshStandardMaterial color={COLORS.scarf} />
         </mesh>
         <mesh position={[0, 1.22, 0]}>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshStandardMaterial color={COLORS.skin} />
         </mesh>
         <mesh position={[-0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#1c1917" />
         </mesh>
         <mesh position={[0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#1c1917" />
         </mesh>
         <mesh position={[0, 1.62, 0]}>
            <cylinderGeometry args={[0.34, 0.3, 0.42, 16]} />
            <meshStandardMaterial color={COLORS.hat} />
         </mesh>
         <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.48, 0.48, 0.08, 18]} />
            <meshStandardMaterial color={COLORS.hat} />
         </mesh>
      </group>
   );
}

export function ApplePrimitive() {
   return (
      <group>
         <mesh>
            <sphereGeometry args={[0.42, 18, 14]} />
            <meshStandardMaterial color={COLORS.apple} />
         </mesh>
         <mesh position={[0.08, 0.36, 0]} rotation={[0.4, 0, 0.6]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={COLORS.leaf} />
         </mesh>
      </group>
   );
}

export function BurgerPrimitive() {
   return (
      <group>
         <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.38, 16, 10]} />
            <meshStandardMaterial color={COLORS.bun} />
         </mesh>
         <mesh position={[0, 0, 0]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.36, 16, 10]} />
            <meshStandardMaterial color={COLORS.patty} />
         </mesh>
         <mesh position={[0, 0.16, 0]} scale={[1.05, 0.22, 1.05]}>
            <sphereGeometry args={[0.34, 14, 8]} />
            <meshStandardMaterial color={COLORS.lettuce} />
         </mesh>
         <mesh position={[0, 0.28, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.38, 16, 10]} />
            <meshStandardMaterial color={COLORS.bun} />
         </mesh>
      </group>
   );
}

export function SockPrimitive() {
   return (
      <group rotation={[0, 0, 0.4]}>
         <mesh>
            <capsuleGeometry args={[0.22, 0.42, 4, 10]} />
            <meshStandardMaterial color={COLORS.sock} />
         </mesh>
         <mesh position={[0.12, -0.16, 0.12]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color={COLORS.patch} />
         </mesh>
      </group>
   );
}

export function BananaPrimitive() {
   return (
      <mesh rotation={[0, 0, 0.7]}>
         <capsuleGeometry args={[0.16, 0.55, 4, 10]} />
         <meshStandardMaterial color={COLORS.banana} />
      </mesh>
   );
}

export function TinPrimitive() {
   return (
      <group>
         <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.62, 16]} />
            <meshStandardMaterial color={COLORS.tin} metalness={0.35} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.29, 0.29, 0.12, 16]} />
            <meshStandardMaterial color={COLORS.tinBand} />
         </mesh>
      </group>
   );
}

export function BadRing() {
   return (
      <mesh rotation-x={-Math.PI / 2}>
         <torusGeometry args={[0.5, 0.045, 8, 20]} />
         <meshBasicMaterial color={COLORS.ring} />
      </mesh>
   );
}
