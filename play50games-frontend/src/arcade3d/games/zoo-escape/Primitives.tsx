"use client";

// Zoo Escape's procedural visual pieces: every stand-in is one merged, vertex-coloured mesh
// (one draw call, two or three tones, bevel-like rounded shapes), so every piece looks
// deliberate and polished. Built once per mount and disposed with it.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   BufferAttribute,
   CapsuleGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   SphereGeometry,
   TorusGeometry,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLORS } from "./looks";

export { COLORS } from "./looks";

export type Piece = [geometry: BufferGeometry, color: string];

/** Merges pieces into one geometry with a vertex colour per piece (each piece's geometry is disposed). */
export function mergePieces(pieces: Piece[]): BufferGeometry {
   const c = new Color();
   const parts = pieces.map(([g, color]) => {
      // polyhedra are non-indexed, the rest indexed: merge them all non-indexed
      const geo = g.index ? g.toNonIndexed() : g;
      if (geo !== g) g.dispose();
      const n = geo.getAttribute("position").count;
      const col = new Float32Array(n * 3);
      c.set(color);
      for (let i = 0; i < n; i++) {
         col[i * 3] = c.r;
         col[i * 3 + 1] = c.g;
         col[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new BufferAttribute(col, 3));
      if (!geo.getAttribute("uv")) geo.setAttribute("uv", new BufferAttribute(new Float32Array(n * 2), 2));
      return geo;
   });
   const merged = mergeGeometries(parts)!;
   for (const p of parts) p.dispose();
   return merged;
}

/** A merged geometry built once per mount, disposed on unmount. */
export function useMerged(build: () => Piece[]): BufferGeometry {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const geometry = useMemo(() => mergePieces(build()), []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return geometry;
}

const at = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

// ---------- characters ----------

/** Panda stand-in: 1.15 m long on all fours, head +z, rounded shapes in 3 tones. */
export function pandaPieces(): Piece[] {
   const p: Piece[] = [
      // Body: white barrel torso with rounded ends
      [at(new SphereGeometry(0.36, 18, 14).scale(1.05, 0.95, 1.45), 0, 0.5, -0.02), COLORS.white],
      // Shoulder saddle band: black
      [at(new SphereGeometry(0.37, 18, 12).scale(1.08, 0.92, 0.62), 0, 0.53, 0.18), COLORS.black],
      // Head: white sphere
      [at(new SphereGeometry(0.27, 18, 14), 0, 0.68, 0.46), COLORS.white],
      // Muzzle / snout
      [at(new SphereGeometry(0.12, 12, 10).scale(1.1, 0.85, 1.1), 0, 0.63, 0.66), COLORS.white],
      // Eye patches: black angled ovals
      [at(new SphereGeometry(0.075, 10, 8).scale(1.2, 0.8, 0.5).rotateZ(0.25), -0.11, 0.72, 0.68), COLORS.black],
      [at(new SphereGeometry(0.075, 10, 8).scale(1.2, 0.8, 0.5).rotateZ(-0.25), 0.11, 0.72, 0.68), COLORS.black],
      // Nose tip: black button
      [at(new SphereGeometry(0.045, 8, 6), 0, 0.64, 0.76), COLORS.black],
      // Ears: rounded black cups
      [at(new SphereGeometry(0.09, 10, 8).scale(0.8, 1.1, 0.6), -0.19, 0.9, 0.42), COLORS.black],
      [at(new SphereGeometry(0.09, 10, 8).scale(0.8, 1.1, 0.6), 0.19, 0.9, 0.42), COLORS.black],
      // Tail: round white tuft
      [at(new SphereGeometry(0.09, 10, 8), 0, 0.55, -0.55), COLORS.white],
   ];
   // Legs and paws: black sturdy capsules
   for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) {
      p.push([at(new CapsuleGeometry(0.11, 0.22, 6, 10), x, 0.21, z), COLORS.black]);
      p.push([at(new SphereGeometry(0.115, 10, 8).scale(1, 0.55, 1.2), x, 0.06, z + 0.04), COLORS.black]);
   }
   return p;
}

/** Keeper stand-in: 1.75 m, safari hat with band, khaki shirt and shorts, boots, faces +z. */
export function keeperPieces(): Piece[] {
   return [
      // Legs: skin
      [at(new CapsuleGeometry(0.075, 0.48, 4, 10), -0.11, 0.44, 0), COLORS.skin],
      [at(new CapsuleGeometry(0.075, 0.48, 4, 10), 0.11, 0.44, 0), COLORS.skin],
      // Boots with soles: leather brown
      [at(new BoxGeometry(0.16, 0.15, 0.26), -0.11, 0.075, 0.03), COLORS.boot],
      [at(new BoxGeometry(0.16, 0.15, 0.26), 0.11, 0.075, 0.03), COLORS.boot],
      // Shorts: dark khaki
      [at(new CylinderGeometry(0.2, 0.19, 0.32, 14), 0, 0.8, 0), COLORS.khakiDark],
      // Belt with buckle
      [at(new CylinderGeometry(0.205, 0.205, 0.05, 14), 0, 0.94, 0), COLORS.metalDark],
      [at(new BoxGeometry(0.06, 0.05, 0.02), 0, 0.94, 0.2), COLORS.cone],
      // Torso shirt: safari khaki
      [at(new CapsuleGeometry(0.2, 0.36, 6, 14), 0, 1.15, 0), COLORS.khaki],
      // Arms: left relaxed, right bent holding torch
      [at(new CapsuleGeometry(0.065, 0.48, 4, 8), -0.27, 1.1, 0), COLORS.khaki],
      [at(new CapsuleGeometry(0.065, 0.44, 4, 8).rotateX(Math.PI / 2.4), 0.27, 1.2, 0.2), COLORS.khaki],
      // Hands
      [at(new SphereGeometry(0.055, 8, 8), -0.27, 0.8, 0), COLORS.skin],
      [at(new SphereGeometry(0.055, 8, 8), 0.27, 1.15, 0.42), COLORS.skin],
      // Head
      [at(new SphereGeometry(0.15, 16, 12), 0, 1.55, 0), COLORS.skin],
      // Safari Hat: brim, dark band, crown
      [at(new CylinderGeometry(0.27, 0.27, 0.03, 18), 0, 1.66, 0), COLORS.khakiDark],
      [at(new CylinderGeometry(0.15, 0.16, 0.04, 16), 0, 1.69, 0), COLORS.woodDark],
      [at(new CylinderGeometry(0.13, 0.15, 0.11, 16), 0, 1.75, 0), COLORS.khaki],
      // Torch held in hand
      [at(new CylinderGeometry(0.035, 0.03, 0.22, 8).rotateX(Math.PI / 2), 0.27, 1.05, 0.42), COLORS.metalDark],
   ];
}

/** The torch in the right hand (attach.handR frame: the arm runs along -x; lens at -x end). */
export function torchPieces(): Piece[] {
   return [
      [new CylinderGeometry(0.028, 0.024, 0.2, 10).rotateZ(Math.PI / 2).translate(-0.06, 0, 0), COLORS.metalDark],
      [new CylinderGeometry(0.032, 0.032, 0.08, 10).rotateZ(Math.PI / 2).translate(-0.06, 0, 0), COLORS.black],
      [new CylinderGeometry(0.046, 0.03, 0.06, 12).rotateZ(Math.PI / 2).translate(-0.18, 0, 0), COLORS.metal],
      [new CylinderGeometry(0.04, 0.04, 0.012, 12).rotateZ(Math.PI / 2).translate(-0.214, 0, 0), COLORS.lampGlow],
   ];
}

// ---------- props (stand-ins of the GLBs, and the code-built ones) ----------

/** Rock cluster: faceted low-poly boulders in 3 natural stone tones. */
export const rockPieces = (): Piece[] => [
   [new DodecahedronGeometry(0.52, 0).scale(1.1, 0.6, 0.95).translate(0, 0.26, 0), COLORS.rock],
   [new DodecahedronGeometry(0.32, 0).scale(0.9, 0.65, 1.05).translate(0.3, 0.14, 0.22), COLORS.rockDark],
   [new DodecahedronGeometry(0.24, 0).scale(1.0, 0.5, 0.9).translate(-0.28, 0.1, -0.18), COLORS.rockDeep],
];

/** Bamboo clump, 1 m wide x 1.3 m tall: stalks with segments and fresh leaf tufts. */
export function bambooPieces(): Piece[] {
   const p: Piece[] = [];
   const stalks = [
      [0, 0, 1.35],
      [0.26, 0.12, 1.15],
      [-0.22, 0.18, 1.25],
      [0.1, -0.25, 1.05],
      [-0.2, -0.2, 0.95],
      [0.32, -0.12, 0.85],
   ];
   stalks.forEach(([x, z, h], i) => {
      p.push([new CylinderGeometry(0.045, 0.055, h, 7).translate(x, h / 2, z), i % 2 ? COLORS.bamboo : COLORS.bambooLight]);
      // Bamboo nodes/rings
      p.push([new TorusGeometry(0.052, 0.008, 4, 8).rotateX(Math.PI / 2).translate(x, h * 0.45, z), COLORS.woodDark]);
      p.push([new TorusGeometry(0.048, 0.008, 4, 8).rotateX(Math.PI / 2).translate(x, h * 0.75, z), COLORS.woodDark]);
      // Leaf tuft at top
      p.push([new ConeGeometry(0.18, 0.36, 6).rotateZ(0.4 + i * 0.6).translate(x, h - 0.04, z), COLORS.leaf]);
      p.push([new ConeGeometry(0.12, 0.26, 5).rotateZ(-0.3 + i * 0.4).translate(x + 0.06, h + 0.08, z), COLORS.leafDark]);
   });
   return p;
}

/** Park bench: warm wooden planks on cast-iron frame. */
export const benchPieces = (): Piece[] => [
   // Seat planks
   [new BoxGeometry(2.0, 0.04, 0.18).translate(0, 0.44, 0.1), COLORS.woodLight],
   [new BoxGeometry(2.0, 0.04, 0.18).translate(0, 0.44, -0.1), COLORS.wood],
   // Backrest planks
   [new BoxGeometry(2.0, 0.15, 0.04).translate(0, 0.66, -0.22), COLORS.woodLight],
   [new BoxGeometry(2.0, 0.15, 0.04).translate(0, 0.83, -0.22), COLORS.wood],
   // Cast iron legs
   [new BoxGeometry(0.07, 0.44, 0.44).translate(-0.85, 0.22, 0), COLORS.metalDark],
   [new BoxGeometry(0.07, 0.44, 0.44).translate(0.85, 0.22, 0), COLORS.metalDark],
   [new BoxGeometry(0.06, 0.45, 0.06).translate(-0.85, 0.65, -0.23), COLORS.metalDark],
   [new BoxGeometry(0.06, 0.45, 0.06).translate(0.85, 0.65, -0.23), COLORS.metalDark],
];

/** Zoo recycling/waste bin: emerald body with disposal hood. */
export const binPieces = (): Piece[] => [
   [new CylinderGeometry(0.24, 0.21, 0.78, 14).translate(0, 0.39, 0), COLORS.kioskTrim],
   [new CylinderGeometry(0.26, 0.25, 0.08, 14).translate(0, 0.8, 0), COLORS.metalDark],
   [new SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.84, 0), COLORS.kioskTrim],
   [new BoxGeometry(0.22, 0.08, 0.12).translate(0, 0.88, 0.15), COLORS.metalDark],
];

/** Zoo lantern post: dark bronze fluted column, bracket and warm lantern. */
export const lampPieces = (): Piece[] => [
   // Base
   [new CylinderGeometry(0.14, 0.2, 0.3, 10).translate(0, 0.15, 0), COLORS.metalDark],
   // Post
   [new CylinderGeometry(0.06, 0.09, 2.5, 10).translate(0, 1.55, 0), COLORS.metalDark],
   // Lamp bracket / collar
   [new CylinderGeometry(0.16, 0.07, 0.12, 10).translate(0, 2.82, 0), COLORS.metalDark],
   // Glowing lantern globe
   [new SphereGeometry(0.22, 14, 10).translate(0, 2.95, 0), COLORS.lampGlow],
   // Lantern cap
   [new ConeGeometry(0.25, 0.12, 10).translate(0, 3.12, 0), COLORS.metalDark],
];

/** Zoo palm: curved ringed trunk with arching fronds. */
export const palmPieces = (): Piece[] => {
   const p: Piece[] = [
      [new CylinderGeometry(0.11, 0.18, 2.6, 8).translate(0, 1.3, 0), COLORS.woodDark],
      // Base root flare
      [new CylinderGeometry(0.18, 0.28, 0.3, 8).translate(0, 0.15, 0), COLORS.wood],
   ];
   for (let i = 0; i < 7; i++) {
      p.push([
         new ConeGeometry(0.26, 1.5, 4)
            .rotateZ(Math.PI / 2.3)
            .translate(0.68, 2.6, 0)
            .rotateY((i * Math.PI * 2) / 7),
         i % 2 ? COLORS.leaf : COLORS.leafDark,
      ]);
   }
   return p;
};

/** Low-poly parked car: bevelled body, cabin with tinted windows, bumpers, wheels. */
export function carPieces(colorIndex = 0): Piece[] {
   const bodyColor = COLORS.car[colorIndex % COLORS.car.length];
   const p: Piece[] = [
      // Chassis lower body
      [new BoxGeometry(1.9, 0.55, 4.1).translate(0, 0.48, 0), bodyColor],
      // Cabin upper body with angled glass
      [new BoxGeometry(1.58, 0.54, 2.1).translate(0, 1.02, -0.2), COLORS.black],
      // Roof slab
      [new BoxGeometry(1.54, 0.08, 1.8).translate(0, 1.32, -0.2), bodyColor],
      // Front and rear bumpers
      [new BoxGeometry(1.85, 0.14, 0.12).translate(0, 0.32, 2.05), COLORS.metalDark],
      [new BoxGeometry(1.85, 0.14, 0.12).translate(0, 0.32, -2.05), COLORS.metalDark],
      // Headlights
      [new BoxGeometry(0.3, 0.12, 0.04).translate(-0.65, 0.52, 2.06), COLORS.cone],
      [new BoxGeometry(0.3, 0.12, 0.04).translate(0.65, 0.52, 2.06), COLORS.cone],
      // Taillights
      [new BoxGeometry(0.3, 0.12, 0.04).translate(-0.65, 0.52, -2.06), COLORS.alert],
      [new BoxGeometry(0.3, 0.12, 0.04).translate(0.65, 0.52, -2.06), COLORS.alert],
   ];
   // Wheels: black tires with grey rims
   for (const [x, z] of [[-0.86, 1.3], [0.86, 1.3], [-0.86, -1.3], [0.86, -1.3]]) {
      p.push([new CylinderGeometry(0.33, 0.33, 0.22, 12).rotateZ(Math.PI / 2).translate(x, 0.33, z), COLORS.black]);
      p.push([new CylinderGeometry(0.18, 0.18, 0.23, 8).rotateZ(Math.PI / 2).translate(x, 0.33, z), COLORS.metal]);
   }
   return p;
}

/** Zoo leafy tree: trunk with canopy spheres. */
export const treePieces = (): Piece[] => [
   [new CylinderGeometry(0.16, 0.26, 1.8, 8).translate(0, 0.9, 0), COLORS.woodDark],
   [new IcosahedronGeometry(1.25, 1).translate(0, 2.45, 0), COLORS.leaf],
   [new IcosahedronGeometry(0.85, 1).translate(0.5, 3.0, 0.3), COLORS.leafDark],
   [new IcosahedronGeometry(0.75, 1).translate(-0.45, 2.8, -0.25), COLORS.leaf],
];

/** Pine tree: conical layered evergreen. */
export const pinePieces = (): Piece[] => [
   [new CylinderGeometry(0.12, 0.2, 1.4, 7).translate(0, 0.7, 0), COLORS.woodDark],
   [new ConeGeometry(1.2, 1.6, 7).translate(0, 1.8, 0), COLORS.leafDark],
   [new ConeGeometry(0.9, 1.3, 7).translate(0, 2.7, 0), COLORS.hedge],
   [new ConeGeometry(0.6, 1.0, 7).translate(0, 3.5, 0), COLORS.leafDark],
];

/** Dense perimeter hedge: rounded box with foliage highlights. */
export const hedgePieces = (): Piece[] => [
   [new BoxGeometry(0.92, 1.05, 0.92).translate(0, 0.55, 0), COLORS.hedge],
   [new IcosahedronGeometry(0.48, 1).translate(0, 1.05, 0), COLORS.hedgeSun],
   [new IcosahedronGeometry(0.42, 1).translate(0.24, 0.85, 0.2), COLORS.leaf],
   [new IcosahedronGeometry(0.4, 1).translate(-0.24, 0.85, -0.2), COLORS.leafDark],
];

/** Directional signpost: wooden post with 2 directional signboards. */
export const signpostPieces = (): Piece[] => [
   [new CylinderGeometry(0.06, 0.08, 1.8, 8).translate(0, 0.9, 0), COLORS.woodDark],
   [new BoxGeometry(0.65, 0.14, 0.04).translate(0.28, 1.5, 0), COLORS.woodLight],
   [new BoxGeometry(0.65, 0.14, 0.04).rotateY(Math.PI / 2).translate(0, 1.3, 0.28), COLORS.wood],
   [new ConeGeometry(0.1, 0.14, 3).rotateZ(-Math.PI / 2).translate(0.64, 1.5, 0), COLORS.woodLight],
];

/** Distant rolling hill mound. */
export const hillPieces = (): Piece[] => [
   [new IcosahedronGeometry(1, 1).scale(1, 0.45, 1).translate(0, 0.25, 0), COLORS.hill],
];

/** Puffy cloud cluster. */
export const cloudPieces = (): Piece[] => [
   [new IcosahedronGeometry(1.0, 1).scale(1.2, 0.65, 0.9).translate(0, 0, 0), COLORS.cloud],
   [new IcosahedronGeometry(0.7, 1).translate(0.8, 0.15, 0.2), COLORS.cloud],
   [new IcosahedronGeometry(0.65, 1).translate(-0.7, 0.1, -0.15), COLORS.cloud],
];

/** A leafy bush, 1 x 0.9 x 1: three flat-shaded blobs in two greens. */
export const bushPieces = (): Piece[] => [
   [new IcosahedronGeometry(0.44, 1).scale(1, 0.88, 1).translate(0, 0.4, 0), COLORS.leaf],
   [new IcosahedronGeometry(0.34, 1).translate(0.28, 0.32, 0.19), COLORS.leafDark],
   [new IcosahedronGeometry(0.32, 1).translate(-0.28, 0.32, -0.13), COLORS.leafDark],
   [new IcosahedronGeometry(0.28, 1).translate(-0.1, 0.58, 0.22), COLORS.leaf],
   [new IcosahedronGeometry(0.22, 1).translate(0.12, 0.6, -0.18), COLORS.bambooLight],
];

/** A bamboo snack: three shoots tied in a bundle, with red ribbon and leaf. */
export const snackPieces = (): Piece[] => [
   [new CylinderGeometry(0.038, 0.042, 0.38, 7).rotateZ(0.15).translate(-0.04, 0.19, 0), COLORS.bambooLight],
   [new CylinderGeometry(0.038, 0.042, 0.42, 7).translate(0.04, 0.21, 0.02), COLORS.bamboo],
   [new CylinderGeometry(0.038, 0.042, 0.34, 7).rotateX(-0.15).translate(0, 0.17, -0.05), COLORS.bambooLight],
   [new TorusGeometry(0.08, 0.02, 6, 14).rotateX(Math.PI / 2).translate(0, 0.17, 0), COLORS.alert],
   [new ConeGeometry(0.1, 0.22, 5).rotateZ(-0.7).translate(0.1, 0.4, 0), COLORS.leaf],
];

/** The tossed bundle: four stalks lying down, tied in the middle. */
export const bundlePieces = (): Piece[] => [
   ...[[-0.05, 0.05], [0.05, 0.05], [0, 0.13], [0, -0.02]].map(
      ([x, y]): Piece => [new CylinderGeometry(0.04, 0.04, 0.58, 7).rotateX(Math.PI / 2).translate(x, y + 0.04, 0), COLORS.bambooLight]
   ),
   [new TorusGeometry(0.1, 0.022, 6, 14).translate(0, 0.08, 0), COLORS.woodDark],
   [new TorusGeometry(0.1, 0.016, 6, 14).translate(0, 0.08, 0.12), COLORS.alert],
];

/** A kiosk: counter body with a trim band, support pillars and roof. */
export const kioskPieces = (): Piece[] => [
   // Main counter base
   [new BoxGeometry(0.96, 0.64, 0.96).translate(0, 0.32, 0), COLORS.kiosk],
   // Trim band
   [new BoxGeometry(1.02, 0.07, 1.02).translate(0, 0.66, 0), COLORS.kioskTrim],
   // Timber service counter top
   [new BoxGeometry(1.04, 0.04, 1.04).translate(0, 0.71, 0), COLORS.woodLight],
   // 4 corner support pillars
   [new BoxGeometry(0.08, 0.38, 0.08).translate(-0.44, 0.88, -0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.38, 0.08).translate(0.44, 0.88, -0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.38, 0.08).translate(-0.44, 0.88, 0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.38, 0.08).translate(0.44, 0.88, 0.44), COLORS.kioskTrim],
];

/** A gate frame: two wooden posts with caps and a header across the opening. */
export const gatePieces = (): Piece[] => [
   // Left post
   [new BoxGeometry(0.24, 2.25, 0.24).translate(-0.5, 1.12, 0), COLORS.woodDark],
   [new ConeGeometry(0.2, 0.16, 4).rotateY(Math.PI / 4).translate(-0.5, 2.33, 0), COLORS.wood],
   // Right post
   [new BoxGeometry(0.24, 2.25, 0.24).translate(0.5, 1.12, 0), COLORS.woodDark],
   [new ConeGeometry(0.2, 0.16, 4).rotateY(Math.PI / 4).translate(0.5, 2.33, 0), COLORS.wood],
   // Header beam
   [new BoxGeometry(1.26, 0.26, 0.28).translate(0, 2.22, 0), COLORS.wood],
   // Plaque banner: mint with border
   [new BoxGeometry(0.56, 0.2, 0.04).translate(0, 2.22, 0.15), COLORS.accent],
   [new BoxGeometry(0.6, 0.04, 0.05).translate(0, 2.33, 0.15), COLORS.woodDark],
   [new BoxGeometry(0.6, 0.04, 0.05).translate(0, 2.11, 0.15), COLORS.woodDark],
];

/** The searchlight tower: four legs with cross-braces, platform and visor housing. */
export function towerPieces(): Piece[] {
   const p: Piece[] = [];
   for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
      p.push([new BoxGeometry(0.12, 4.3, 0.12).translate(x, 2.15, z), COLORS.metalDark]);
   }
   // Cross braces
   p.push([new BoxGeometry(0.06, 0.06, 1.2).translate(0, 2.1, 0.45), COLORS.metalDark]);
   p.push([new BoxGeometry(0.06, 0.06, 1.2).translate(0, 2.1, -0.45), COLORS.metalDark]);
   // Platform
   p.push([new BoxGeometry(1.45, 0.14, 1.45).translate(0, 4.3, 0), COLORS.metal]);
   // Safety railing
   p.push([new BoxGeometry(1.42, 0.5, 0.06).translate(0, 4.6, 0.7), COLORS.metalDark]);
   p.push([new BoxGeometry(1.42, 0.5, 0.06).translate(0, 4.6, -0.7), COLORS.metalDark]);
   p.push([new BoxGeometry(0.06, 0.5, 1.42).translate(-0.7, 4.6, 0), COLORS.metalDark]);
   // Searchlight cylindrical housing & visor
   p.push([new CylinderGeometry(0.32, 0.38, 0.52, 14).rotateX(Math.PI / 2).translate(0, 4.75, 0), COLORS.metal]);
   p.push([new CylinderGeometry(0.28, 0.28, 0.05, 14).rotateX(Math.PI / 2).translate(0, 4.75, 0.26), COLORS.lampGlow]);
   p.push([new TorusGeometry(0.33, 0.03, 6, 14).translate(0, 4.75, 0.26), COLORS.metalDark]);
   return p;
}

/** The bridge over the moat: curved deck planks, timber stringers and handrails. */
export function bridgePieces(): Piece[] {
   const p: Piece[] = [
      // Deck base
      [new BoxGeometry(2.2, 0.12, 2.6).translate(0, 0.06, 0), COLORS.woodDark],
   ];
   // Deck planks
   for (let i = 0; i < 7; i++) {
      p.push([new BoxGeometry(2.14, 0.05, 0.28).translate(0, 0.14, -1.1 + i * 0.37), i % 2 ? COLORS.wood : COLORS.woodLight]);
   }
   // Railings
   for (const x of [-1.05, 1.05]) {
      p.push([new BoxGeometry(0.09, 0.09, 2.6).translate(x, 0.78, 0), COLORS.wood]);
      p.push([new BoxGeometry(0.06, 0.06, 2.6).translate(x, 0.44, 0), COLORS.woodDark]);
      for (const z of [-1.2, 0, 1.2]) {
         p.push([new BoxGeometry(0.11, 0.78, 0.11).translate(x, 0.39, z), COLORS.woodDark]);
         p.push([new ConeGeometry(0.08, 0.08, 4).translate(x, 0.82, z), COLORS.wood]);
      }
   }
   return p;
}
