"use client";

// The locomotive (code: no engine GLB yet) and the stand-ins drawn only while a GLB is missing or
// broken. Bevelled, two or three tones, at the fitted GLB's size and facing.
import { useEffect, useMemo, type ReactNode } from "react";
import { MeshStandardMaterial, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { CAR_HEIGHT, CAR_LENGTH, CAR_WIDTH } from "./assets";
import { COLORS, LOCO_LEN } from "./looks";

const rounded = (w: number, h: number, d: number, r: number, x = 0, y = h / 2, z = 0): BufferGeometry =>
   new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)).translate(x, y, z);

function useParts(make: () => InstancePart[]): InstancePart[] {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const parts = useMemo(make, []);
   useEffect(() => () => {
      for (const p of parts) {
         p.geometry.dispose();
         const m = p.material;
         if (Array.isArray(m)) m.forEach((x) => x.dispose());
         else m.dispose();
      }
   }, [parts]);
   return parts;
}

const mat = (color: string, rough = 0.6, metal = 0, emissive?: string) =>
   new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ?? "#000000", emissiveIntensity: emissive ? 0.7 : 0 });

/** The engine at the head of every train, nose towards -z (the buffers), origin under its nose on the rails. */
export function useLocoParts(): InstancePart[] {
   return useParts(() => [
      { geometry: rounded(CAR_WIDTH, CAR_HEIGHT * 0.92, LOCO_LEN - 0.6, 0.18, 0, CAR_HEIGHT * 0.46, LOCO_LEN / 2 + 0.3), material: mat(COLORS.loco, 0.45, 0.2) },
      { geometry: rounded(CAR_WIDTH * 0.96, CAR_HEIGHT * 0.7, 0.9, 0.3, 0, CAR_HEIGHT * 0.35, 0.45), material: mat(COLORS.locoDark, 0.4, 0.2) },
      { geometry: rounded(CAR_WIDTH * 0.84, CAR_HEIGHT * 0.22, 0.12, 0.04, 0, CAR_HEIGHT * 0.66, 0.06), material: mat(COLORS.locoWindow, 0.15, 0.4) },
      { geometry: rounded(CAR_WIDTH + 0.02, 0.12, LOCO_LEN - 0.8, 0.03, 0, CAR_HEIGHT * 0.3, LOCO_LEN / 2 + 0.3), material: mat(COLORS.locoStripe, 0.5, 0, COLORS.locoStripe) },
   ]);
}

/** A carriage stand-in, 2.0 m wide, origin at its middle on the rails. */
export function useCarParts(): InstancePart[] {
   return useParts(() => [
      { geometry: rounded(CAR_WIDTH, CAR_HEIGHT * 0.8, CAR_LENGTH - 0.2, 0.15, 0, CAR_HEIGHT * 0.4), material: mat("#e2e8f0", 0.5, 0.1) },
      { geometry: rounded(CAR_WIDTH + 0.02, CAR_HEIGHT * 0.22, CAR_LENGTH - 0.6, 0.04, 0, CAR_HEIGHT * 0.58), material: mat(COLORS.locoWindow, 0.2, 0.3) },
      { geometry: rounded(CAR_WIDTH * 0.9, 0.16, CAR_LENGTH - 0.4, 0.06, 0, CAR_HEIGHT * 0.85), material: mat(COLORS.accent, 0.5, 0.1) },
   ]);
}

/** A traveller stand-in (1.7 m), origin at the feet. */
export function useTravellerParts(): InstancePart[] {
   return useParts(() => [
      { geometry: rounded(0.32, 0.85, 0.22, 0.08), material: mat("#475569", 0.65) },
      { geometry: rounded(0.42, 0.62, 0.26, 0.1, 0, 1.16), material: mat("#e7e5e4", 0.6) },
      { geometry: rounded(0.22, 0.24, 0.22, 0.1, 0, 1.62), material: mat(COLORS.skin, 0.55) },
   ]);
}

function Rb({ size, at, color, r = 0.04, metal = 0, rough = 0.6 }: { size: [number, number, number]; at: [number, number, number]; color: string; r?: number; metal?: number; rough?: number }) {
   const geometry = useMemo(() => rounded(size[0], size[1], size[2], r, 0, 0, 0), [size, r]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry} position={at}>
         <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
      </mesh>
   );
}

export function WorkerFigure() {
   return (
      <group>
         <Rb size={[0.14, 0.78, 0.17]} at={[0.1, 0.39, 0]} color={COLORS.trousers} r={0.05} />
         <Rb size={[0.14, 0.78, 0.17]} at={[-0.1, 0.39, 0]} color={COLORS.trousers} r={0.05} />
         <Rb size={[0.46, 0.6, 0.28]} at={[0, 1.08, 0]} color={COLORS.vest} r={0.09} />
         <Rb size={[0.11, 0.55, 0.11]} at={[0.3, 1.05, 0]} color="#e2e8f0" r={0.04} />
         <Rb size={[0.11, 0.55, 0.11]} at={[-0.3, 1.05, 0]} color="#e2e8f0" r={0.04} />
         <Rb size={[0.24, 0.26, 0.24]} at={[0, 1.55, 0]} color={COLORS.skin} r={0.1} />
         <Rb size={[0.28, 0.08, 0.34]} at={[0, 1.72, 0.03]} color={COLORS.trousers} r={0.03} />
      </group>
   );
}

export function ClockPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.7, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.6, 0.6, 0.12, 32]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
         </mesh>
         <Rb size={[1.3, 0.08, 0.16]} at={[0, 0.04, 0]} color="#1e293b" r={0.03} />
      </group>
   );
}

export function SuitcasePrimitive() {
   return (
      <group>
         <Rb size={[0.42, 0.56, 0.22]} at={[0, 0.3, 0]} color={COLORS.suitcase} r={0.06} />
         <Rb size={[0.14, 0.05, 0.04]} at={[0, 0.6, 0]} color="#1e293b" r={0.015} />
      </group>
   );
}

export function BackpackPrimitive() {
   return (
      <group>
         <Rb size={[0.38, 0.5, 0.26]} at={[0, 0.25, 0]} color={COLORS.backpack} r={0.1} />
         <Rb size={[0.3, 0.18, 0.08]} at={[0, 0.2, 0.15]} color="#155e75" r={0.04} />
      </group>
   );
}

function InstancedRounded({ spots, parts }: { spots: readonly InstanceSpot[]; parts: { geometry: BufferGeometry; color: string; metal?: number }[] }) {
   const mats = useMemo(() => parts.map((p) => mat(p.color, 0.6, p.metal ?? 0)), [parts]);
   useEffect(() => () => {
      parts.forEach((p) => p.geometry.dispose());
      mats.forEach((m) => m.dispose());
   }, [parts, mats]);
   const out: ReactNode[] = parts.map((p, i) => (
      <Instanced key={i} spots={spots}>
         <primitive object={p.geometry} attach="geometry" />
         <primitive object={mats[i]} attach="material" />
      </Instanced>
   ));
   return <>{out}</>;
}

/** Stand-ins for the instanced props, each at its fitted GLB size (props: Scene.tsx). */
export function PropsPrimitive({ kind, spots }: { kind: "canopy" | "sign" | "bench" | "ticket" | "lamp"; spots: readonly InstanceSpot[] }) {
   const parts = useMemo(() => {
      switch (kind) {
         case "canopy":
            return [
               { geometry: rounded(4, 0.14, 2.1, 0.05, 0, 1.95), color: "#94a3b8" },
               { geometry: rounded(3.6, 0.45, 0.5, 0.06, 0, 0, 0).translate(0, 0.42, 0), color: "#78350f" },
            ];
         case "sign":
            return [
               { geometry: rounded(1.2, 0.55, 0.12, 0.04, 0, 0.62), color: "#1e293b" },
               { geometry: rounded(0.08, 0.6, 0.08, 0.02, 0, 0.3), color: "#64748b", metal: 0.4 },
            ];
         case "bench":
            return [
               { geometry: rounded(1.9, 0.12, 0.5, 0.04, 0, 0.44), color: "#78350f" },
               { geometry: rounded(1.9, 0.4, 0.08, 0.03, 0, 0.6, -0.24), color: "#78350f" },
            ];
         case "ticket":
            return [
               { geometry: rounded(0.9, 1.7, 0.85, 0.08), color: "#334155" },
               { geometry: rounded(0.6, 0.4, 0.05, 0.02, 0, 1.25, 0.44), color: "#38bdf8" },
            ];
         default:
            return [
               { geometry: rounded(0.12, 2.8, 0.12, 0.04), color: "#475569", metal: 0.4 },
               { geometry: rounded(0.5, 0.18, 0.5, 0.06, 0, 2.75), color: COLORS.glow },
            ];
      }
   }, [kind]);
   return <InstancedRounded spots={spots} parts={parts} />;
}
