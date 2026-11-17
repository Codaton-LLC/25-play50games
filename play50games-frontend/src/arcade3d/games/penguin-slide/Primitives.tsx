"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   Matrix4,
   MeshStandardMaterial,
   SphereGeometry,
} from "three";
import type { InstancePart } from "@/arcade3d/core/render";
import { COLORS } from "./looks";

export function PenguinPrimitive() {
   return (
      <group name="penguin-primitive">
         {/* Main dark aerodynamic sliding body */}
         <mesh position={[0, 0.39, 0]} scale={[0.29, 0.4, 0.27]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={COLORS.penguinDark} roughness={0.65} />
         </mesh>

         {/* Snowy white chest and belly */}
         <mesh position={[0, 0.39, 0.14]} scale={[0.23, 0.32, 0.17]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={COLORS.penguinWhite} roughness={0.75} />
         </mesh>

         {/* Bright orange beak */}
         <mesh position={[0, 0.65, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.22, 6]} />
            <meshStandardMaterial color={COLORS.penguinBeak} roughness={0.5} />
         </mesh>

         {/* Eyes */}
         {[-1, 1].map((side) => (
            <mesh key={`eye-${side}`} position={[side * 0.12, 0.68, 0.22]} scale={[0.035, 0.035, 0.03]}>
               <sphereGeometry args={[1, 8, 8]} />
               <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
         ))}
         {[-1, 1].map((side) => (
            <mesh key={`pupil-${side}`} position={[side * 0.125, 0.68, 0.245]} scale={[0.018, 0.018, 0.018]}>
               <sphereGeometry args={[1, 6, 6]} />
               <meshStandardMaterial color="#020617" roughness={0.2} />
            </mesh>
         ))}

         {/* Flippers */}
         {[-1, 1].map((side) => (
            <mesh
               key={`flipper-${side}`}
               position={[side * 0.29, 0.42, 0]}
               scale={[0.12, 0.24, 0.07]}
               rotation={[0, 0, side * 0.5]}
            >
               <sphereGeometry args={[1, 10, 8]} />
               <meshStandardMaterial color={COLORS.penguinDark} roughness={0.65} />
            </mesh>
         ))}

         {/* Feet at tail */}
         {[-1, 1].map((side) => (
            <mesh
               key={`foot-${side}`}
               position={[side * 0.13, 0.06, -0.18]}
               scale={[0.08, 0.03, 0.12]}
               rotation={[-0.2, side * 0.1, 0]}
            >
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.penguinFeet} roughness={0.6} />
            </mesh>
         ))}
      </group>
   );
}

export function usePropParts(
   kind: "fish" | "pine" | "flag" | "ice" | "snowman" | "crack" | "ramp" | "gatePost"
): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
         new Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z);

      // 1. Fish: salmon orange body, white belly band, tail fin
      if (kind === "fish") {
         return [
            {
               geometry: new SphereGeometry(1, 10, 8),
               material: new MeshStandardMaterial({ color: COLORS.fishBody, roughness: 0.35, metalness: 0.08 }),
               locals: [at(0, 0, 0, 0.17, 0.204, 0.323)],
            },
            {
               geometry: new SphereGeometry(1, 8, 6),
               material: new MeshStandardMaterial({ color: COLORS.fishBelly, roughness: 0.5 }),
               locals: [at(0, -0.05, 0, 0.13, 0.14, 0.26)],
            },
            {
               geometry: new BoxGeometry(0.04, 0.18, 0.15),
               material: new MeshStandardMaterial({ color: COLORS.fishTail, roughness: 0.4 }),
               locals: [at(0, 0, -0.32)],
            },
         ];
      }

      // 2. Pine: tiered snow-laden winter evergreen
      if (kind === "pine") {
         return [
            {
               geometry: new ConeGeometry(1, 1, 7),
               material: new MeshStandardMaterial({ color: COLORS.pineNeedles, roughness: 0.95, flatShading: true }),
               locals: [
                  at(0, 1.35, 0, 0.95, 1.8, 0.95),
                  at(0, 2.4, 0, 0.7, 1.7, 0.7),
                  at(0, 3.3, 0, 0.4, 1.4, 0.4),
               ],
            },
            {
               geometry: new ConeGeometry(1, 0.3, 7),
               material: new MeshStandardMaterial({ color: COLORS.pineSnow, roughness: 0.9, flatShading: true }),
               locals: [
                  at(0, 1.85, 0, 0.85, 1.0, 0.85),
                  at(0, 2.85, 0, 0.6, 0.9, 0.6),
                  at(0, 3.75, 0, 0.35, 0.7, 0.35),
               ],
            },
            {
               geometry: new CylinderGeometry(0.13, 0.18, 1, 6),
               material: new MeshStandardMaterial({ color: COLORS.pineTrunk, roughness: 0.95 }),
               locals: [at(0, 0.5, 0)],
            },
         ];
      }

      // 3. Flag: icy pole, radiant blue pennant, snow base
      if (kind === "flag") {
         return [
            {
               geometry: new CylinderGeometry(0.045, 0.045, 1.5, 6),
               material: new MeshStandardMaterial({ color: COLORS.skyBottom, roughness: 0.3 }),
               locals: [at(0, 0.75, 0)],
            },
            {
               geometry: new BoxGeometry(0.5, 0.3, 0.03),
               material: new MeshStandardMaterial({ color: COLORS.iceCracks, roughness: 0.4, metalness: 0.1 }),
               locals: [at(0.25, 1.25, 0)],
            },
         ];
      }

      // 4. Snowman: 2-tier snow body, carrot nose, coal buttons
      if (kind === "snowman") {
         return [
            {
               geometry: new SphereGeometry(1, 10, 8),
               material: new MeshStandardMaterial({ color: COLORS.snowSoft, roughness: 0.9 }),
               locals: [at(0, 0.45, 0, 0.5, 0.5, 0.5), at(0, 1.03, 0, 0.32, 0.32, 0.32)],
            },
            {
               geometry: new ConeGeometry(0.07, 0.24, 5),
               material: new MeshStandardMaterial({ color: COLORS.iceBlockCoral, roughness: 0.6 }),
               locals: [new Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.06, 0.34)],
            },
            {
               geometry: new SphereGeometry(0.03, 6, 6),
               material: new MeshStandardMaterial({ color: COLORS.penguinDark, roughness: 0.8 }),
               locals: [
                  at(-0.08, 1.12, 0.28),
                  at(0.08, 1.12, 0.28),
                  at(0, 0.65, 0.48),
                  at(0, 0.45, 0.5),
               ],
            },
         ];
      }

      // 5. Crack / Crevasse: 3 distinct tones: deep black void, sharp cyan lip, coral hazard rim
      if (kind === "crack") {
         return [
            {
               geometry: new CylinderGeometry(0.52, 0.52, 0.04, 8),
               material: new MeshStandardMaterial({ color: COLORS.crackAbyss, roughness: 0.98 }),
               locals: [at(0, 0.02, 0)],
            },
            {
               geometry: new CylinderGeometry(0.61, 0.61, 0.025, 8),
               material: new MeshStandardMaterial({ color: COLORS.crackIceLip, roughness: 0.22, flatShading: true }),
               locals: [at(0, 0.015, 0)],
            },
            {
               geometry: new CylinderGeometry(0.67, 0.67, 0.012, 8),
               material: new MeshStandardMaterial({ color: COLORS.crackCoralRim, roughness: 0.4 }),
               locals: [at(0, 0.008, 0)],
            },
         ];
      }

      // 6. Ramp: frosted ice wedge with directional chevrons and frosted side rails
      if (kind === "ramp") {
         return [
            // Runway surface
            {
               geometry: new BoxGeometry(1, 1, 1),
               material: new MeshStandardMaterial({ color: COLORS.rampRunway, roughness: 0.24, flatShading: true }),
               locals: [at(0, -0.01, 0, 1.6, 0.02, 3)],
            },
            // Left & right guide rails
            {
               geometry: new CylinderGeometry(0.08, 0.08, 3, 6),
               material: new MeshStandardMaterial({ color: COLORS.rampRails, roughness: 0.2, flatShading: true }),
               locals: [
                  new Matrix4().makeRotationX(-0.2).setPosition(-0.82, 0.28, 0),
                  new Matrix4().makeRotationX(-0.2).setPosition(0.82, 0.28, 0),
               ],
            },
            // Directional chevrons on runway
            {
               geometry: new BoxGeometry(0.9, 0.022, 0.18),
               material: new MeshStandardMaterial({ color: COLORS.rampChevrons, roughness: 0.35 }),
               locals: [
                  at(0, 0.005, -0.6),
                  at(0, 0.005, 0.2),
                  at(0, 0.005, 1.0),
               ],
            },
         ];
      }

      // 7. Gate Post: sleek pylon with glowing mint indicator ring and snow-capped foot
      if (kind === "gatePost") {
         return [
            {
               geometry: new CylinderGeometry(0.05, 0.065, 2.4, 6),
               material: new MeshStandardMaterial({ color: COLORS.gatePost, roughness: 0.4, flatShading: true }),
               locals: [at(0, 1.2, 0)],
            },
            {
               geometry: new CylinderGeometry(0.075, 0.075, 0.35, 6),
               material: new MeshStandardMaterial({
                  color: COLORS.gateRing,
                  emissive: COLORS.gateRing,
                  emissiveIntensity: 0.55,
                  roughness: 0.2,
               }),
               locals: [at(0, 2.1, 0)],
            },
            {
               geometry: new CylinderGeometry(0.12, 0.16, 0.2, 6),
               material: new MeshStandardMaterial({ color: COLORS.gateBase, roughness: 0.9, flatShading: true }),
               locals: [at(0, 0.1, 0)],
            },
         ];
      }

      // 8. Ice Block Obstacle: faceted crystalline boulder with deep refraction & coral hazard facets
      return [
         // Main crystalline faceted body (diameter ~1.05, height 1.0)
         {
            geometry: new CylinderGeometry(0.48, 0.56, 0.96, 6),
            material: new MeshStandardMaterial({
               color: COLORS.iceBlock,
               roughness: 0.18,
               metalness: 0.08,
               flatShading: true,
            }),
            locals: [at(0, 0.48, 0)],
         },
         // Deep crystal core facet
         {
            geometry: new CylinderGeometry(0.32, 0.38, 0.78, 6),
            material: new MeshStandardMaterial({
               color: COLORS.iceBlockShade,
               roughness: 0.28,
               flatShading: true,
            }),
            locals: [at(0, 0.42, 0)],
         },
         // Coral warning hazard crystals (spurs on sides for immediate player reading)
         {
            geometry: new ConeGeometry(0.16, 0.42, 5),
            material: new MeshStandardMaterial({
               color: COLORS.iceBlockCoral,
               roughness: 0.35,
               flatShading: true,
            }),
            locals: [
               new Matrix4().makeRotationZ(-0.4).setPosition(0.44, 0.32, 0.15),
               new Matrix4().makeRotationZ(0.4).setPosition(-0.44, 0.28, -0.18),
               new Matrix4().makeRotationX(0.35).setPosition(0.1, 0.35, 0.44),
            ],
         },
      ];
   }, [kind]);

   useEffect(() => () => {
      for (const p of parts) {
         p.geometry.dispose();
         const materials = Array.isArray(p.material) ? p.material : [p.material];
         for (const m of materials) m.dispose();
      }
   }, [parts]);

   return parts;
}
