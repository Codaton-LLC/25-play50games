"use client";

// Stand-ins, drawn only while a GLB is missing or broken. Gameplay parts at their drawn size (assets FIT);
// decor parts at 1 m like the fitted decor GLBs, so one spot scale serves both. Everything faces +z.
import { useEffect, useMemo } from "react";
import { BoxGeometry, CylinderGeometry, DodecahedronGeometry, MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Material } from "three";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { FIT } from "./assets";
import { COLORS } from "./looks";

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) => new MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const at = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

/** Builds parts once per mount and disposes of them on unmount. */
export function useParts(build: () => InstancePart[]): InstancePart[] {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const parts = useMemo(build, []);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            const m = p.material as Material | Material[];
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m.dispose();
         }
      },
      [parts]
   );
   return parts;
}

/** One <Instanced> per stand-in part (one draw call each for every spot). */
export function PartsInstanced({ spots, parts, name }: { spots: readonly InstanceSpot[]; parts: readonly InstancePart[]; name: string }) {
   if (spots.length === 0) return null;
   return (
      <>
         {parts.map((part, i) => (
            <Instanced key={i} spots={spots} name={`${name}-${i}`}>
               <primitive object={part.geometry} attach="geometry" />
               <primitive object={part.material} attach="material" />
            </Instanced>
         ))}
      </>
   );
}

export const rockParts = (): InstancePart[] => [
   { geometry: at(new DodecahedronGeometry(FIT.rockWidth / 2, 1).scale(1, 0.7, 1), 0, FIT.rockWidth * 0.32, 0), material: mat(COLORS.rock, { flatShading: true }) },
];
export const sampleParts = (): InstancePart[] => [
   { geometry: at(new DodecahedronGeometry(FIT.sampleSize / 2, 0), 0, FIT.sampleSize / 2, 0), material: mat(COLORS.sampleGlow, { emissive: COLORS.sampleGlow, emissiveIntensity: 0.5, flatShading: true }) },
];
export const boulderParts = (): InstancePart[] => [
   // centred on its middle like the fitted GLB (the pool spins it about its centre)
   { geometry: new DodecahedronGeometry(FIT.boulderWidth / 2, 1), material: mat(COLORS.boulder, { flatShading: true }) },
];
/** 1 m long along z, layered: a body and a lighter top course */
export const wallParts = (): InstancePart[] => [
   { geometry: at(new BoxGeometry(0.95, 0.3, 1), 0, 0.15, 0), material: mat(COLORS.mesa) },
   { geometry: at(new BoxGeometry(0.8, 0.1, 0.95), 0, 0.35, 0), material: mat(COLORS.groundDark) },
];
/** 1 m wide, 0.32 high, flat-topped */
export const mesaParts = (): InstancePart[] => [
   { geometry: at(new CylinderGeometry(0.4, 0.5, 0.32, 9), 0, 0.16, 0), material: mat(COLORS.mesa, { flatShading: true }) },
];

export function RoverPrimitive() {
   return (
      <group scale={FIT.roverLength / 2.0}>
         <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.5, 0.45, 2.0]} />
            <meshStandardMaterial color={COLORS.rover} roughness={0.6} metalness={0.2} />
         </mesh>
         <mesh position={[0, 0.85, 0.1]}>
            <boxGeometry args={[1.2, 0.2, 1.4]} />
            <meshStandardMaterial color={COLORS.roverMetal} roughness={0.4} metalness={0.6} />
         </mesh>
         <mesh position={[0.4, 1.25, 0.6]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.roverMetal} metalness={0.8} />
         </mesh>
         <mesh position={[0.4, 1.6, 0.6]}>
            <boxGeometry args={[0.25, 0.15, 0.15]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.4} />
         </mesh>
         {[-0.65, 0.65].flatMap((z) =>
            [-0.85, 0.85].map((x) => (
               <mesh key={`${x}${z}`} position={[x, 0.35, z]} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
                  <meshStandardMaterial color={COLORS.roverWheel} roughness={0.85} />
               </mesh>
            ))
         )}
      </group>
   );
}

export function SampleRockPrimitive() {
   return (
      <mesh position={[0, FIT.sampleSize / 2, 0]}>
         <dodecahedronGeometry args={[FIT.sampleSize / 2, 0]} />
         <meshStandardMaterial color={COLORS.sampleGlow} emissive={COLORS.sampleGlow} emissiveIntensity={0.5} flatShading />
      </mesh>
   );
}

/** A mast with a glowing lamp, FIT.beaconHeight tall. */
export function BeaconPrimitive({ spots }: { spots: readonly InstanceSpot[] }) {
   const parts = useParts(() => [
      { geometry: at(new CylinderGeometry(0.06, 0.1, FIT.beaconHeight, 8), 0, FIT.beaconHeight / 2, 0), material: mat(COLORS.roverMetal, { metalness: 0.5 }) },
      { geometry: at(new SphereGeometry(0.2, 12, 8), 0, FIT.beaconHeight, 0), material: mat(COLORS.accent, { emissive: COLORS.accent, emissiveIntensity: 1 }) },
   ]);
   return <PartsInstanced spots={spots} parts={parts} name="beacon" />;
}

/** A charging post with a green panel, FIT.stationHeight tall. */
export function ChargerPrimitive({ spots }: { spots: readonly InstanceSpot[] }) {
   const parts = useParts(() => [
      { geometry: at(new BoxGeometry(0.6, FIT.stationHeight, 0.5), 0, FIT.stationHeight / 2, 0), material: mat("#475569", { metalness: 0.4 }) },
      { geometry: at(new BoxGeometry(0.45, 0.35, 0.05), 0, FIT.stationHeight * 0.7, 0.27), material: mat(COLORS.chargerPad, { emissive: COLORS.chargerPad, emissiveIntensity: 0.8 }) },
   ]);
   return <PartsInstanced spots={spots} parts={parts} name="station" />;
}

/** Base camp stand-ins at 1 m (the <Model scale> sets the size). */
export function CampPrimitive({ kind }: { kind: "base" | "antenna" | "capsule" }) {
   if (kind === "antenna")
      return (
         <group>
            <mesh position={[0, 0.45, 0]}>
               <cylinderGeometry args={[0.02, 0.04, 0.9, 6]} />
               <meshStandardMaterial color={COLORS.roverMetal} />
            </mesh>
            <mesh position={[0, 0.9, 0.05]} rotation-x={-0.6}>
               <cylinderGeometry args={[0.28, 0.05, 0.12, 16]} />
               <meshStandardMaterial color="#f1f5f9" />
            </mesh>
         </group>
      );
   if (kind === "capsule")
      return (
         <mesh position={[0, 0.5, 0]}>
            <capsuleGeometry args={[0.3, 0.4, 6, 12]} />
            <meshStandardMaterial color="#f1f5f9" />
         </mesh>
      );
   return (
      <group>
         <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.76, 0.44, 1]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.46, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.9]} />
            <meshStandardMaterial color={COLORS.accent} />
         </mesh>
      </group>
   );
}

export function AstronautFigure() {
   return (
      <group scale={FIT.astronautHeight / 1.72}>
         {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0.38, 0]}>
               <cylinderGeometry args={[0.1, 0.12, 0.75, 8]} />
               <meshStandardMaterial color="#f8fafc" roughness={0.6} />
            </mesh>
         ))}
         <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.22, 0.24, 0.62, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.08, -0.22]}>
            <boxGeometry args={[0.35, 0.5, 0.22]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
         </mesh>
         <mesh position={[0, 1.52, 0.12]}>
            <sphereGeometry args={[0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
         </mesh>
      </group>
   );
}
