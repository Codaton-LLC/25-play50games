// Stand-ins while a GLB is missing, and the chute-mouth shapes (one merged mesh).
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import { FLIGHTS, MOUTH_M } from "./rules";

export function SuitcasePrimitive() {
   return (
      <mesh>
         <boxGeometry args={[0.5, 0.25, 0.7]} />
         <meshStandardMaterial color="#d4d4d8" />
      </mesh>
   );
}

export function PlanePrimitive() {
   return (
      <mesh rotation={[0, 0, Math.PI / 2]}>
         <boxGeometry args={[3.2, 0.4, 1.2]} />
         <meshStandardMaterial color="#e0f2fe" />
      </mesh>
   );
}

export function HandlerPrimitive() {
   return (
      <mesh position={[0, 0.78, 0]}>
         <capsuleGeometry args={[0.22, 0.9, 4, 8]} />
         <meshStandardMaterial color="#fb923c" />
      </mesh>
   );
}

/** Four flight symbols, 0.9 m, standing at the gates. One draw call. */
export function ChuteMouths({ gates }: { gates: ReadonlyArray<{ x: number; y: number; z: number }> }) {
   const geometry = useMemo(() => mouthGeometry(gates), [gates]);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.6} />
      </mesh>
   );
}

function mouthGeometry(gates: ReadonlyArray<{ x: number; y: number; z: number }>): BufferGeometry {
   const positions: number[] = [];
   const colors: number[] = [];
   const push = (x: number, y: number, z: number, hex: string) => {
      positions.push(x, y, z);
      const n = parseInt(hex.slice(1), 16);
      colors.push(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
   };
   gates.forEach((gate, flight) => {
      const color = FLIGHTS[flight].color;
      const r = MOUTH_M / 2;
      const cx = gate.x + 0.15;
      const cy = gate.y + 0.7;
      const cz = gate.z;
      const ring = (count: number, radius: number, turn = 0) => {
         for (let i = 0; i < count; i++) {
            const a0 = turn + (i / count) * Math.PI * 2;
            const a1 = turn + ((i + 1) / count) * Math.PI * 2;
            push(cx, cy, cz, color);
            push(cx, cy + Math.cos(a0) * radius, cz + Math.sin(a0) * radius, color);
            push(cx, cy + Math.cos(a1) * radius, cz + Math.sin(a1) * radius, color);
         }
      };
      if (flight === 0) ring(16, r);
      else if (flight === 1) {
         const s = r * 0.85;
         const corners = [
            [-s, -s],
            [s, -s],
            [s, s],
            [-s, s],
         ];
         for (let i = 0; i < 4; i++) {
            const [y0, z0] = corners[i];
            const [y1, z1] = corners[(i + 1) % 4];
            push(cx, cy, cz, color);
            push(cx, cy + y0, cz + z0, color);
            push(cx, cy + y1, cz + z1, color);
         }
      } else if (flight === 2) {
         const tip = r;
         const base = r * 0.86;
         push(cx, cy + tip, cz, color);
         push(cx, cy - r * 0.55, cz - base, color);
         push(cx, cy - r * 0.55, cz + base, color);
      } else ring(5, r, -Math.PI / 2);
   });
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
   geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
   geometry.computeVertexNormals();
   return geometry;
}
