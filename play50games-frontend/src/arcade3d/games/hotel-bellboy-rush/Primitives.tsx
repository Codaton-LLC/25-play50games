"use client";

// Stand-ins drawn only while a GLB is missing or broken (every model here has its GLB). Bevelled,
// two or three tones, the same size and facing as the fitted GLB.
import { useEffect, useMemo, type ReactNode } from "react";
import { MeshStandardMaterial, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { PLANTER_SIZE, SOFA_SIZE } from "./rules";

function useDisposable<T extends { dispose(): void }>(make: () => T[]): T[] {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const items = useMemo(make, []);
   useEffect(() => () => items.forEach((item) => item.dispose()), [items]);
   return items;
}

const rounded = (w: number, h: number, d: number, r: number, x = 0, y = h / 2, z = 0): BufferGeometry =>
   new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)).translate(x, y, z);

/** A rounded box (sized here, never scaled again). */
function Rb({ size, at = [0, 0, 0], color, r = 0.03, metal = 0, rough = 0.6, emissive }: {
   size: [number, number, number];
   at?: [number, number, number];
   color: string;
   r?: number;
   metal?: number;
   rough?: number;
   emissive?: string;
}) {
   const [geometry] = useDisposable(() => [rounded(size[0], size[1], size[2], r, 0, 0, 0)]);
   return (
      <mesh geometry={geometry} position={at}>
         <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.6 : 0} />
      </mesh>
   );
}

export function BellboyFigure() {
   return (
      <group>
         <Rb size={[0.13, 0.82, 0.16]} at={[0.09, 0.41, 0]} color={COLORS.trousers} r={0.05} />
         <Rb size={[0.13, 0.82, 0.16]} at={[-0.09, 0.41, 0]} color={COLORS.trousers} r={0.05} />
         <Rb size={[0.42, 0.6, 0.26]} at={[0, 1.12, 0]} color={COLORS.jacket} r={0.08} />
         <Rb size={[0.1, 0.55, 0.1]} at={[0.27, 1.1, 0]} color={COLORS.jacket} r={0.04} />
         <Rb size={[0.1, 0.55, 0.1]} at={[-0.27, 1.1, 0]} color={COLORS.jacket} r={0.04} />
         <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
            <meshStandardMaterial color={COLORS.jacket} roughness={0.5} />
         </mesh>
         <Rb size={[0.02, 0.3, 0.02]} at={[0, 1.1, 0.135]} color={COLORS.brass} r={0.008} metal={0.6} rough={0.35} />
      </group>
   );
}

/** The trolley, its long side along local z (the pull), 1.55 m tall. */
export function TrolleyPrimitive() {
   return (
      <group>
         <Rb size={[0.62, 0.08, 0.92]} at={[0, 0.2, 0]} color={COLORS.wood} r={0.03} />
         <Rb size={[0.66, 0.04, 0.96]} at={[0, 0.25, 0]} color={COLORS.brass} r={0.015} metal={0.7} rough={0.3} />
         {[-0.42, 0.42].map((z) => (
            <Rb key={z} size={[0.05, 1.3, 0.05]} at={[0, 0.9, z]} color={COLORS.brass} r={0.02} metal={0.7} rough={0.3} />
         ))}
         <Rb size={[0.05, 0.05, 0.9]} at={[0, 1.53, 0]} color={COLORS.brass} r={0.02} metal={0.7} rough={0.3} />
         {/* the near crossbar he holds (cart.ts HANDLE_Y / HANDLE_AHEAD) */}
         <Rb size={[0.5, 0.04, 0.04]} at={[0, 0.89, 0.37]} color={COLORS.brass} r={0.015} metal={0.7} rough={0.3} />
         {[-0.25, 0.25].map((x) => [-0.38, 0.38].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.08, z]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.07, 0.07, 0.05, 14]} />
               <meshStandardMaterial color={COLORS.wainscot} roughness={0.8} />
            </mesh>
         )))}
      </group>
   );
}

export function SuitcasePrimitive() {
   return (
      <group>
         <Rb size={[0.4, 0.55, 0.2]} at={[0, 0.28, 0]} color={COLORS.suitcase} r={0.05} />
         <Rb size={[0.42, 0.04, 0.22]} at={[0, 0.3, 0]} color={COLORS.brass} r={0.01} metal={0.6} rough={0.4} />
         <Rb size={[0.14, 0.04, 0.03]} at={[0, 0.58, 0]} color={COLORS.wainscot} r={0.01} />
      </group>
   );
}

export function ElevatorPrimitive() {
   return (
      <group>
         <Rb size={[0.16, 2.3, 1.46]} at={[0, 1.15, 0]} color={COLORS.brassDeep} r={0.03} metal={0.6} rough={0.35} />
         <Rb size={[0.17, 2.2, 0.02]} at={[-0.005, 1.1, 0]} color={COLORS.wainscot} r={0.005} />
      </group>
   );
}

export function DeskPrimitive() {
   return (
      <group>
         <Rb size={[2.2, 0.95, 0.9]} at={[0, 0.475, 0]} color={COLORS.wood} r={0.05} />
         <Rb size={[2.26, 0.06, 0.96]} at={[0, 0.98, 0]} color={COLORS.marble} r={0.02} rough={0.25} />
         <Rb size={[2.0, 0.06, 0.02]} at={[0, 0.7, 0.455]} color={COLORS.brass} r={0.01} metal={0.6} rough={0.35} />
      </group>
   );
}

export function BellPrimitive() {
   return (
      <group>
         <Rb size={[0.17, 0.03, 0.17]} at={[0, 0.015, 0]} color={COLORS.woodDark} r={0.01} />
         <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.065, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.8} roughness={0.25} />
         </mesh>
      </group>
   );
}

export function KeyCardPrimitive() {
   return <Rb size={[0.34, 0.02, 0.5]} at={[0, 0.01, 0]} color={COLORS.accent} r={0.008} emissive={COLORS.accent} />;
}

export function GuestPrimitive() {
   return (
      <group>
         <Rb size={[0.32, 0.85, 0.22]} at={[0, 0.425, 0]} color={COLORS.guestTrim} r={0.08} />
         <Rb size={[0.4, 0.62, 0.26]} at={[0, 1.15, 0]} color={COLORS.guest} r={0.1} />
         <mesh position={[0, 1.58, 0]}>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
      </group>
   );
}

function InstancedParts({ spots, parts }: { spots: readonly InstanceSpot[]; parts: { geometry: BufferGeometry; color: string; metal?: number; rough?: number }[] }) {
   const mats = useDisposable(() => parts.map((p) => new MeshStandardMaterial({ color: p.color, metalness: p.metal ?? 0, roughness: p.rough ?? 0.65 })));
   useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
   const out: ReactNode[] = parts.map((p, i) => (
      <Instanced key={i} spots={spots}>
         <primitive object={p.geometry} attach="geometry" />
         <primitive object={mats[i]} attach="material" />
      </Instanced>
   ));
   return <>{out}</>;
}

/** Room door stand-in, authored facing -x like the turned GLB: 1.09 m wide, 2.10 m tall. */
export function DoorsPrimitive({ spots }: { spots: readonly InstanceSpot[] }) {
   const parts = useMemo(() => [
      { geometry: rounded(0.12, 2.1, 1.09, 0.02), color: COLORS.wood },
      { geometry: rounded(0.06, 0.06, 0.16, 0.02, -0.08, 1.02, 0.38), color: COLORS.brass, metal: 0.7, rough: 0.3 },
   ], []);
   return <InstancedParts spots={spots} parts={parts} />;
}

/** Planter stand-in like the GLB (long side along x before its spot's quarter turn). */
export function PlantersPrimitive({ spots }: { spots: readonly InstanceSpot[] }) {
   const parts = useMemo(() => [
      { geometry: rounded(PLANTER_SIZE.z, 0.42, PLANTER_SIZE.x, 0.04), color: COLORS.woodDark },
      { geometry: rounded(PLANTER_SIZE.z * 0.9, 0.36, PLANTER_SIZE.x * 0.8, 0.15, 0, 0.6), color: COLORS.leaf },
   ], []);
   return <InstancedParts spots={spots} parts={parts} />;
}

/** Sofa stand-in like the GLB (long side along x before its spot's quarter turn, the seat towards +z). */
export function SofasPrimitive({ spots }: { spots: readonly InstanceSpot[] }) {
   const parts = useMemo(() => [
      { geometry: rounded(SOFA_SIZE.z, 0.42, SOFA_SIZE.x, 0.06), color: COLORS.sofa },
      { geometry: rounded(SOFA_SIZE.z, 0.45, 0.2, 0.06, 0, 0.62, -SOFA_SIZE.x / 2 + 0.1), color: COLORS.sofaCushion },
   ], []);
   return <InstancedParts spots={spots} parts={parts} />;
}
