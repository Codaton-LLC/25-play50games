"use client";

// The ball-roll's shell: the hero curled into an armoured ball, built in code from its colours
// (heroAnimLandmarks.ts HERO_LOOK). Two meshes, two draw calls: the plates (one vertex-coloured
// sphere) and the glowing seams (one merged set of rings).
//
// The plates: the sphere's poles are on the roll axis (x, the hero's left-right), and eight plates
// run round it from pole to pole like the overlapping bands of a curled armadillo. Each plate is a
// shingle (its back edge lies a little under the next plate's front edge), lighter in the middle,
// darker where it overlaps; so the bands sweep past as the ball rolls and the spin reads at any speed.
// The poles, where the head and the tail tuck in, are the dark plate colour.
import { useEffect, useMemo } from "react";
import { BufferAttribute, Color, MeshStandardMaterial, SphereGeometry, TorusGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HeroBallLook } from "./heroAnimLandmarks";

/** Plates round the ball. */
export const BALL_PLATES = 8;
/** The shingle's step: a plate's back edge stands this much (× radius) proud of the next one's front. */
const SHINGLE = 0.045;

/**
 * The shell's two geometries at radius 1 (the group scales them): `plates` (vertex colours) and
 * `seams` (the glowing rings: a great circle per plate edge pair through the poles, and the equator
 * round the roll axis). Built once per look.
 */
export function buildHeroBallGeometry(look: HeroBallLook): { plates: BufferGeometry; seams: BufferGeometry } {
   const segments = BALL_PLATES * 6;
   const sphere = new SphereGeometry(1, segments, 24);
   // SphereGeometry's poles are on y: turn them onto x, the roll axis
   sphere.rotateZ(Math.PI / 2);
   const pos = sphere.getAttribute("position");
   const colors = new Float32Array(pos.count * 3);
   const plate = new Color(look.plate);
   const dark = new Color(look.plateDark);
   const c = new Color();
   for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // the angle round the roll axis -> which plate, and where in it (0 = its front edge .. 1 = back)
      const a = (Math.atan2(z, y) + Math.PI * 2) % (Math.PI * 2);
      const u = (a / (Math.PI * 2)) * BALL_PLATES;
      const f = u - Math.floor(u);
      // the shingle: the plate rises from its front edge to its back edge, then drops to the next
      const pole = Math.abs(x);
      const near = 1 - pole * pole;
      const r = 1 + SHINGLE * f * near;
      pos.setXYZ(i, x * r, y * r, z * r);
      // light in the plate's middle, dark at the overlap and at the poles
      const mid = Math.sin(Math.PI * Math.min(1, f * 1.15));
      const k = Math.max(0, Math.min(1, 0.35 + 0.65 * mid)) * Math.min(1, near * 1.6);
      c.copy(dark).lerp(plate, k);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
   }
   sphere.setAttribute("color", new BufferAttribute(colors, 3));
   sphere.computeVertexNormals();

   const rings: BufferGeometry[] = [];
   for (let k = 0; k < BALL_PLATES / 2; k++) {
      // a great circle through the poles (x) at the k-th plate edge: the torus lies in xy, turned about x
      const ring = new TorusGeometry(1.012, 0.016, 6, 64);
      ring.rotateX((k * Math.PI * 2) / BALL_PLATES);
      rings.push(ring);
   }
   // the equator round the roll axis (a wheel line)
   const equator = new TorusGeometry(1.03, 0.022, 6, 64);
   equator.rotateY(Math.PI / 2);
   rings.push(equator);
   const seams = mergeGeometries(rings);
   rings.forEach((g) => g.dispose());
   if (!seams) throw new Error("hero ball: the seams did not merge");
   return { plates: sphere, seams };
}

/** The shell, radius 1: the caller's group places, scales (radius × shell) and rolls it. */
export function HeroBall({ look, glow = 1.6 }: { look: HeroBallLook; glow?: number }) {
   const built = useMemo(() => {
      const geometry = buildHeroBallGeometry(look);
      const plates = new MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.25 });
      const seams = new MeshStandardMaterial({ color: look.glow, emissive: new Color(look.glow), emissiveIntensity: glow, roughness: 0.4 });
      return { ...geometry, plateMaterial: plates, seamMaterial: seams };
   }, [look, glow]);
   useEffect(
      () => () => {
         built.plates.dispose();
         built.seams.dispose();
         built.plateMaterial.dispose();
         built.seamMaterial.dispose();
      },
      [built]
   );
   return (
      <>
         <mesh geometry={built.plates} material={built.plateMaterial} castShadow />
         <mesh geometry={built.seams} material={built.seamMaterial} />
      </>
   );
}
