"use client";

// A rotating padded sweeper bar: 3.0 m long x 0.5 m high x 0.6 m deep.
// Thick padded bar with alternating red and white shock-absorbing foam collars
// through a chunky round 0.6 m drive hub. 3 draw calls, under 2k triangles.
import { forwardRef, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import {
   CylinderGeometry,
   MeshStandardMaterial,
   SphereGeometry,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Real-world dimensions in metres (3.0 x 0.5 x 0.6 m). */
export const SWEEPER_BAR_SIZE = {
   w: 3.0,
   h: 0.5,
   d: 0.6,
   length: 3.0,
   hubDiameter: 0.6,
   height: 0.5,
} as const;

export const SWEEPER_BAR_COLORS = {
   red: "#ef4444",
   white: "#f8fafc",
   hub: "#1e293b",
} as const;

export interface SweeperBarProps extends Omit<GroupProps, "children"> {
   /** Main padding foam colour (default: red #ef4444). */
   color?: string;
   /** Secondary stripe padding foam colour (default: white #f8fafc). */
   accent?: string;
}

function ensureNonIndexed(geom: BufferGeometry): BufferGeometry {
   return geom.index ? geom.toNonIndexed() : geom;
}

/**
 * Builds the complete standalone SweeperBar geometry: red padded collars + endcaps (group 0),
 * white padded collars (group 1), and round central hub (group 2). Produces finite bounds testable without a canvas.
 */
export function buildSweeperBarGeometry(): BufferGeometry {
   const redParts: BufferGeometry[] = [];
   const whiteParts: BufferGeometry[] = [];
   const hubParts: BufferGeometry[] = [];

   // Central chunky drive hub
   const hubRaw = new CylinderGeometry(0.3, 0.3, 0.44, 24);
   const hub = ensureNonIndexed(hubRaw);
   hub.translate(0, 0.22, 0);
   hubParts.push(hub);
   hubRaw.dispose();

   const hubCapRaw = new CylinderGeometry(0.16, 0.16, 0.06, 24);
   const hubCap = ensureNonIndexed(hubCapRaw);
   hubCap.translate(0, 0.47, 0);
   hubParts.push(hubCap);
   hubCapRaw.dispose();

   const segRadius = 0.12;
   const segLen = 0.216;

   // Left padded arm segments (alternating red / white)
   const leftStarts = [-1.38, -1.164, -0.948, -0.732, -0.516];
   for (let i = 0; i < leftStarts.length; i++) {
      const segRaw = new CylinderGeometry(segRadius, segRadius, segLen, 16);
      const seg = ensureNonIndexed(segRaw);
      seg.rotateZ(Math.PI / 2);
      seg.translate(leftStarts[i] + segLen / 2, 0.22, 0);
      if (i % 2 === 0) {
         redParts.push(seg);
      } else {
         whiteParts.push(seg);
      }
      segRaw.dispose();
   }

   // Right padded arm segments (alternating red / white)
   const rightStarts = [0.30, 0.516, 0.732, 0.948, 1.164];
   for (let i = 0; i < rightStarts.length; i++) {
      const segRaw = new CylinderGeometry(segRadius, segRadius, segLen, 16);
      const seg = ensureNonIndexed(segRaw);
      seg.rotateZ(Math.PI / 2);
      seg.translate(rightStarts[i] + segLen / 2, 0.22, 0);
      if (i % 2 === 0) {
         redParts.push(seg);
      } else {
         whiteParts.push(seg);
      }
      segRaw.dispose();
   }

   // Rounded protective end caps
   const endLeftRaw = new SphereGeometry(segRadius, 16, 8);
   const endLeft = ensureNonIndexed(endLeftRaw);
   endLeft.translate(-1.38, 0.22, 0);
   redParts.push(endLeft);
   endLeftRaw.dispose();

   const endRightRaw = new SphereGeometry(segRadius, 16, 8);
   const endRight = ensureNonIndexed(endRightRaw);
   endRight.translate(1.38, 0.22, 0);
   redParts.push(endRight);
   endRightRaw.dispose();

   const redGeom = mergeGeometries(redParts, false);
   redParts.forEach((part) => part.dispose());
   const whiteGeom = mergeGeometries(whiteParts, false);
   whiteParts.forEach((part) => part.dispose());
   const hubGeom = mergeGeometries(hubParts, false);
   hubParts.forEach((part) => part.dispose());

   if (!redGeom || !whiteGeom || !hubGeom) {
      redGeom?.dispose();
      whiteGeom?.dispose();
      hubGeom?.dispose();
      throw new Error("SweeperBar: failed to merge group geometries");
   }

   const fullGeom = mergeGeometries([redGeom, whiteGeom, hubGeom], true);
   redGeom.dispose();
   whiteGeom.dispose();
   hubGeom.dispose();
   if (!fullGeom) {
      throw new Error("SweeperBar: failed to merge final geometries");
   }

   fullGeom.computeVertexNormals();
   fullGeom.computeBoundingBox();
   return fullGeom;
}

let cachedGeometry: BufferGeometry | null = null;

export function getSharedSweeperBarGeometry(): BufferGeometry {
   if (!cachedGeometry) {
      cachedGeometry = buildSweeperBarGeometry();
   }
   return cachedGeometry;
}

let sharedDefaultMaterials: [MeshStandardMaterial, MeshStandardMaterial, MeshStandardMaterial] | null = null;

function getSharedSweeperBarMaterials(color?: string, accent?: string): [MeshStandardMaterial, MeshStandardMaterial, MeshStandardMaterial] {
   if (!color && !accent) {
      if (!sharedDefaultMaterials) {
         sharedDefaultMaterials = [
            new MeshStandardMaterial({ color: SWEEPER_BAR_COLORS.red, roughness: 0.7 }),
            new MeshStandardMaterial({ color: SWEEPER_BAR_COLORS.white, roughness: 0.7 }),
            new MeshStandardMaterial({ color: SWEEPER_BAR_COLORS.hub, roughness: 0.5, metalness: 0.4 }),
         ];
      }
      return sharedDefaultMaterials;
   }
   return [
      new MeshStandardMaterial({ color: color ?? SWEEPER_BAR_COLORS.red, roughness: 0.7 }),
      new MeshStandardMaterial({ color: accent ?? SWEEPER_BAR_COLORS.white, roughness: 0.7 }),
      new MeshStandardMaterial({ color: SWEEPER_BAR_COLORS.hub, roughness: 0.5, metalness: 0.4 }),
   ];
}

export const SweeperBar = forwardRef<Group, SweeperBarProps>(function SweeperBar({ color, accent, ...groupProps }, ref) {
   const geometry = useMemo(() => getSharedSweeperBarGeometry(), []);
   const materials = useMemo(() => getSharedSweeperBarMaterials(color, accent), [color, accent]);

   return (
      <group ref={ref} {...groupProps} name="prop-sweeper-bar">
         <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
   );
});
