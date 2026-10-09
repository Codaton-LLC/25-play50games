// Stand-ins while a GLB is missing, and the chute-mouth shapes (one merged mesh).
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import { DIVERTER_AT, FLIGHTS, MOUTH_M } from "./rules";

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

/** Gates sit at the chute ends (spine x + 4 m). One geometry for the page, so Retry does not allocate another. */
const GATES = DIVERTER_AT.map((at) => ({ x: at.x + 4, y: at.y, z: at.z }));
const MOUTH_GEOMETRY = mouthGeometry(GATES);

/** Four flight symbols, 0.9 m, lying flat on the chute ends so a pitched camera sees the shape. One draw call. */
export function ChuteMouths() {
   return (
      <mesh geometry={MOUTH_GEOMETRY} dispose={null}>
         <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.55} />
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
      // On the belt, just short of the chute end, in the x-z plane (a yaw-0.55 camera saw the old y-z shapes edge-on).
      const cx = gate.x - 0.2;
      const cy = gate.y + 0.06;
      const cz = gate.z;
      const ring = (count: number, radius: number, turn = 0) => {
         for (let i = 0; i < count; i++) {
            const a0 = turn + (i / count) * Math.PI * 2;
            const a1 = turn + ((i + 1) / count) * Math.PI * 2;
            push(cx, cy, cz, color);
            push(cx + Math.cos(a0) * radius, cy, cz + Math.sin(a0) * radius, color);
            push(cx + Math.cos(a1) * radius, cy, cz + Math.sin(a1) * radius, color);
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
            const [x0, z0] = corners[i];
            const [x1, z1] = corners[(i + 1) % 4];
            push(cx, cy, cz, color);
            push(cx + x0, cy, cz + z0, color);
            push(cx + x1, cy, cz + z1, color);
         }
      } else if (flight === 2) {
         const tip = r;
         const base = r * 0.86;
         push(cx - tip, cy, cz, color);
         push(cx + r * 0.55, cy, cz - base, color);
         push(cx + r * 0.55, cy, cz + base, color);
      } else ring(5, r, -Math.PI / 2);
   });
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
   geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
   geometry.computeVertexNormals();
   return geometry;
}
