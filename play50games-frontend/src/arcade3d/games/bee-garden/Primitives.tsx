"use client";

// Stand-ins, drawn only when a GLB is missing or broken. Gameplay parts are built at their drawn size
// (assets.ts FIT); decor parts at 1 m, like the fitted decor GLBs, so one spot scale serves both.
import { useEffect, useMemo } from "react";
import { BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, MeshStandardMaterial, RingGeometry, SphereGeometry, BoxGeometry, type Material } from "three";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { BRANCH_UPRIGHT, FIT } from "./assets";
import { COLORS } from "./looks";

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
   new MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function disposeParts(parts: readonly InstancePart[]) {
   for (const p of parts) {
      p.geometry.dispose();
      const m = p.material as Material | Material[];
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
   }
}

/** Builds parts once per mount and disposes of them on unmount. */
export function useParts(build: () => InstancePart[]): InstancePart[] {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const parts = useMemo(build, []);
   useEffect(() => () => disposeParts(parts), [parts]);
   return parts;
}

const at = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

export const FLOWER_COLOR = { A: COLORS.flowerA, B: COLORS.flowerB, C: COLORS.flowerC } as const;

export function flowerParts(color: string): InstancePart[] {
   const h = FIT.flowerHeight;
   return [
      { geometry: at(new CylinderGeometry(0.035, 0.05, h, 8), 0, h / 2, 0), material: mat(COLORS.stem) },
      { geometry: at(new SphereGeometry(0.2, 12, 8).scale(1, 0.35, 1), 0, h - 0.04, 0), material: mat(color, { roughness: 0.5 }) },
      { geometry: at(new CylinderGeometry(0.08, 0.09, 0.05, 12), 0, h, 0), material: mat(COLORS.flowerCenter, { roughness: 0.4 }) },
   ];
}

export function orbParts(): InstancePart[] {
   const r = FIT.orbSize / 2;
   return [{ geometry: at(new SphereGeometry(r, 16, 12), 0, r, 0), material: mat(COLORS.nectar, { emissive: COLORS.nectar, emissiveIntensity: 0.6, roughness: 0.2 }) }];
}

/** Drawn inside the branch's upright group (turned +90° about z): counter-turned to stand on the floor. */
export function BranchPrimitive() {
   return (
      <group rotation-z={-Math.PI / 2} position={[-FIT.branchLength / 2, BRANCH_UPRIGHT.position[0], 0]}>
         <group>
            <mesh position={[0, FIT.branchLength / 2, 0]}>
               <cylinderGeometry args={[0.1, 0.18, FIT.branchLength, 9]} />
               <meshStandardMaterial color={COLORS.branch} roughness={0.85} />
            </mesh>
            <mesh position={[0.22, FIT.branchLength * 0.72, 0]} rotation-z={-0.8}>
               <cylinderGeometry args={[0.04, 0.07, 0.6, 7]} />
               <meshStandardMaterial color={COLORS.branchBark} roughness={0.85} />
            </mesh>
         </group>
      </group>
   );
}

export function webParts(): InstancePart[] {
   const r = FIT.webWidth / 2;
   return [
      { geometry: at(new RingGeometry(0.06, r, 10, 4), 0, 1.15, 0), material: mat(COLORS.web, { side: DoubleSide, transparent: true, opacity: 0.55, wireframe: true }) },
      { geometry: at(new CylinderGeometry(0.03, 0.04, 1.8, 6), -r, 0.9, 0), material: mat(COLORS.branch) },
   ];
}

// decor, 1 m tall
export function leafParts(): InstancePart[] {
   return [
      { geometry: at(new CylinderGeometry(0.02, 0.03, 0.5, 6), 0, 0.25, 0), material: mat(COLORS.leafDark) },
      { geometry: at(new SphereGeometry(0.35, 10, 8).scale(1, 0.12, 0.6).rotateX(-0.5), 0, 0.75, 0.1), material: mat(COLORS.leaf, { roughness: 0.5 }) },
   ];
}

export function mushroomParts(): InstancePart[] {
   return [
      { geometry: at(new CylinderGeometry(0.18, 0.24, 0.6, 10), 0, 0.3, 0), material: mat(COLORS.mushroomStem) },
      { geometry: at(new SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), 0, 0.6, 0), material: mat(COLORS.mushroomCap, { roughness: 0.45 }) },
   ];
}

export function planterParts(): InstancePart[] {
   return [
      { geometry: at(new BoxGeometry(1, 0.32, 0.62), 0, 0.16, 0), material: mat(COLORS.planter) },
      { geometry: at(new BoxGeometry(0.9, 0.04, 0.52), 0, 0.31, 0), material: mat(COLORS.soilDark, { roughness: 0.9 }) },
   ];
}

export function canParts(): InstancePart[] {
   return [
      { geometry: at(new CylinderGeometry(0.22, 0.26, 0.55, 12), 0, 0.28, 0), material: mat(COLORS.wateringCan, { roughness: 0.35, metalness: 0.2 }) },
      { geometry: at(new CylinderGeometry(0.03, 0.05, 0.5, 8).rotateZ(-0.8), 0.32, 0.45, 0), material: mat(COLORS.wateringCan, { roughness: 0.35 }) },
   ];
}

export function treeParts(): InstancePart[] {
   return [
      { geometry: at(new CylinderGeometry(0.05, 0.08, 0.45, 8), 0, 0.22, 0), material: mat(COLORS.branch, { roughness: 0.85 }) },
      { geometry: at(new ConeGeometry(0.4, 0.7, 9), 0, 0.62, 0), material: mat(COLORS.leafDark, { roughness: 0.7 }) },
   ];
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

/** The bee stand-in, centred on its flight point, facing +z. */
export function BeePrimitive({ tint = COLORS.accent }: { tint?: string }) {
   return (
      <group scale={FIT.beeSpan / 0.8}>
         <mesh scale={[0.85, 0.85, 1.25]}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshStandardMaterial color={tint} roughness={0.45} />
         </mesh>
         {[-0.07, 0.07].map((z) => (
            <mesh key={z} position={[0, 0, z]} rotation-x={Math.PI / 2}>
               <cylinderGeometry args={[0.162, 0.162, 0.05, 16]} />
               <meshStandardMaterial color="#1c1917" roughness={0.6} />
            </mesh>
         ))}
         <mesh position={[0, 0.03, 0.24]}>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshStandardMaterial color="#292524" roughness={0.5} />
         </mesh>
         {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.2, 0.14, 0]} rotation={[0, 0, s * 0.35]}>
               <boxGeometry args={[0.36, 0.015, 0.16]} />
               <meshStandardMaterial color="#e0f2fe" transparent opacity={0.7} roughness={0.1} />
            </mesh>
         ))}
      </group>
   );
}

export function BeehivePrimitive() {
   const h = FIT.hiveHeight;
   return (
      <group>
         <mesh position={[0, h * 0.06, 0]}>
            <cylinderGeometry args={[0.55, 0.6, h * 0.12, 10]} />
            <meshStandardMaterial color={COLORS.hiveAccent} roughness={0.7} />
         </mesh>
         {[0.3, 0.55, 0.78].map((k, i) => (
            <mesh key={k} position={[0, h * k, 0]}>
               <cylinderGeometry args={[0.55 - i * 0.07, 0.6 - i * 0.07, h * 0.22, 10]} />
               <meshStandardMaterial color={i % 2 ? COLORS.hive : "#fbbf24"} roughness={0.5} />
            </mesh>
         ))}
         <mesh position={[0, h * 0.94, 0]}>
            <coneGeometry args={[0.42, h * 0.16, 10]} />
            <meshStandardMaterial color={COLORS.hiveAccent} roughness={0.6} />
         </mesh>
         <mesh position={[0, h * 0.2, 0.58]}>
            <boxGeometry args={[0.3, 0.09, 0.06]} />
            <meshStandardMaterial color={COLORS.hiveSlot} roughness={0.9} />
         </mesh>
      </group>
   );
}

/**
 * Greenhouse glass shell (level 3): milky panels on N/E/W, a low south sill for the camera,
 * metal frame posts. Visual only — the bee still clamps to the garden edge.
 */
export function GreenhouseShell({
   halfX,
   halfZ,
   wallH,
   sillH,
}: {
   halfX: number;
   halfZ: number;
   wallH: number;
   sillH: number;
}) {
   const thick = 0.06;
   const post = 0.12;
   const spanX = 2 * halfX;
   const spanZ = 2 * halfZ;
   const glass = { color: COLORS.glass, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.28, depthWrite: false } as const;
   const frame = { color: COLORS.glassFrame, roughness: 0.55, metalness: 0.35 } as const;
   const sill = { color: COLORS.glassSill, roughness: 0.7, metalness: 0.15 } as const;
   return (
      <group>
         {/* north / east / west glass */}
         <mesh position={[0, wallH / 2, -halfZ]}>
            <boxGeometry args={[spanX, wallH, thick]} />
            <meshStandardMaterial {...glass} />
         </mesh>
         <mesh position={[-halfX, wallH / 2, 0]}>
            <boxGeometry args={[thick, wallH, spanZ]} />
            <meshStandardMaterial {...glass} />
         </mesh>
         <mesh position={[halfX, wallH / 2, 0]}>
            <boxGeometry args={[thick, wallH, spanZ]} />
            <meshStandardMaterial {...glass} />
         </mesh>
         {/* south sill (camera side) */}
         <mesh position={[0, sillH / 2, halfZ]}>
            <boxGeometry args={[spanX, sillH, thick * 1.4]} />
            <meshStandardMaterial {...sill} />
         </mesh>
         {/* corner posts */}
         {(
            [
               [-halfX, -halfZ],
               [halfX, -halfZ],
               [-halfX, halfZ],
               [halfX, halfZ],
            ] as const
         ).map(([x, z]) => (
            <mesh key={`${x}:${z}`} position={[x, wallH / 2, z]}>
               <boxGeometry args={[post, wallH, post]} />
               <meshStandardMaterial {...frame} />
            </mesh>
         ))}
         {/* top rails on N/E/W */}
         <mesh position={[0, wallH, -halfZ]}>
            <boxGeometry args={[spanX + post, post * 0.7, post]} />
            <meshStandardMaterial {...frame} />
         </mesh>
         <mesh position={[-halfX, wallH, 0]}>
            <boxGeometry args={[post, post * 0.7, spanZ + post]} />
            <meshStandardMaterial {...frame} />
         </mesh>
         <mesh position={[halfX, wallH, 0]}>
            <boxGeometry args={[post, post * 0.7, spanZ + post]} />
            <meshStandardMaterial {...frame} />
         </mesh>
         {/* mid rail for a greenhouse bay read */}
         <mesh position={[0, wallH * 0.45, -halfZ]}>
            <boxGeometry args={[spanX, post * 0.55, post * 0.6]} />
            <meshStandardMaterial {...frame} />
         </mesh>
      </group>
   );
}

/** Giant Garden centrepiece: an oversized bloom north of the garden (visual only). */
export function GiantFlower({ height }: { height: number }) {
   const stemH = height * 0.62;
   const bloomR = height * 0.22;
   return (
      <group>
         <mesh position={[0, stemH / 2, 0]}>
            <cylinderGeometry args={[0.12, 0.22, stemH, 10]} />
            <meshStandardMaterial color={COLORS.stem} roughness={0.75} />
         </mesh>
         {/* three petal layers + a bright centre */}
         <mesh position={[0, stemH + bloomR * 0.15, 0]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[bloomR, 16, 12]} />
            <meshStandardMaterial color={COLORS.flowerA} roughness={0.45} />
         </mesh>
         <mesh position={[0, stemH + bloomR * 0.25, 0]} scale={[0.72, 0.28, 0.72]}>
            <sphereGeometry args={[bloomR, 14, 10]} />
            <meshStandardMaterial color={COLORS.flowerB} roughness={0.4} />
         </mesh>
         <mesh position={[0, stemH + bloomR * 0.32, 0]}>
            <cylinderGeometry args={[bloomR * 0.28, bloomR * 0.32, bloomR * 0.2, 12]} />
            <meshStandardMaterial color={COLORS.flowerCenter} roughness={0.35} emissive={COLORS.nectar} emissiveIntensity={0.25} />
         </mesh>
         {/* two big leaves at the base */}
         {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.55, stemH * 0.28, 0.1]} rotation={[0.4, 0, s * 0.7]} scale={[1.1, 0.12, 0.55]}>
               <sphereGeometry args={[0.7, 10, 8]} />
               <meshStandardMaterial color={COLORS.leaf} roughness={0.55} />
            </mesh>
         ))}
      </group>
   );
}
