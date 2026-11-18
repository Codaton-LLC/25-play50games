"use client";

// A hazard spike block: 1.0 m wide x 1.15 m high x 1.0 m deep.
// 1.0 m bevelled dark graphite cube with a 3x3 grid of short glowing magenta pyramid spikes
// on top and glowing magenta perimeter edge strips. 2 draw calls, under 2k triangles.
import { forwardRef, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import {
   BoxGeometry,
   Color,
   ConeGeometry,
   ExtrudeGeometry,
   MeshStandardMaterial,
   Shape,
   type BufferGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Real-world dimensions in metres (1.0 m cube, 1.15 m total height with spikes). */
export const SPIKE_BLOCK_SIZE = {
   w: 1.0,
   h: 1.15,
   d: 1.0,
   cubeSize: 1.0,
   spikeHeight: 0.15,
} as const;

export const SPIKE_BLOCK_COLORS = {
   cube: "#1e2124",
   glow: "#d946ef",
   glowTint: "#f472b6",
} as const;

export interface SpikeBlockProps extends Omit<GroupProps, "children"> {
   /** Graphite cube body colour (default: dark graphite #1e2124). */
   color?: string;
   /** Glowing spike and edge colour (default: glowing magenta #d946ef). */
   accent?: string;
}

function ensureNonIndexed(geom: BufferGeometry): BufferGeometry {
   return geom.index ? geom.toNonIndexed() : geom;
}

/**
 * Builds the complete standalone SpikeBlock geometry: bevelled graphite cube (group 0)
 * and 3x3 glowing pyramid spikes + glowing edge strips (group 1). Produces finite bounds testable without a canvas.
 */
export function buildSpikeBlockGeometry(): BufferGeometry {
   const w = 1.0;
   const h = 1.0;
   const d = 1.0;
   const bevel = 0.02;
   const r = bevel;

   // 2D bevelled cube profile
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

   const cubeRaw = new ExtrudeGeometry(shape, {
      depth: d - bevel * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
   });
   const cubeGeom = ensureNonIndexed(cubeRaw);
   cubeGeom.translate(0, 0, -(d - bevel * 2) / 2);
   cubeRaw.dispose();

   const glowParts: BufferGeometry[] = [];
   const spikeH = SPIKE_BLOCK_SIZE.spikeHeight;
   const spikeR = 0.113; // 0.16m / sqrt(2) base size
   const coords = [-0.28, 0, 0.28];

   // 3x3 pyramid spikes on top
   for (const sx of coords) {
      for (const sz of coords) {
         const spikeRaw = new ConeGeometry(spikeR, spikeH, 4);
         const spike = ensureNonIndexed(spikeRaw);
         spike.rotateY(Math.PI / 4);
         spike.translate(sx, h + spikeH / 2, sz);
         glowParts.push(spike);
         spikeRaw.dispose();
      }
   }

   // Glowing edge strips along top perimeter
   const stripW = 0.03;
   const stripL = 0.86;
   const stripThick = 0.006;

   const sNorthRaw = new BoxGeometry(stripL, stripThick, stripW);
   const sNorth = ensureNonIndexed(sNorthRaw);
   sNorth.translate(0, h + stripThick / 2, 0.44);
   glowParts.push(sNorth);
   sNorthRaw.dispose();

   const sSouthRaw = new BoxGeometry(stripL, stripThick, stripW);
   const sSouth = ensureNonIndexed(sSouthRaw);
   sSouth.translate(0, h + stripThick / 2, -0.44);
   glowParts.push(sSouth);
   sSouthRaw.dispose();

   const sEastRaw = new BoxGeometry(stripW, stripThick, stripL - stripW * 2);
   const sEast = ensureNonIndexed(sEastRaw);
   sEast.translate(0.44, h + stripThick / 2, 0);
   glowParts.push(sEast);
   sEastRaw.dispose();

   const sWestRaw = new BoxGeometry(stripW, stripThick, stripL - stripW * 2);
   const sWest = ensureNonIndexed(sWestRaw);
   sWest.translate(-0.44, h + stripThick / 2, 0);
   glowParts.push(sWest);
   sWestRaw.dispose();

   const glowGeom = mergeGeometries(glowParts, false);
   glowParts.forEach((part) => part.dispose());
   if (!glowGeom) {
      cubeGeom.dispose();
      throw new Error("SpikeBlock: failed to merge glow geometries");
   }

   const fullGeom = mergeGeometries([cubeGeom, glowGeom], true);
   cubeGeom.dispose();
   glowGeom.dispose();
   if (!fullGeom) {
      throw new Error("SpikeBlock: failed to merge final geometries");
   }

   fullGeom.computeVertexNormals();
   fullGeom.computeBoundingBox();
   return fullGeom;
}

let cachedGeometry: BufferGeometry | null = null;

export function getSharedSpikeBlockGeometry(): BufferGeometry {
   if (!cachedGeometry) {
      cachedGeometry = buildSpikeBlockGeometry();
   }
   return cachedGeometry;
}

let sharedDefaultMaterials: [MeshStandardMaterial, MeshStandardMaterial] | null = null;

function getSharedSpikeBlockMaterials(color?: string, accent?: string): [MeshStandardMaterial, MeshStandardMaterial] {
   const glowColor = accent ?? SPIKE_BLOCK_COLORS.glow;
   if (!color && !accent) {
      if (!sharedDefaultMaterials) {
         sharedDefaultMaterials = [
            new MeshStandardMaterial({ color: SPIKE_BLOCK_COLORS.cube, roughness: 0.75, metalness: 0.2 }),
            new MeshStandardMaterial({
               color: SPIKE_BLOCK_COLORS.glowTint,
               emissive: new Color(SPIKE_BLOCK_COLORS.glow),
               emissiveIntensity: 2.0,
               roughness: 0.35,
            }),
         ];
      }
      return sharedDefaultMaterials;
   }
   return [
      new MeshStandardMaterial({ color: color ?? SPIKE_BLOCK_COLORS.cube, roughness: 0.75, metalness: 0.2 }),
      new MeshStandardMaterial({
         color: glowColor,
         emissive: new Color(glowColor),
         emissiveIntensity: 2.0,
         roughness: 0.35,
      }),
   ];
}

export const SpikeBlock = forwardRef<Group, SpikeBlockProps>(function SpikeBlock({ color, accent, ...groupProps }, ref) {
   const geometry = useMemo(() => getSharedSpikeBlockGeometry(), []);
   const materials = useMemo(() => getSharedSpikeBlockMaterials(color, accent), [color, accent]);

   return (
      <group ref={ref} {...groupProps} name="prop-spike-block">
         <mesh geometry={geometry} material={materials} castShadow receiveShadow />
      </group>
   );
});
