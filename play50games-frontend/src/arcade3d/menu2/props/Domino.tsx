"use client";

// A standing toy domino prop: 0.5 m wide x 1.0 m tall x 0.15 m thick.
// Cream ceramic/resin body with bevelled edges, two dark pip groups (5 top, 3 bottom)
// and a dark divider line across the centre. 2 draw calls, under 2k triangles.
import { forwardRef, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import {
   BoxGeometry,
   CylinderGeometry,
   ExtrudeGeometry,
   MeshStandardMaterial,
   Shape,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Real-world dimensions in metres (0.5 x 1.0 x 0.15 m). */
export const DOMINO_SIZE = {
   w: 0.5,
   h: 1.0,
   d: 0.15,
} as const;

export const DOMINO_COLORS = {
   body: "#f5f0e6",
   accent: "#22252a",
} as const;

export interface DominoProps extends Omit<GroupProps, "children"> {
   /** Body ceramic/resin colour (default: cream #f5f0e6). */
   color?: string;
   /** Pip and divider line colour (default: dark charcoal #22252a). */
   accent?: string;
}

function ensureNonIndexed(geom: BufferGeometry): BufferGeometry {
   return geom.index ? geom.toNonIndexed() : geom;
}

/**
 * Builds the complete standalone Domino geometry: bevelled slab body (group 0)
 * and raised dark pips + divider line (group 1). Produces finite bounds testable without a canvas.
 */
export function buildDominoGeometry(): BufferGeometry {
   const w = DOMINO_SIZE.w;
   const h = DOMINO_SIZE.h;
   const d = DOMINO_SIZE.d;
   const bevel = 0.012;
   const r = bevel;

   const shape = new Shape();
   const x0 = -w / 2 + bevel;
   const x1 = w / 2 - bevel;
   const y0 = bevel;
   const y1 = h - bevel;

   shape.moveTo(x0 + r, y0);
   shape.lineTo(x1 - r, y0);
   shape.quadraticCurveTo(x1, y0, x1, y0 + r);
   shape.lineTo(x1, y1 - r);
   shape.quadraticCurveTo(x1, y1, x1 - r, y1);
   shape.lineTo(x0 + r, y1);
   shape.quadraticCurveTo(x0, y1, x0, y1 - r);
   shape.lineTo(x0, y0 + r);
   shape.quadraticCurveTo(x0, y0, x0 + r, y0);

   const bodyRaw = new ExtrudeGeometry(shape, {
      depth: d - bevel * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
   });
   const bodyGeom = ensureNonIndexed(bodyRaw);
   bodyGeom.translate(0, 0, -(d - bevel * 2) / 2);
   bodyRaw.dispose();

   const accentParts: BufferGeometry[] = [];

   // Divider line bar
   const dividerRaw = new BoxGeometry(0.42, 0.014, 0.004);
   const divider = ensureNonIndexed(dividerRaw);
   divider.translate(0, 0.5, d / 2 + 0.001);
   accentParts.push(divider);
   dividerRaw.dispose();

   // Pip groups: 5 top, 3 bottom
   const pipCoords: readonly (readonly [number, number])[] = [
      [-0.11, 0.86], [0.11, 0.86], [0, 0.75], [-0.11, 0.64], [0.11, 0.64],
      [-0.11, 0.36], [0, 0.25], [0.11, 0.14],
   ];

   for (const [px, py] of pipCoords) {
      const pipRaw = new CylinderGeometry(0.024, 0.024, 0.004, 16);
      const pip = ensureNonIndexed(pipRaw);
      pip.rotateX(Math.PI / 2);
      pip.translate(px, py, d / 2 + 0.001);
      accentParts.push(pip);
      pipRaw.dispose();
   }

   const accentGeom = mergeGeometries(accentParts, false);
   accentParts.forEach((part) => part.dispose());
   if (!accentGeom) {
      bodyGeom.dispose();
      throw new Error("Domino: failed to merge accent geometries");
   }

   const fullGeom = mergeGeometries([bodyGeom, accentGeom], true);
   bodyGeom.dispose();
   accentGeom.dispose();
   if (!fullGeom) {
      throw new Error("Domino: failed to merge body and accent geometries");
   }

   fullGeom.computeVertexNormals();
   fullGeom.computeBoundingBox();
   return fullGeom;
}

let cachedGeometry: BufferGeometry | null = null;

export function getSharedDominoGeometry(): BufferGeometry {
   if (!cachedGeometry) {
      cachedGeometry = buildDominoGeometry();
   }
   return cachedGeometry;
}

let sharedDefaultMaterials: [MeshStandardMaterial, MeshStandardMaterial] | null = null;

function getSharedDominoMaterials(color?: string, accent?: string): [MeshStandardMaterial, MeshStandardMaterial] {
   if (!color && !accent) {
      if (!sharedDefaultMaterials) {
         sharedDefaultMaterials = [
            new MeshStandardMaterial({ color: DOMINO_COLORS.body, roughness: 0.65 }),
            new MeshStandardMaterial({ color: DOMINO_COLORS.accent, roughness: 0.7 }),
         ];
      }
      return sharedDefaultMaterials;
   }
   return [
      new MeshStandardMaterial({ color: color ?? DOMINO_COLORS.body, roughness: 0.65 }),
      new MeshStandardMaterial({ color: accent ?? DOMINO_COLORS.accent, roughness: 0.7 }),
   ];
}

export const Domino = forwardRef<Group, DominoProps>(function Domino({ color, accent, ...groupProps }, ref) {
   const geometry = useMemo(() => getSharedDominoGeometry(), []);
   const materials = useMemo(() => getSharedDominoMaterials(color, accent), [color, accent]);

   return (
      <group ref={ref} {...groupProps} name="prop-domino">
         <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
   );
});
