"use client";

// Menu 2 "Color Roll Heroes" prop: CheckpointPad.
// A round stone floor pad with an inlaid glowing ring on top and a short beacon post at its back edge
// topped by a glowing orb. Built in code so the bevelled stone and the emissive accents read clean from the
// high third-person camera. Two meshes = two draw calls: the matte stone (pad disc + rim + post, merged,
// vertex-coloured) and the glow (inlaid ring + orb, merged, vertex-coloured emissive). Both geometries are
// pure and colour-agnostic; the two materials carry the tones.
//
// Real-world size (metres): pad 2.0 wide (radius 1.0) x 0.25 thick, standing on y = 0. The beacon post is
// 1.2 tall from the pad top, set at the pad's back edge (z = -(radius - 0.20)), with a 0.15-radius orb at
// its head. Union footprint ~2.0 x 2.0, ~1.7 tall.
import { useEffect, useMemo } from "react";
import {
   BufferAttribute,
   Color,
   CylinderGeometry,
   ExtrudeGeometry,
   Shape,
   SphereGeometry,
   TorusGeometry,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Checkpoint pad size in metres: 2.0 wide, 0.25 thick, 1.2 beacon post, 0.15-radius orb. */
export const CHECKPOINT_PAD_SIZE = {
   w: 2.0,
   d: 2.0,
   h: 0.25,
   postH: 1.2,
   orbR: 0.15,
} as const;

/** Default tones: warm stone, golden glow. */
const DEFAULT_COLOR = "#ddd6c6";
const DEFAULT_ACCENT = "#ffc94d";

const PAD_R = CHECKPOINT_PAD_SIZE.w / 2;
const PAD_T = CHECKPOINT_PAD_SIZE.h;
const POST_H = CHECKPOINT_PAD_SIZE.postH;
const POST_Z = -(PAD_R - 0.2);
const ORB_R = CHECKPOINT_PAD_SIZE.orbR;

// Bevel amounts shared by the extruded discs (the pad and the post base sit flush on y = 0).
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

/** Paint every part and merge into one vertex-coloured geometry, freeing the intermediates. */
function mergeColored(parts: { geometry: BufferGeometry; color: string }[], what: string): BufferGeometry {
   const painted = parts.map((part) => paint(part.geometry, part.color));
   const merged = mergeGeometries(painted);
   painted.forEach((geometry) => geometry.dispose());
   if (!merged) throw new Error(`checkpoint pad: the ${what} did not merge`);
   return merged;
}

/**
 * The matte stone: the pad disc, a darker rim torus round its top edge, and the beacon post at the back
 * edge, merged into one vertex-coloured geometry. Pure and colour-agnostic: `base` is the stone tone,
 * `dark` the rim shade (2-tone). Stands on y = 0; the post head reaches y = PAD_T + POST_H.
 */
export function buildCheckpointStoneGeometry(base: string, dark: string): BufferGeometry {
   const rim = new TorusGeometry(PAD_R - 0.06, 0.055, 6, 18);
   rim.rotateX(-Math.PI / 2);
   rim.translate(0, PAD_T - 0.03, 0);
   const post = new CylinderGeometry(0.07, 0.1, POST_H, 10);
   post.translate(0, PAD_T + POST_H / 2, POST_Z);
   return mergeColored(
      [
         { geometry: disc(PAD_R, PAD_T, 24), color: base },
         { geometry: rim, color: dark },
         { geometry: post, color: dark },
      ],
      "stone"
   );
}

/**
 * The glow: the inlaid ring on the pad top and the orb on the post head, merged into one vertex-coloured
 * geometry (drawn with an emissive material). Pure and colour-agnostic: `accent` is the glow tone.
 */
export function buildCheckpointGlowGeometry(accent: string): BufferGeometry {
   const ring = new TorusGeometry(PAD_R - 0.32, 0.05, 6, 26);
   ring.rotateX(-Math.PI / 2);
   ring.translate(0, PAD_T - 0.012, 0);
   const orb = new SphereGeometry(ORB_R, 14, 10);
   orb.translate(0, PAD_T + POST_H + ORB_R * 0.65, POST_Z);
   return mergeColored(
      [
         { geometry: ring, color: accent },
         { geometry: orb, color: accent },
      ],
      "glow"
   );
}

export interface CheckpointPadProps {
   /** Stone tone (the pad and post). Default warm stone. */
   color?: string;
   /** Glow tone (the inlaid ring and the orb). Default golden. */
   accent?: string;
}

/** The pad: two meshes (stone + glow), two draw calls, ~1.4k triangles. */
export function CheckpointPad({ color = DEFAULT_COLOR, accent = DEFAULT_ACCENT }: CheckpointPadProps) {
   const built = useMemo(() => {
      const dark = new Color(color).multiplyScalar(0.82).getStyle();
      const stone = buildCheckpointStoneGeometry(color, dark);
      const glow = buildCheckpointGlowGeometry(accent);
      return { stone, glow };
   }, [color, accent]);

   useEffect(
      () => () => {
         built.stone.dispose();
         built.glow.dispose();
      },
      [built]
   );

   return (
      <group name="checkpoint-pad">
         <mesh geometry={built.stone} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.74} metalness={0.02} />
         </mesh>
         <mesh geometry={built.glow}>
            <meshStandardMaterial
               vertexColors
               emissive={new Color(accent)}
               emissiveIntensity={1.4}
               roughness={0.5}
               metalness={0}
            />
         </mesh>
      </group>
   );
}
