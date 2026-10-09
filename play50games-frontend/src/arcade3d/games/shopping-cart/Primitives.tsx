// Stand-in primitives for shopping-cart when GLB assets are loading or missing.
import type { ReactNode } from "react";

export function CartPrimitive(): ReactNode {
   return (
      <group>
         {/* Lower chassis / wheels */}
         <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.6, 0.1, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
         </mesh>
         {/* Basket */}
         <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[0.55, 0.5, 0.85]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.8} wireframe={false} />
         </mesh>
         {/* Push handle at back (+z) */}
         <mesh position={[0, 0.94, -0.43]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
            <meshStandardMaterial color="#ef4444" roughness={0.4} />
         </mesh>
      </group>
   );
}

export function ShopperPrimitive({ color }: { color: string }): ReactNode {
   return (
      <group>
         <mesh position={[0, 0.8, 0]}>
            <capsuleGeometry args={[0.25, 0.9, 8, 16]} />
            <meshStandardMaterial color={color} roughness={0.7} />
         </mesh>
         {/* Head */}
         <mesh position={[0, 1.45, 0]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color="#fed7aa" roughness={0.6} />
         </mesh>
      </group>
   );
}

export function ProductPrimitive({ kind }: { kind: string }): ReactNode {
   const colors: Record<string, string> = {
      apple: "#ef4444",
      banana: "#facc15",
      burger: "#d97706",
      tinCan: "#94a3b8",
      bottle: "#38bdf8",
      bag: "#b45309",
      sock: "#a78bfa",
      battery: "#4ade80",
      fish: "#fb923c",
      gourd: "#10b981",
   };
   const color = colors[kind] ?? "#fb923c";

   if (kind === "tinCan" || kind === "battery" || kind === "bottle") {
      return (
         <mesh>
            <cylinderGeometry args={[0.16, 0.16, 0.36, 12]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={kind === "tinCan" ? 0.7 : 0.2} />
         </mesh>
      );
   }
   if (kind === "bag") {
      return (
         <mesh>
            <boxGeometry args={[0.3, 0.35, 0.2]} />
            <meshStandardMaterial color={color} roughness={0.6} />
         </mesh>
      );
   }
   if (kind === "burger") {
      return (
         <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.18, 12]} />
            <meshStandardMaterial color={color} roughness={0.5} />
         </mesh>
      );
   }
   return (
      <mesh>
         <sphereGeometry args={[0.2, 14, 14]} />
         <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
   );
}

export function ShelfUnitPrimitive({ width, length }: { width: number; length: number }): ReactNode {
   return (
      <group>
         {/* Main shelf unit */}
         <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[width, 2.0, length]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.5} metalness={0.2} />
         </mesh>
         {/* Base trim */}
         <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[width + 0.05, 0.2, length + 0.05]} />
            <meshStandardMaterial color="#64748b" roughness={0.8} />
         </mesh>
         {/* Accent top banner */}
         <mesh position={[0, 2.05, 0]}>
            <boxGeometry args={[width + 0.02, 0.1, length]} />
            <meshStandardMaterial color="#fb923c" roughness={0.4} />
         </mesh>
      </group>
   );
}
