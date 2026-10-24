"use client";

// Stand-ins for the snowman and a pine. Drawn only when the GLB is missing.
export const COLORS = {
   snow: "#f8fafc",
   shade: "#bfdbfe",
   ice: "#e0f2fe",
   fort: "#f8fafc",
   fortCap: "#bae6fd",
   pine: "#166534",
   trunk: "#92400e",
   skin: "#fdba74",
   fence: "#e2e8f0",
   rail: "#cbd5e1",
   skyTop: "#bae6fd",
   skyBottom: "#f8fafc",
   fog: "#e0f2fe",
} as const;

export function drawSnow(ctx: CanvasRenderingContext2D, width: number, height: number): void {
   ctx.fillStyle = COLORS.snow;
   ctx.fillRect(0, 0, width, height);
   ctx.fillStyle = COLORS.shade;
   for (let i = 0; i < 90; i++) {
      const x = (i * 97) % width;
      const y = (i * 53) % height;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
   }
}

export function SnowmanStandIn() {
   return (
      <group>
         <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.42, 16, 12]} />
            <meshStandardMaterial color={COLORS.snow} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color={COLORS.snow} roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.08, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.06, 0.28, 8]} />
            <meshStandardMaterial color="#fb923c" />
         </mesh>
         <mesh position={[-0.1, 1.14, 0.24]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#0f172a" />
         </mesh>
         <mesh position={[0.1, 1.14, 0.24]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#0f172a" />
         </mesh>
      </group>
   );
}

export function KidStandIn({ color }: { color: string }) {
   return (
      <group>
         <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.22, 0.5, 6, 10]} />
            <meshStandardMaterial color={COLORS.snow} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} />
         </mesh>
         <mesh position={[0, 1.16, 0]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color={color} />
         </mesh>
         <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.045, 8, 14]} />
            <meshStandardMaterial color={color} />
         </mesh>
      </group>
   );
}

export function Beanie({ color }: { color: string }) {
   return (
      <mesh position={[0, 0.06, 0]}>
         <sphereGeometry args={[0.22, 10, 8]} />
         <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
   );
}

export function Scarf({ color }: { color: string }) {
   return (
      <mesh rotation={[Math.PI / 2, 0, 0.2]}>
         <torusGeometry args={[0.16, 0.045, 6, 12]} />
         <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
   );
}
