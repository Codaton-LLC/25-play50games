"use client";

// Each level's room (levels.ts `theme`, looks.ts KITCHENS): props on the back wall, over the ovens and
// beyond the ends of the line. Visual only: rules.ts never reads this file, and nothing stands in the
// cook's strip in front of the counters.
import { useMemo } from "react";
import { Starfield } from "@/arcade3d/core/env";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { PizzaLevel } from "./levels";
import { KITCHENS } from "./looks";
import { kitchenHalf, stations } from "./rules";

/** Front face of the back wall (Scene: wall centre COUNTER_Z - 0.75, 0.2 thick). */
export const WALL_FACE = -2.05 - 0.65;
/** Clear of the cook's strip: dining props stand at least this far past the ends of the line. */
export const DINING_GAP = 1.5;

/** Evenly spread x positions along the back wall. */
function along(half: number, step: number): number[] {
   const out: number[] = [];
   for (let x = -half + step / 2; x <= half - step / 2 + 1e-9; x += step) out.push(x);
   return out;
}

/** Dining tables beyond both ends of the line (Restaurant Rush). */
export function diningTables(half: number): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const side of [-1, 1]) for (const dx of [0, 2.4]) for (const z of [-1.2, 1.4]) out.push({ x: side * (half + DINING_GAP + 1.0 + dx), y: 0, z });
   return out;
}

function Trattoria({ half }: { half: number }) {
   const xs = useMemo(() => along(half, 3), [half]);
   const shelves = useMemo(() => xs.map((x) => ({ x, y: 1.95, z: WALL_FACE + 0.13, sx: 1.8, sy: 0.06, sz: 0.26 })), [xs]);
   const pots = useMemo(() => xs.flatMap((x) => [-0.55, 0, 0.55].map((d) => ({ x: x + d, y: 2.06, z: WALL_FACE + 0.13, sx: 0.12, sy: 0.16, sz: 0.12 }))), [xs]);
   const herbs = useMemo(() => pots.map((p) => ({ x: p.x, y: 2.24, z: p.z, sx: 0.16, sy: 0.14, sz: 0.16 })), [pots]);
   const garlic = useMemo(() => xs.flatMap((x) => [0, 1, 2, 3, 4].map((k) => ({ x: x + 1.2, y: 1.85 - k * 0.13, z: WALL_FACE + 0.08, sx: 0.07, sy: 0.07, sz: 0.07 }))), [xs]);
   const chillies = useMemo(() => xs.flatMap((x) => [0, 1, 2, 3, 4].map((k) => ({ x: x - 1.25, y: 1.85 - k * 0.13, z: WALL_FACE + 0.08, sx: 0.04, sy: 0.1, sz: 0.04 }))), [xs]);
   const frames = useMemo(() => xs.map((x, i) => ({ x: x + (i % 2 ? 0.5 : -0.5), y: 2.85, z: WALL_FACE + 0.03, sx: 0.8, sy: 0.6, sz: 0.04 })), [xs]);
   return (
      <group name="trattoria">
         <Instanced spots={shelves}><boxGeometry /><meshStandardMaterial color="#78350f" roughness={0.7} /></Instanced>
         <Instanced spots={pots}><cylinderGeometry args={[1, 0.8, 1, 10]} /><meshStandardMaterial color="#c2410c" roughness={0.8} /></Instanced>
         <Instanced spots={herbs}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#16a34a" roughness={0.8} /></Instanced>
         <Instanced spots={garlic}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#fafaf9" roughness={0.7} /></Instanced>
         <Instanced spots={chillies}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#dc2626" roughness={0.5} /></Instanced>
         <Instanced spots={frames}><boxGeometry /><meshStandardMaterial color="#fde68a" emissive="#92400e" emissiveIntensity={0.2} roughness={0.6} /></Instanced>
      </group>
   );
}

function Rush({ half }: { half: number }) {
   const tickets = useMemo(() => along(half, 0.55).map((x, i) => ({ x, y: 1.5 - (i % 3) * 0.03, z: WALL_FACE + 0.04, rotY: 0, sx: 0.2, sy: 0.27, sz: 0.01 })), [half]);
   const tables = useMemo(() => diningTables(half), [half]);
   const tops = useMemo(() => tables.map((t) => ({ ...t, y: 0.74, sx: 0.6, sy: 0.04, sz: 0.6 })), [tables]);
   const legs = useMemo(() => tables.map((t) => ({ ...t, y: 0.37, sx: 0.06, sy: 0.74, sz: 0.06 })), [tables]);
   const chairs = useMemo(() => tables.flatMap((t) => [[-0.75, 0], [0.75, 0]].map(([dx, dz]) => ({ x: t.x + dx, y: 0.45, z: t.z + dz, sx: 0.42, sy: 0.9, sz: 0.42 }))), [tables]);
   const plates = useMemo(() => tables.map((t) => ({ ...t, y: 0.77, sx: 0.22, sy: 0.02, sz: 0.22 })), [tables]);
   return (
      <group name="restaurant-rush">
         <mesh position={[0, 1.66, WALL_FACE + 0.05]}>
            <boxGeometry args={[half * 2, 0.04, 0.04]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.3} />
         </mesh>
         <Instanced spots={tickets}><boxGeometry /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} roughness={0.9} /></Instanced>
         <mesh position={[0, 2.75, WALL_FACE + 0.03]}>
            <boxGeometry args={[3.2, 1.05, 0.05]} />
            <meshStandardMaterial color="#111827" roughness={0.8} />
         </mesh>
         {[0, 1, 2].map((k) => (
            <mesh key={k} position={[-0.3 + (k % 2) * 0.2, 3.0 - k * 0.25, WALL_FACE + 0.06]}>
               <boxGeometry args={[2.2 - k * 0.3, 0.06, 0.01]} />
               <meshBasicMaterial color="#fde047" toneMapped={false} />
            </mesh>
         ))}
         <Instanced spots={tops}><cylinderGeometry args={[1, 1, 1, 20]} /><meshStandardMaterial color="#dc2626" roughness={0.6} /></Instanced>
         <Instanced spots={plates}><cylinderGeometry args={[1, 1, 1, 16]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></Instanced>
         <Instanced spots={legs}><boxGeometry /><meshStandardMaterial color="#374151" roughness={0.5} /></Instanced>
         <Instanced spots={chairs}><boxGeometry /><meshStandardMaterial color="#1f2937" roughness={0.6} /></Instanced>
      </group>
   );
}

function Diner({ half }: { half: number }) {
   const clockX = half - 1.1;
   return (
      <group name="sunset-diner">
         {/* the sunset window: two glowing bands in a frame */}
         <mesh position={[-0.6, 2.75, WALL_FACE + 0.02]}>
            <boxGeometry args={[4.2, 1.5, 0.04]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
         </mesh>
         <mesh position={[-0.6, 3.05, WALL_FACE + 0.05]}>
            <boxGeometry args={[4.0, 0.7, 0.01]} />
            <meshBasicMaterial color="#fb923c" toneMapped={false} />
         </mesh>
         <mesh position={[-0.6, 2.4, WALL_FACE + 0.05]}>
            <boxGeometry args={[4.0, 0.62, 0.01]} />
            <meshBasicMaterial color="#f472b6" toneMapped={false} />
         </mesh>
         <mesh position={[-0.6, 2.38, WALL_FACE + 0.06]}>
            <circleGeometry args={[0.35, 24, 0, Math.PI]} />
            <meshBasicMaterial color="#fde047" toneMapped={false} />
         </mesh>
         {[-2, -0.6, 0.8].map((x) => (
            <mesh key={x} position={[x === -0.6 ? -0.6 : x, 2.75, WALL_FACE + 0.07]}>
               <boxGeometry args={[0.07, 1.5, 0.02]} />
               <meshStandardMaterial color="#e5e7eb" />
            </mesh>
         ))}
         {/* the big wall clock: tickets do not wait forever */}
         <mesh position={[clockX, 2.7, WALL_FACE + 0.05]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 32]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.3} roughness={0.5} />
         </mesh>
         <mesh position={[clockX, 2.7, WALL_FACE + 0.05]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.56, 0.05, 8, 32]} />
            <meshStandardMaterial color="#9d174d" roughness={0.5} />
         </mesh>
         <mesh position={[clockX, 2.85, WALL_FACE + 0.1]}>
            <boxGeometry args={[0.05, 0.32, 0.02]} />
            <meshStandardMaterial color="#111827" />
         </mesh>
         <mesh position={[clockX + 0.11, 2.7, WALL_FACE + 0.1]} rotation-z={-Math.PI / 2}>
            <boxGeometry args={[0.05, 0.22, 0.02]} />
            <meshStandardMaterial color="#111827" />
         </mesh>
         {/* a neon stripe along the wall */}
         <mesh position={[0, 1.55, WALL_FACE + 0.04]}>
            <boxGeometry args={[half * 2, 0.07, 0.03]} />
            <meshBasicMaterial color="#f472b6" toneMapped={false} />
         </mesh>
      </group>
   );
}

function Patio({ level, half }: { level: PizzaLevel; half: number }) {
   const ovens = useMemo(() => stations(level).filter((s) => s.id.startsWith("oven")), [level]);
   const domes = useMemo(() => ovens.map((o) => ({ x: o.x, y: 1.24, z: -2.15, sx: 0.72, sy: 0.6, sz: 0.62 })), [ovens]);
   const flues = useMemo(() => ovens.map((o) => ({ x: o.x, y: 2.2, z: -2.25, sx: 0.16, sy: 0.9, sz: 0.16 })), [ovens]);
   const mouths = useMemo(() => ovens.map((o) => ({ x: o.x, y: 1.42, z: -1.58, sx: 0.32, sy: 0.18, sz: 0.04 })), [ovens]);
   const bulbs = useMemo(() => {
      const out: InstanceSpot[] = [];
      const n = Math.round(half * 2 / 0.6);
      for (let i = 0; i <= n; i++) {
         const k = i / n;
         const span = (i % Math.ceil(n / 3)) / Math.ceil(n / 3);
         out.push({ x: -half + k * half * 2, y: 3.15 - Math.sin(span * Math.PI) * 0.3, z: WALL_FACE + 0.25, sx: 0.07, sy: 0.07, sz: 0.07 });
      }
      return out;
   }, [half]);
   return (
      <group name="night-patio">
         <Starfield count={500} seed={3} upperOnly />
         <Instanced spots={domes}><sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#9a3412" roughness={0.9} flatShading /></Instanced>
         <Instanced spots={flues}><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color="#44403c" roughness={0.8} /></Instanced>
         <Instanced spots={mouths}><boxGeometry /><meshBasicMaterial color="#f97316" toneMapped={false} /></Instanced>
         <Instanced spots={bulbs}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#fde68a" toneMapped={false} /></Instanced>
         {ovens.map((o) => <pointLight key={o.x} position={[o.x, 1.5, -1.2]} color="#fb923c" intensity={6} distance={4.5} decay={2} />)}
      </group>
   );
}

export default function Decor({ level }: { level: PizzaLevel }) {
   const look = KITCHENS[level.theme];
   const half = kitchenHalf(level);
   if (look.decor === "trattoria") return <Trattoria half={half} />;
   if (look.decor === "rush") return <Rush half={half} />;
   if (look.decor === "diner") return <Diner half={half} />;
   if (look.decor === "patio") return <Patio level={level} half={half} />;
   return null;
}
