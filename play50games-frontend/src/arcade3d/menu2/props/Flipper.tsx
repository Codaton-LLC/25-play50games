"use client";

// A pinball-style toy flipper paddle: 1.6 m long x 0.28 m high x 0.44 m wide.
// Tapered bevelled paddle in toy red, a crisp white racing stripe along the top/side,
// and a round pivot cap in dark industrial metal. 3 draw calls, under 2k triangles.
import { forwardRef, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import {
   CylinderGeometry,
   ExtrudeGeometry,
   MeshStandardMaterial,
   Shape,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Real-world dimensions in metres (1.6 x 0.28 x 0.44 m). */
export const FLIPPER_SIZE = {
   w: 1.6,
   h: 0.28,
   d: 0.44,
   length: 1.6,
   width: 0.44,
   height: 0.28,
} as const;

export const FLIPPER_COLORS = {
   body: "#dc2626",
   accent: "#f8fafc",
   cap: "#334155",
} as const;

export interface FlipperProps extends Omit<GroupProps, "children"> {
   /** Paddle body colour (default: toy red #dc2626). */
   color?: string;
   /** Stripe colour (default: crisp white #f8fafc). */
   accent?: string;
}

function ensureNonIndexed(geom: BufferGeometry): BufferGeometry {
   return geom.index ? geom.toNonIndexed() : geom;
}

/**
 * Builds the complete standalone Flipper geometry: tapered paddle (group 0),
 * racing stripe (group 1), and round pivot cap (group 2). Produces finite bounds testable without a canvas.
 */
export function buildFlipperGeometry(): BufferGeometry {
   const r0 = 0.22;
   const r1 = 0.08;
   const cx0 = 0.22;
   const cx1 = 1.6 - r1;

   // 2D paddle teardrop profile
   const shape = new Shape();
   shape.absarc(cx0, 0, r0, Math.PI / 2, -Math.PI / 2, false);
   shape.absarc(cx1, 0, r1, -Math.PI / 2, Math.PI / 2, false);
   shape.closePath();

   const bevel = 0.012;
   const paddleRaw = new ExtrudeGeometry(shape, {
      depth: 0.20 - bevel * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
   });
   const paddleGeom = ensureNonIndexed(paddleRaw);
   paddleGeom.rotateX(Math.PI / 2);
   paddleGeom.translate(0, 0.20, 0);
   paddleRaw.dispose();

   // White racing stripe on the top face
   const stripeShape = new Shape();
   stripeShape.moveTo(0.35, -0.035);
   stripeShape.lineTo(1.48, -0.015);
   stripeShape.lineTo(1.48, 0.015);
   stripeShape.lineTo(0.35, 0.035);
   stripeShape.closePath();

   const stripeRaw = new ExtrudeGeometry(stripeShape, {
      depth: 0.005,
      bevelEnabled: false,
   });
   const stripeGeom = ensureNonIndexed(stripeRaw);
   stripeGeom.rotateX(Math.PI / 2);
   stripeGeom.translate(0, 0.213, 0);
   stripeRaw.dispose();

   // Chunky round pivot cap
   const capRaw = new CylinderGeometry(0.20, 0.22, 0.08, 24);
   const capGeom = ensureNonIndexed(capRaw);
   capGeom.translate(cx0, 0.24, 0);
   capRaw.dispose();

   const fullGeom = mergeGeometries([paddleGeom, stripeGeom, capGeom], true);
   paddleGeom.dispose();
   stripeGeom.dispose();
   capGeom.dispose();
   if (!fullGeom) {
      throw new Error("Flipper: failed to merge flipper geometries");
   }

   fullGeom.computeVertexNormals();
   fullGeom.computeBoundingBox();
   return fullGeom;
}

let cachedGeometry: BufferGeometry | null = null;

export function getSharedFlipperGeometry(): BufferGeometry {
   if (!cachedGeometry) {
      cachedGeometry = buildFlipperGeometry();
   }
   return cachedGeometry;
}

let sharedDefaultMaterials: [MeshStandardMaterial, MeshStandardMaterial, MeshStandardMaterial] | null = null;

function getSharedFlipperMaterials(color?: string, accent?: string): [MeshStandardMaterial, MeshStandardMaterial, MeshStandardMaterial] {
   if (!color && !accent) {
      if (!sharedDefaultMaterials) {
         sharedDefaultMaterials = [
            new MeshStandardMaterial({ color: FLIPPER_COLORS.body, roughness: 0.55 }),
            new MeshStandardMaterial({ color: FLIPPER_COLORS.accent, roughness: 0.6 }),
            new MeshStandardMaterial({ color: FLIPPER_COLORS.cap, roughness: 0.45, metalness: 0.5 }),
         ];
      }
      return sharedDefaultMaterials;
   }
   return [
      new MeshStandardMaterial({ color: color ?? FLIPPER_COLORS.body, roughness: 0.55 }),
      new MeshStandardMaterial({ color: accent ?? FLIPPER_COLORS.accent, roughness: 0.6 }),
      new MeshStandardMaterial({ color: FLIPPER_COLORS.cap, roughness: 0.45, metalness: 0.5 }),
   ];
}

export const Flipper = forwardRef<Group, FlipperProps>(function Flipper({ color, accent, ...groupProps }, ref) {
   const geometry = useMemo(() => getSharedFlipperGeometry(), []);
   const materials = useMemo(() => getSharedFlipperMaterials(color, accent), [color, accent]);

   return (
      <group ref={ref} {...groupProps} name="prop-flipper">
         <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
   );
});
