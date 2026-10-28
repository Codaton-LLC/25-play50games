"use client";

// Menu 2 "Color Roll Heroes" prop: GrapplePost.
// A 4 m wooden pole on a bevelled stone base with a big chunky metal ring (0.9 m diameter) mounted on its
// top - the grapple target. Built in code so the bevel, the wood grain-free matte finish and the metal ring
// read clean from the high third-person camera. Two meshes = two draw calls: the stone base and the pole
// merged into one vertex-coloured geometry (2 tones), and the metal ring on its own metalness material.
//
// Real-world size (metres): stone base 1.24 across x 0.4 tall standing on y = 0, pole 4.0 tall from the
// base top (0.32 across, slight taper), ring 0.9 diameter x 0.16 tube mounted at the pole head so its top
// reaches ~4.93. Total height ~4.93.
import { useEffect, useMemo } from "react";
import {
   BufferAttribute,
   Color,
   CylinderGeometry,
   ExtrudeGeometry,
   Shape,
   TorusGeometry,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Grapple post size in metres: 4.0 pole on a 1.24 x 0.4 stone base, 0.9 ring on top (~4.93 total). */
export const GRAPPLE_POST_SIZE = {
   w: 1.24,
   d: 1.24,
   h: 4.93,
   baseH: 0.4,
   poleH: 4.0,
   poleR: 0.16,
   ringD: 0.9,
   ringTube: 0.08,
} as const;

/** Default tones: warm wood, cool chunky metal. */
const DEFAULT_COLOR = "#8a5a34";
const DEFAULT_ACCENT = "#7d8794";

const BASE_R = GRAPPLE_POST_SIZE.w / 2;
const BASE_H = GRAPPLE_POST_SIZE.baseH;
const POLE_H = GRAPPLE_POST_SIZE.poleH;
const POLE_R = GRAPPLE_POST_SIZE.poleR;

// Bevel amounts, shared so the drawn outline lands the bounding box exactly on spec.
const BEVEL = 0.04;
const BEVEL_T = 0.04;

/** A bevelled disc, radius R, thickness T, standing on y = 0, centred on x/z. Pure helper. */
function disc(R: number, T: number, segments: number): BufferGeometry {
   const shape = new Shape();
   shape.absarc(0, 0, R - BEVEL, 0, Math.PI * 2, false);
   const geometry = new ExtrudeGeometry(shape, {
      depth: T - 2 * BEVEL_T,
      bevelEnabled: true,
      bevelThickness: BEVEL_T,
      bevelSize: BEVEL,
      bevelSegments: 2,
      curveSegments: segments,
      steps: 1,
   });
   geometry.rotateX(-Math.PI / 2);
   geometry.translate(0, BEVEL_T, 0);
   return geometry;
}

/** Paint a geometry with a flat vertex colour (de-indexed so parts merge cleanly), freeing the input. */
function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
   const color = new Color(hex);
   const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
   const count = nonIndexed.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   nonIndexed.setAttribute("color", new BufferAttribute(colors, 3));
   if (nonIndexed !== geometry) geometry.dispose();
   return nonIndexed;
}

/**
 * The stone base and the wooden pole, merged into one vertex-coloured geometry. Pure: `wood` and `stone`
 * are hex tones baked into the vertex colours (2 tones). Stands on y = 0; the pole head reaches
 * y = baseH + poleH (4.4).
 */
export function buildGrapplePostGeometry(wood: string, stone: string): BufferGeometry {
   const pole = new CylinderGeometry(POLE_R - 0.02, POLE_R + 0.02, POLE_H, 14);
   pole.translate(0, BASE_H + POLE_H / 2, 0);
   const painted = [paint(disc(BASE_R, BASE_H, 20), stone), paint(pole, wood)];
   const merged = mergeGeometries(painted);
   painted.forEach((geometry) => geometry.dispose());
   if (!merged) throw new Error("grapple post: the post did not merge");
   return merged;
}

/**
 * The chunky metal ring, a torus standing upright at the pole head so it reads as a grapple target.
 * Pure and colour-agnostic: the material supplies the metal tone. Its centre is at y = baseH + poleH.
 */
export function buildGrappleRingGeometry(): BufferGeometry {
   const ring = new TorusGeometry(GRAPPLE_POST_SIZE.ringD / 2, GRAPPLE_POST_SIZE.ringTube, 8, 22);
   ring.translate(0, BASE_H + POLE_H, 0);
   return ring;
}

export interface GrapplePostProps {
   /** Wood tone (the pole); the stone base is this mixed toward a neutral stone. Default warm wood. */
   color?: string;
   /** Metal tone (the ring). Default cool grey metal. */
   accent?: string;
}

/** The post: two meshes (stone + pole, ring), two draw calls, ~0.9k triangles. */
export function GrapplePost({ color = DEFAULT_COLOR, accent = DEFAULT_ACCENT }: GrapplePostProps) {
   const built = useMemo(() => {
      const stone = new Color(color).lerp(new Color("#cfcabf"), 0.72).getStyle();
      const post = buildGrapplePostGeometry(color, stone);
      const ring = buildGrappleRingGeometry();
      return { post, ring };
   }, [color]);

   useEffect(
      () => () => {
         built.post.dispose();
         built.ring.dispose();
      },
      [built]
   );

   return (
      <group name="grapple-post">
         <mesh geometry={built.post} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.76} metalness={0.02} />
         </mesh>
         <mesh geometry={built.ring} castShadow>
            <meshStandardMaterial color={accent} roughness={0.5} metalness={0.72} />
         </mesh>
      </group>
   );
}
