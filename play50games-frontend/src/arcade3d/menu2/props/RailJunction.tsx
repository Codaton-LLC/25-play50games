"use client";

// A Y-split grind rail: 4.0 m long x 0.51 m high x 1.37 m wide.
// Thick 0.12 m round steel rails splitting smoothly at 30 degrees (±15°),
// supported on 3 short chunky industrial steel posts with square baseplates. 2 draw calls, under 2k triangles.
import { forwardRef, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import {
   BoxGeometry,
   CatmullRomCurve3,
   CylinderGeometry,
   MeshStandardMaterial,
   SphereGeometry,
   TubeGeometry,
   Vector3,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Real-world dimensions in metres (4.0 x 0.51 x 1.37 m). */
export const RAIL_JUNCTION_SIZE = {
   w: 4.0,
   h: 0.51,
   d: 1.37,
   length: 4.0,
   width: 1.37,
   height: 0.51,
   railDiameter: 0.12,
} as const;

export const RAIL_JUNCTION_COLORS = {
   rails: "#cbd5e1",
   posts: "#334155",
} as const;

export interface RailJunctionProps extends Omit<GroupProps, "children"> {
   /** Grind rail steel colour (default: bright steel #cbd5e1). */
   color?: string;
   /** Support post and baseplate colour (default: dark slate #334155). */
   accent?: string;
}

function ensureNonIndexed(geom: BufferGeometry): BufferGeometry {
   return geom.index ? geom.toNonIndexed() : geom;
}

/**
 * Builds the complete standalone RailJunction geometry: smooth round steel rails + endcaps (group 0)
 * and 3 chunky support posts with mounting plates (group 1). Produces finite bounds testable without a canvas.
 */
export function buildRailJunctionGeometry(): BufferGeometry {
   const railParts: BufferGeometry[] = [];
   const postParts: BufferGeometry[] = [];
   const rRail = 0.06;
   const hRail = 0.45;

   // Main stem and left branch path (+15 degrees fork)
   const pathLeft = new CatmullRomCurve3([
      new Vector3(0.06, hRail, 0),
      new Vector3(1.4, hRail, 0),
      new Vector3(2.0, hRail, 0.105),
      new Vector3(3.94, hRail, 0.627),
   ]);
   const tubeLeftRaw = new TubeGeometry(pathLeft, 20, rRail, 10, false);
   const tubeLeft = ensureNonIndexed(tubeLeftRaw);
   railParts.push(tubeLeft);
   tubeLeftRaw.dispose();

   // Right branch path (-15 degrees fork, meeting at junction x = 1.6)
   const pathRight = new CatmullRomCurve3([
      new Vector3(1.6, hRail, 0),
      new Vector3(2.0, hRail, -0.105),
      new Vector3(3.94, hRail, -0.627),
   ]);
   const tubeRightRaw = new TubeGeometry(pathRight, 16, rRail, 10, false);
   const tubeRight = ensureNonIndexed(tubeRightRaw);
   railParts.push(tubeRight);
   tubeRightRaw.dispose();

   // Protective rounded rail caps
   const cap0Raw = new SphereGeometry(rRail, 10, 8);
   const cap0 = ensureNonIndexed(cap0Raw);
   cap0.translate(0.06, hRail, 0);
   railParts.push(cap0);
   cap0Raw.dispose();

   const cap1Raw = new SphereGeometry(rRail, 10, 8);
   const cap1 = ensureNonIndexed(cap1Raw);
   cap1.translate(3.94, hRail, 0.627);
   railParts.push(cap1);
   cap1Raw.dispose();

   const cap2Raw = new SphereGeometry(rRail, 10, 8);
   const cap2 = ensureNonIndexed(cap2Raw);
   cap2.translate(3.94, hRail, -0.627);
   railParts.push(cap2);
   cap2Raw.dispose();

   // Three chunky posts supporting the rails
   function addPost(px: number, pz: number) {
      const colRaw = new CylinderGeometry(0.08, 0.08, hRail - 0.02, 12);
      const col = ensureNonIndexed(colRaw);
      col.translate(px, (hRail - 0.02) / 2 + 0.02, pz);
      postParts.push(col);
      colRaw.dispose();

      const baseRaw = new BoxGeometry(0.26, 0.04, 0.26);
      const base = ensureNonIndexed(baseRaw);
      base.translate(px, 0.02, pz);
      postParts.push(base);
      baseRaw.dispose();
   }

   addPost(0.6, 0);
   addPost(3.5, 0.509);
   addPost(3.5, -0.509);

   const railsGeom = mergeGeometries(railParts, false);
   railParts.forEach((part) => part.dispose());
   const postsGeom = mergeGeometries(postParts, false);
   postParts.forEach((part) => part.dispose());

   if (!railsGeom || !postsGeom) {
      railsGeom?.dispose();
      postsGeom?.dispose();
      throw new Error("RailJunction: failed to merge group geometries");
   }

   const fullGeom = mergeGeometries([railsGeom, postsGeom], true);
   railsGeom.dispose();
   postsGeom.dispose();
   if (!fullGeom) {
      throw new Error("RailJunction: failed to merge final geometries");
   }

   fullGeom.computeVertexNormals();
   fullGeom.computeBoundingBox();
   return fullGeom;
}

let cachedGeometry: BufferGeometry | null = null;

export function getSharedRailJunctionGeometry(): BufferGeometry {
   if (!cachedGeometry) {
      cachedGeometry = buildRailJunctionGeometry();
   }
   return cachedGeometry;
}

let sharedDefaultMaterials: [MeshStandardMaterial, MeshStandardMaterial] | null = null;

function getSharedRailJunctionMaterials(color?: string, accent?: string): [MeshStandardMaterial, MeshStandardMaterial] {
   if (!color && !accent) {
      if (!sharedDefaultMaterials) {
         sharedDefaultMaterials = [
            new MeshStandardMaterial({ color: RAIL_JUNCTION_COLORS.rails, roughness: 0.35, metalness: 0.8 }),
            new MeshStandardMaterial({ color: RAIL_JUNCTION_COLORS.posts, roughness: 0.65, metalness: 0.4 }),
         ];
      }
      return sharedDefaultMaterials;
   }
   return [
      new MeshStandardMaterial({ color: color ?? RAIL_JUNCTION_COLORS.rails, roughness: 0.35, metalness: 0.8 }),
      new MeshStandardMaterial({ color: accent ?? RAIL_JUNCTION_COLORS.posts, roughness: 0.65, metalness: 0.4 }),
   ];
}

export const RailJunction = forwardRef<Group, RailJunctionProps>(function RailJunction({ color, accent, ...groupProps }, ref) {
   const geometry = useMemo(() => getSharedRailJunctionGeometry(), []);
   const materials = useMemo(() => getSharedRailJunctionMaterials(color, accent), [color, accent]);

   return (
      <group ref={ref} {...groupProps} name="prop-rail-junction">
         <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
   );
});
