"use client";

// Bevelled, two- and three-tone stand-ins until the cat-vs-robot-vacuum GLBs are in the manifest.
// Each part is built once per scene and disposed by the scene.
import { CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { InstancePart } from "@/arcade3d/core/render";
import { COLORS } from "./looks";

const CAT_BODY = new RoundedBoxGeometry(0.32, 0.26, 0.5, 2, 0.08);
const CAT_BELLY = new RoundedBoxGeometry(0.3, 0.12, 0.46, 2, 0.05);
const CAT_HEAD = new RoundedBoxGeometry(0.26, 0.22, 0.22, 2, 0.07);
const CAT_EAR = new CylinderGeometry(0.04, 0.06, 0.1, 4);
const CAT_TAIL = new CylinderGeometry(0.035, 0.04, 0.3, 8);

/** A cat about 0.5 m long, feet on the floor at its origin, facing +z. */
export function CatFigure() {
   return (
      <group>
         <mesh position={[0, 0.2, 0]} geometry={CAT_BODY}>
            <meshStandardMaterial color={COLORS.cat} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.1, 0]} geometry={CAT_BELLY}>
            <meshStandardMaterial color={COLORS.catInner} roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.4, 0.26]} geometry={CAT_HEAD}>
            <meshStandardMaterial color={COLORS.cat} roughness={0.6} />
         </mesh>
         <mesh position={[-0.07, 0.56, 0.26]} rotation={[0, 0, -0.2]} geometry={CAT_EAR}>
            <meshStandardMaterial color={COLORS.catDark} roughness={0.6} />
         </mesh>
         <mesh position={[0.07, 0.56, 0.26]} rotation={[0, 0, 0.2]} geometry={CAT_EAR}>
            <meshStandardMaterial color={COLORS.catDark} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.2, -0.36]} rotation={[0.8, 0, 0]} geometry={CAT_TAIL}>
            <meshStandardMaterial color={COLORS.catDark} roughness={0.6} />
         </mesh>
      </group>
   );
}

/** A treat: a glazed puck with a brighter core. */
export function treatParts(): InstancePart[] {
   const puck = new CylinderGeometry(0.14, 0.14, 0.07, 14);
   const core = new CylinderGeometry(0.07, 0.07, 0.08, 10);
   return [
      { geometry: puck, material: new MeshStandardMaterial({ color: COLORS.treat, roughness: 0.45 }) },
      { geometry: core, material: new MeshStandardMaterial({ color: COLORS.treatCore, emissive: COLORS.treatCore, emissiveIntensity: 0.25, roughness: 0.4 }) },
   ];
}

/** A toy: a yarn ball with a ring of thread. */
export function toyParts(): InstancePart[] {
   const ball = new SphereGeometry(0.15, 12, 10);
   const ring = new TorusGeometry(0.13, 0.03, 8, 16);
   ring.rotateX(Math.PI / 2);
   return [
      { geometry: ball, material: new MeshStandardMaterial({ color: COLORS.toy, roughness: 0.8 }) },
      { geometry: ring, material: new MeshStandardMaterial({ color: COLORS.toyCore, roughness: 0.7 }) },
   ];
}

/** The robot vacuum: a flat disc, a lighter dome and a glowing sensor ring. */
export function vacuumParts(): InstancePart[] {
   const disc = new CylinderGeometry(0.34, 0.35, 0.09, 18);
   disc.translate(0, 0.045, 0);
   const dome = new CylinderGeometry(0.27, 0.3, 0.07, 18);
   dome.translate(0, 0.125, 0);
   const glow = new TorusGeometry(0.31, 0.018, 6, 24);
   glow.rotateX(Math.PI / 2);
   glow.translate(0, 0.095, 0);
   return [
      { geometry: disc, material: new MeshStandardMaterial({ color: COLORS.vacuumDark, roughness: 0.55 }) },
      { geometry: dome, material: new MeshStandardMaterial({ color: COLORS.vacuum, roughness: 0.4 }) },
      { geometry: glow, material: new MeshStandardMaterial({ color: COLORS.vacuumGlow, emissive: COLORS.vacuumGlow, emissiveIntensity: 1, roughness: 0.3 }) },
   ];
}

export function disposeParts(parts: readonly InstancePart[]): void {
   for (const part of parts) {
      part.geometry.dispose();
      const material = part.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
   }
}
