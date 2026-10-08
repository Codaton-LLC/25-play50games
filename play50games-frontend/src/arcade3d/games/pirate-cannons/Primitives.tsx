"use client";

// Pirate Cannon Battle stand-ins (drawn while a GLB is missing or broken) and the procedural pool
// parts: ship hull + mast + sail, barrel, crate, pennants, galleon sails, HP pips, cannonballs. Every
// part is built once per mount and disposed with it (usePoolParts).
import { useEffect, useMemo, useState } from "react";
import {
   BoxGeometry,
   BufferGeometry,
   CircleGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   Float32BufferAttribute,
   Matrix4,
   MeshStandardMaterial,
   PlaneGeometry,
   SphereGeometry,
   DoubleSide,
   type Material,
} from "three";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { BARREL_HEIGHT, CHEST_DRAFT, CRATE_SIZE, PALM_SIZE, SHIP_MAST_TOP } from "./assets";
import { COLORS } from "./looks";
import { CANNON, WORLD } from "./rules";

/** Parts built once (factory) and disposed on unmount. */
function usePoolParts(build: () => InstancePart[]): InstancePart[] {
   const [parts] = useState(build);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (Array.isArray(p.material) ? p.material : [p.material]).forEach((m: Material) => m.dispose());
         }
      },
      [parts]
   );
   return parts;
}

const mat = (color: string, extra: { roughness?: number; side?: typeof DoubleSide } = {}) =>
   new MeshStandardMaterial({ color, roughness: extra.roughness ?? 0.8, ...(extra.side !== undefined ? { side: extra.side } : {}) });

// ---------- ship (sloop units: the copy's matrix scales dinghy / galleon; the waterline is y 0) ----------

export function useShipParts(): readonly InstancePart[] {
   return usePoolParts(() => [
      { geometry: new BoxGeometry(2.2, 1.5, 6), material: mat(COLORS.wood), locals: [new Matrix4().makeTranslation(0, 0.15, 0)] },
      { geometry: new CylinderGeometry(0.1, 0.12, SHIP_MAST_TOP, 8), material: mat("#78350f"), locals: [new Matrix4().makeTranslation(0, SHIP_MAST_TOP / 2, 0.3)] },
      {
         geometry: new PlaneGeometry(3.2, 2.6),
         material: mat(COLORS.sail, { side: DoubleSide }),
         locals: [new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.9, 0.4)],
      },
   ]);
}

/** A pennant at the mast top: a small triangle flying aft (−z in the ship's frame). */
export function usePennantParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0, -0.25, -1.3], 3));
      g.computeVertexNormals();
      return [{ geometry: g, material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, side: DoubleSide }) }];
   });
}

/** The galleon's fore and aft sails (its third and fourth mast), in sloop units. */
export function useGalleonSailParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const fore = new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.2, 1.9);
      const aft = new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.1, -1.9);
      return [
         { geometry: new PlaneGeometry(1.8, 1.8), material: mat(COLORS.coral, { side: DoubleSide }), locals: [fore, aft] },
         { geometry: new CylinderGeometry(0.07, 0.08, 3.2, 6), material: mat("#78350f"), locals: [new Matrix4().makeTranslation(0, 1.6, 1.9), new Matrix4().makeTranslation(0, 1.6, -1.9)] },
      ];
   });
}

/** HP pips: flat discs facing the camera (the camera looks along -z). */
export function usePipParts(): readonly InstancePart[] {
   return usePoolParts(() => [{ geometry: new CircleGeometry(0.42, 16), material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, emissive: "#7f1d1d", emissiveIntensity: 0.35 }) }]);
}

export function useBallParts(): readonly InstancePart[] {
   return usePoolParts(() => [{ geometry: new SphereGeometry(WORLD.ballRadius, 14, 10), material: mat(COLORS.ball, { roughness: 0.4 }) }]);
}

export function useBarrelParts(): readonly InstancePart[] {
   return usePoolParts(() => [{ geometry: new CylinderGeometry(0.4, 0.4, BARREL_HEIGHT, 14), material: mat(COLORS.barrel) }]);
}

export function useCrateParts(): readonly InstancePart[] {
   return usePoolParts(() => [{ geometry: new BoxGeometry(CRATE_SIZE, CRATE_SIZE * 0.7, CRATE_SIZE), material: mat("#b45309") }]);
}

// ---------- single stand-ins ----------

/** The cannon stand-in in the model's frame (default fit, barrel +z, feet on y 0). */
export function CannonPrimitive() {
   const s = CANNON.scale;
   return (
      <group name="cannon-standin">
         <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.7, 0.35, 1.1]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.8} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.5, CANNON.axleGlb.y * s, CANNON.axleGlb.z * s]} rotation={[0, 0, Math.PI / 2]}>
               <cylinderGeometry args={[0.33, 0.33, 0.12, 16]} />
               <meshStandardMaterial color="#451a03" roughness={0.8} />
            </mesh>
         ))}
         <mesh position={[0, 0.78, 0.05]} rotation={[Math.PI / 2 - CANNON.barrelAngle, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.22, 1.5, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.45} metalness={0.4} />
         </mesh>
      </group>
   );
}

export function ChestPrimitive() {
   return (
      <mesh position={[0, 0.3 - CHEST_DRAFT, 0]}>
         <boxGeometry args={[0.9, 0.6, 0.6]} />
         <meshStandardMaterial color={COLORS.chest} roughness={0.7} />
      </mesh>
   );
}

/** Palms (trunk + crown, feet on the spot) at the spots: two instanced draw calls. */
export function PalmPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const trunkH = PALM_SIZE.height * 0.8;
      return {
         trunk: new CylinderGeometry(0.18, 0.26, trunkH, 8).translate(0, trunkH / 2, 0),
         crown: new ConeGeometry(PALM_SIZE.crown / 2, 1.1, 9).translate(0, PALM_SIZE.height - 0.55, 0),
      };
   }, []);
   useEffect(
      () => () => {
         geo.trunk.dispose();
         geo.crown.dispose();
      },
      [geo]
   );
   return (
      <>
         <Instanced spots={spots} name="palm-trunks">
            <primitive object={geo.trunk} attach="geometry" />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.9} />
         </Instanced>
         <Instanced spots={spots} name="palm-crowns">
            <primitive object={geo.crown} attach="geometry" />
            <meshStandardMaterial color={COLORS.palm} roughness={0.85} />
         </Instanced>
      </>
   );
}

/** Pennant colours by ship type (white dinghy, coral sloop, red galleon). */
export const PENNANT = { dinghy: new Color(COLORS.sail), sloop: new Color(COLORS.coral), galleon: new Color(COLORS.accent) } as const;
