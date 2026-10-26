"use client";

// Stand-ins and code-built pieces. The GLB stand-ins are drawn only when a model is missing or broken;
// they are built at the same unit size as the fitted GLB (track pieces 1 m long, decor 1 m tall), so the
// same spots place both. Vines, lava vents, gems and stilts are code by design (spec: hangingVineV2 is
// still needed; markers and glows stay code).
import { memo, useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { FIT } from "./assets";
import { COLORS } from "./looks";

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const at = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

/** Merge built-in geometries that are all indexed (box, cylinder, sphere, torus): never mix indexed and non-indexed. */
export function merged(...parts: BufferGeometry[]): BufferGeometry {
   if (parts.some((g) => g.index === null)) throw new Error("merged: every part must be indexed");
   const out = mergeGeometries(parts, false);
   if (!out) throw new Error("merged: incompatible parts");
   for (const g of parts) g.dispose();
   return out;
}

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

/** One <Instanced> per part for the same spots. */
export function PartsInstanced({ spots, parts, name }: { spots: readonly InstanceSpot[]; parts: readonly InstancePart[]; name: string }) {
   if (spots.length === 0) return null;
   return (
      <>
         {parts.map((p, i) => (
            <Instanced key={i} spots={spots} name={`${name}-${i}`}>
               <primitive object={p.geometry} attach="geometry" />
               <primitive object={p.material} attach="material" />
            </Instanced>
         ))}
      </>
   );
}

// ---------- stand-ins at the fitted unit size ----------

/** a 1 m long plank lane: boards and two low kerbs, the deck top at y = 0 */
export const deckParts = (): InstancePart[] => [
   { geometry: at(new BoxGeometry(FIT.deckWidth, 0.12, 0.96), 0, -0.06, 0), material: mat(COLORS.planks, { roughness: 0.8 }) },
   { geometry: merged(at(new BoxGeometry(0.08, 0.2, 1), FIT.deckWidth / 2 - 0.04, 0.04, 0), at(new BoxGeometry(0.08, 0.2, 1), -FIT.deckWidth / 2 + 0.04, 0.04, 0)), material: mat(COLORS.planksDark) },
];

/** a 1 m long rope bridge lane: slats and two ropes */
export const ropeParts = (): InstancePart[] => [
   { geometry: at(new BoxGeometry(FIT.ropeWidth, 0.08, 0.8), 0, -0.04, 0), material: mat(COLORS.planks, { roughness: 0.85 }) },
   { geometry: merged(at(new BoxGeometry(0.05, 0.05, 1), FIT.ropeWidth / 2, 0.85, 0), at(new BoxGeometry(0.05, 0.05, 1), -FIT.ropeWidth / 2, 0.85, 0)), material: mat(COLORS.rope) },
];

/** a ruin gate over one lane: two posts and a lintel */
export const gateParts = (): InstancePart[] => [
   { geometry: merged(at(new BoxGeometry(0.5, FIT.gateLintel, 0.6), -0.75, FIT.gateLintel / 2, 0), at(new BoxGeometry(0.5, FIT.gateLintel, 0.6), 0.75, FIT.gateLintel / 2, 0)), material: mat(COLORS.stone) },
   { geometry: at(new BoxGeometry(FIT.gateWidth, 0.5, 0.65), 0, FIT.gateLintel + 0.25, 0), material: mat(COLORS.moss) },
];

export const pillarParts = (): InstancePart[] => [
   { geometry: at(new CylinderGeometry(0.42, 0.5, 2.3, 10), 0, 1.15, 0), material: mat(COLORS.stone) },
   { geometry: at(new BoxGeometry(FIT.pillarWidth, 0.25, FIT.pillarWidth), 0, 2.42, 0), material: mat(COLORS.stoneDark) },
];

/** the rolling log, its axis along z, resting on y = 0 */
export const logParts = (): InstancePart[] => [
   { geometry: at(new CylinderGeometry(FIT.logDiameter / 2, FIT.logDiameter / 2, FIT.logLength, 12).rotateX(Math.PI / 2), 0, FIT.logDiameter / 2, 0), material: mat(COLORS.logBark, { roughness: 0.85 }) },
   { geometry: at(new CylinderGeometry(FIT.logDiameter / 2 - 0.05, FIT.logDiameter / 2 - 0.05, FIT.logLength + 0.02, 12).rotateX(Math.PI / 2), 0, FIT.logDiameter / 2, 0), material: mat("#d6a35c") },
];

// decor, 1 m tall
export const rockParts = (): InstancePart[] => [{ geometry: at(new DodecahedronGeometry(0.55).scale(1, 0.9, 1), 0, 0.5, 0), material: mat(COLORS.cliff, { roughness: 0.95, flatShading: true }) }];
export const treeParts = (): InstancePart[] => [
   { geometry: at(new CylinderGeometry(0.04, 0.07, 0.45, 7), 0, 0.22, 0), material: mat(COLORS.logBark) },
   { geometry: at(new SphereGeometry(0.4, 10, 8).scale(1, 0.85, 1), 0, 0.66, 0), material: mat(COLORS.foliage) },
];
export const fernParts = (): InstancePart[] => [{ geometry: at(new ConeGeometry(0.5, 1, 7), 0, 0.5, 0), material: mat(COLORS.vineLeaf) }];
export const hangingVineParts = (): InstancePart[] => [{ geometry: at(new CylinderGeometry(0.03, 0.03, 1, 5), 0, 0.5, 0), material: mat(COLORS.vine) }];

// ---------- code-built pieces ----------

/** a twisted rope vine across one lane (2 m) with leaf tufts, its middle at the spot (1.05 m up) */
export const vineBarParts = (): InstancePart[] => [
   { geometry: merged(new TorusGeometry(0.11, 0.06, 6, 10).rotateY(Math.PI / 2).translate(-0.5, 0, 0), new TorusGeometry(0.11, 0.06, 6, 10).rotateY(Math.PI / 2).translate(0.5, 0, 0), new CylinderGeometry(0.07, 0.07, 2, 8).rotateZ(Math.PI / 2)), material: mat(COLORS.vine, { roughness: 0.8 }) },
   {
      geometry: merged(
         new SphereGeometry(0.16, 7, 5).scale(1.3, 0.6, 1).translate(-0.6, -0.12, 0),
         new SphereGeometry(0.16, 7, 5).scale(1.3, 0.6, 1).translate(0.05, -0.15, 0.04),
         new SphereGeometry(0.16, 7, 5).scale(1.3, 0.6, 1).translate(0.65, -0.1, -0.03)
      ),
      material: mat(COLORS.vineLeaf, { roughness: 0.6 }),
   },
];

/** a lava vent's dark crust ring (always there) */
export const lavaCrustParts = (): InstancePart[] => [{ geometry: new CylinderGeometry(0.75, 0.85, 0.06, 16), material: mat(COLORS.lavaRock, { roughness: 0.95 }) }];

/** a gem: a faceted cyan crystal (the kit <Gem> look), one pool for every gem */
export const gemParts = (): InstancePart[] => [
   { geometry: new OctahedronGeometry(0.2, 0).scale(1, 1.35, 1), material: mat("#67e8f9", { emissive: COLORS.gemGlow, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1, flatShading: true }) },
];

/** the lava glow while a vent erupts (scaled by the eruption) */
export const lavaGlowParts = (): InstancePart[] => [
   { geometry: new CylinderGeometry(0.6, 0.6, 0.05, 16).translate(0, 0.04, 0), material: mat(COLORS.lava, { emissive: COLORS.lavaGlow, emissiveIntensity: 1.2 }) },
   { geometry: new IcosahedronGeometry(0.3, 0).scale(1, 2.2, 1).translate(0, 0.6, 0), material: mat(COLORS.lavaGlow, { emissive: COLORS.lavaGlow, emissiveIntensity: 1.4, transparent: true, opacity: 0.75, depthWrite: false }) },
];

/** a stilt: a unit box (spots set sx / sy / sz) */
export const stiltParts = (): InstancePart[] => [{ geometry: new BoxGeometry(1, 1, 1), material: mat(COLORS.planksDark, { roughness: 0.9 }) }];

/** The explorer stand-in: khaki shirt, shorts, boots, a hat; 1.76 m. */
export const ExplorerPrimitive = memo(function ExplorerPrimitive() {
   return (
      <group name="fallback-explorer">
         {[-0.12, 0.12].map((x) => (
            <group key={x}>
               <mesh position={[x, 0.4, 0]}>
                  <cylinderGeometry args={[0.075, 0.085, 0.7, 10]} />
                  <meshStandardMaterial color="#d6b37a" roughness={0.7} />
               </mesh>
               <mesh position={[x, 0.08, 0.04]}>
                  <boxGeometry args={[0.16, 0.16, 0.28]} />
                  <meshStandardMaterial color="#78350f" roughness={0.8} />
               </mesh>
            </group>
         ))}
         <mesh position={[0, 0.82, 0]}>
            <boxGeometry args={[0.4, 0.22, 0.26]} />
            <meshStandardMaterial color="#65532f" roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.44, 0.5, 0.28]} />
            <meshStandardMaterial color="#ca8a04" roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.15, -0.22]}>
            <boxGeometry args={[0.34, 0.42, 0.18]} />
            <meshStandardMaterial color="#713f12" roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.52, 0]}>
            <sphereGeometry args={[0.15, 14, 12]} />
            <meshStandardMaterial color="#e8b48a" roughness={0.5} />
         </mesh>
         <mesh position={[0, 1.66, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.03, 16]} />
            <meshStandardMaterial color="#a16207" roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.72, 0]}>
            <cylinderGeometry args={[0.13, 0.15, 0.12, 14]} />
            <meshStandardMaterial color="#a16207" roughness={0.7} />
         </mesh>
      </group>
   );
});
