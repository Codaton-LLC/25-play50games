"use client";

// Zoo Escape's palette and procedural pieces: every stand-in is one merged, vertex-coloured mesh
// (one draw call, two or three tones, bevel-like rounded shapes), so a missing GLB still looks
// deliberate. Built once per mount and disposed with it.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry, BufferAttribute, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry, type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const COLORS = {
   grass: "#5ccf7f",
   grassDeep: "#46b56a",
   outer: "#7fcf8e",
   path: "#e7e5e4",
   paving: "#d6d3d1",
   asphalt: "#475569",
   lines: "#f8fafc",
   water: "#38bdf8",
   deep: "#0e7490",
   wood: "#a16207",
   woodDark: "#713f12",
   post: "#7c4a1e",
   rail: "#b7792e",
   rock: "#a8a29e",
   rockDark: "#78716c",
   bamboo: "#65a30d",
   bambooLight: "#a3e635",
   leaf: "#22c55e",
   leafDark: "#15803d",
   white: "#f8fafc",
   black: "#1e293b",
   khaki: "#d6c29a",
   khakiDark: "#a68a5b",
   skin: "#f2c6a0",
   boot: "#5b3a1e",
   cone: "#fde68a",
   alert: "#f87171",
   accent: "#34d399",
   kiosk: "#fef3c7",
   kioskTrim: "#0f766e",
   metal: "#94a3b8",
   metalDark: "#475569",
   lampGlow: "#fde68a",
   car: ["#f47967", "#60a5fa", "#fbbf24", "#a78bfa"],
} as const;

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
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
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

/** Panda stand-in: 1.15 m long on all fours, head +z. */
export function pandaPieces(): Piece[] {
   const p: Piece[] = [
      [at(new SphereGeometry(0.36, 20, 14).scale(1.05, 0.95, 1.45), 0, 0.5, -0.02), COLORS.white],
      [at(new SphereGeometry(0.37, 18, 12).scale(1.08, 0.9, 0.62), 0, 0.53, 0.18), COLORS.black],
      [at(new SphereGeometry(0.27, 20, 14), 0, 0.68, 0.46), COLORS.white],
      [at(new SphereGeometry(0.075, 10, 8).scale(1.2, 0.8, 0.5), -0.1, 0.72, 0.7), COLORS.black],
      [at(new SphereGeometry(0.075, 10, 8).scale(1.2, 0.8, 0.5), 0.1, 0.72, 0.7), COLORS.black],
      [at(new SphereGeometry(0.04, 8, 6), 0, 0.62, 0.73), COLORS.black],
      [at(new SphereGeometry(0.09, 10, 8), -0.19, 0.9, 0.42), COLORS.black],
      [at(new SphereGeometry(0.09, 10, 8), 0.19, 0.9, 0.42), COLORS.black],
      [at(new SphereGeometry(0.1, 10, 8), 0, 0.55, -0.55), COLORS.white],
   ];
   for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) p.push([at(new CapsuleGeometry(0.11, 0.2, 4, 10), x, 0.2, z), COLORS.black]);
   return p;
}

/** Keeper stand-in: 1.75 m, safari hat, khaki shirt and shorts, boots, faces +z. */
export function keeperPieces(): Piece[] {
   return [
      [at(new CapsuleGeometry(0.075, 0.5, 4, 10), -0.11, 0.42, 0), COLORS.skin],
      [at(new CapsuleGeometry(0.075, 0.5, 4, 10), 0.11, 0.42, 0), COLORS.skin],
      [at(new BoxGeometry(0.16, 0.14, 0.26), -0.11, 0.07, 0.03), COLORS.boot],
      [at(new BoxGeometry(0.16, 0.14, 0.26), 0.11, 0.07, 0.03), COLORS.boot],
      [at(new CylinderGeometry(0.2, 0.19, 0.3, 14), 0, 0.8, 0), COLORS.khakiDark],
      [at(new CapsuleGeometry(0.2, 0.36, 6, 14), 0, 1.15, 0), COLORS.khaki],
      [at(new CapsuleGeometry(0.06, 0.5, 4, 8), -0.27, 1.1, 0), COLORS.khaki],
      [at(new CapsuleGeometry(0.06, 0.45, 4, 8).rotateX(Math.PI / 2.4), 0.27, 1.2, 0.2), COLORS.khaki],
      [at(new SphereGeometry(0.15, 16, 12), 0, 1.55, 0), COLORS.skin],
      [at(new CylinderGeometry(0.26, 0.26, 0.03, 18), 0, 1.66, 0), COLORS.khakiDark],
      [at(new CylinderGeometry(0.13, 0.15, 0.12, 14), 0, 1.72, 0), COLORS.khaki],
      [at(new CylinderGeometry(0.035, 0.03, 0.2, 8).rotateX(Math.PI / 2), 0.27, 1.05, 0.42), COLORS.metalDark],
   ];
}

/** The torch in the right hand (attach.handR frame: the arm runs along -x; the lens at the -x end). */
export function torchPieces(): Piece[] {
   return [
      [new CylinderGeometry(0.028, 0.024, 0.2, 10).rotateZ(Math.PI / 2).translate(-0.06, 0, 0), COLORS.metalDark],
      [new CylinderGeometry(0.045, 0.03, 0.06, 12).rotateZ(Math.PI / 2).translate(-0.18, 0, 0), COLORS.metal],
      [new CylinderGeometry(0.04, 0.04, 0.012, 12).rotateZ(Math.PI / 2).translate(-0.214, 0, 0), COLORS.lampGlow],
   ];
}

// ---------- props (stand-ins of the GLBs, and the code-built ones) ----------

export const rockPieces = (): Piece[] => [
   [new DodecahedronGeometry(0.5, 0).scale(1, 0.55, 0.92).translate(0, 0.25, 0), COLORS.rock],
   [new DodecahedronGeometry(0.28, 0).scale(1, 0.6, 1).translate(0.28, 0.12, 0.2), COLORS.rockDark],
];

/** A bamboo clump, 1 m wide x 1.3 m tall (the bamboo asset's unit): stalks and leaf tufts. */
export function bambooPieces(): Piece[] {
   const p: Piece[] = [];
   const stalks = [[0, 0, 1.3], [0.25, 0.12, 1.1], [-0.22, 0.18, 1.2], [0.1, -0.25, 1.0], [-0.2, -0.2, 0.9], [0.32, -0.12, 0.8]];
   stalks.forEach(([x, z, h], i) => {
      p.push([new CylinderGeometry(0.045, 0.055, h, 7).translate(x, h / 2, z), i % 2 ? COLORS.bamboo : COLORS.bambooLight]);
      p.push([new ConeGeometry(0.16, 0.34, 6).rotateZ(0.5 + i).translate(x, h - 0.05, z), COLORS.leaf]);
   });
   return p;
}

export const benchPieces = (): Piece[] => [
   [new BoxGeometry(2.0, 0.08, 0.5).translate(0, 0.45, 0), COLORS.wood],
   [new BoxGeometry(2.0, 0.35, 0.06).translate(0, 0.7, -0.22), COLORS.wood],
   [new BoxGeometry(0.08, 0.45, 0.45).translate(-0.85, 0.22, 0), COLORS.metalDark],
   [new BoxGeometry(0.08, 0.45, 0.45).translate(0.85, 0.22, 0), COLORS.metalDark],
];
export const binPieces = (): Piece[] => [
   [new CylinderGeometry(0.24, 0.21, 0.8, 14).translate(0, 0.4, 0), COLORS.kioskTrim],
   [new CylinderGeometry(0.26, 0.26, 0.08, 14).translate(0, 0.84, 0), COLORS.metalDark],
];
export const lampPieces = (): Piece[] => [
   [new CylinderGeometry(0.06, 0.09, 2.8, 10).translate(0, 1.4, 0), COLORS.metalDark],
   [new SphereGeometry(0.2, 14, 10).translate(0, 2.9, 0), COLORS.lampGlow],
];
export const palmPieces = (): Piece[] => {
   const p: Piece[] = [[new CylinderGeometry(0.1, 0.16, 2.6, 8).translate(0, 1.3, 0), COLORS.woodDark]];
   for (let i = 0; i < 6; i++) p.push([new ConeGeometry(0.25, 1.4, 4).rotateZ(Math.PI / 2.4).translate(0.6, 2.55, 0).rotateY((i * Math.PI) / 3), COLORS.leaf]);
   return p;
};
export const carPieces = (): Piece[] => [
   [new BoxGeometry(1.9, 0.7, 4.1).translate(0, 0.55, 0), COLORS.car[0]],
   [new BoxGeometry(1.6, 0.55, 2.0).translate(0, 1.15, -0.2), COLORS.white],
   ...[[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]].map(([x, z]): Piece => [new CylinderGeometry(0.33, 0.33, 0.25, 12).rotateZ(Math.PI / 2).translate(x, 0.33, z), COLORS.black]),
];
export const treePieces = (): Piece[] => [
   [new CylinderGeometry(0.16, 0.24, 1.6, 8).translate(0, 0.8, 0), COLORS.woodDark],
   [new IcosahedronGeometry(1.2, 1).translate(0, 2.3, 0), COLORS.leaf],
   [new IcosahedronGeometry(0.8, 1).translate(0.5, 2.9, 0.3), COLORS.leafDark],
];

/** A leafy bush, 1 x 0.9 x 1 (scaled per bush): three flat-shaded blobs in two greens. */
export const bushPieces = (): Piece[] => [
   [new IcosahedronGeometry(0.42, 1).scale(1, 0.85, 1).translate(0, 0.38, 0), COLORS.leaf],
   [new IcosahedronGeometry(0.32, 1).translate(0.26, 0.3, 0.18), COLORS.leafDark],
   [new IcosahedronGeometry(0.3, 1).translate(-0.26, 0.3, -0.12), COLORS.leafDark],
   [new IcosahedronGeometry(0.26, 1).translate(-0.1, 0.55, 0.22), COLORS.leaf],
];

/** A bamboo snack: three shoots in a little tied bundle, 0.4 m tall. */
export const snackPieces = (): Piece[] => [
   [new CylinderGeometry(0.035, 0.04, 0.36, 7).rotateZ(0.15).translate(-0.04, 0.18, 0), COLORS.bambooLight],
   [new CylinderGeometry(0.035, 0.04, 0.4, 7).translate(0.04, 0.2, 0.02), COLORS.bamboo],
   [new CylinderGeometry(0.035, 0.04, 0.32, 7).rotateX(-0.15).translate(0, 0.16, -0.05), COLORS.bambooLight],
   [new TorusGeometry(0.075, 0.018, 6, 14).rotateX(Math.PI / 2).translate(0, 0.16, 0), COLORS.alert],
   [new ConeGeometry(0.09, 0.2, 5).rotateZ(-0.7).translate(0.1, 0.38, 0), COLORS.leaf],
];

/** The tossed bundle: four stalks lying down, tied in the middle. */
export const bundlePieces = (): Piece[] => [
   ...[[-0.05, 0.05], [0.05, 0.05], [0, 0.13], [0, -0.02]].map(([x, y]): Piece => [new CylinderGeometry(0.04, 0.04, 0.55, 7).rotateX(Math.PI / 2).translate(x, y + 0.04, 0), COLORS.bambooLight]),
   [new TorusGeometry(0.1, 0.02, 6, 14).translate(0, 0.08, 0), COLORS.woodDark],
];

/** A kiosk: counter body with a trim band and a roof slab, 1 x 1 x 1 unit (scaled to its box). */
export const kioskPieces = (): Piece[] => [
   [new BoxGeometry(0.96, 0.62, 0.96).translate(0, 0.31, 0), COLORS.kiosk],
   [new BoxGeometry(1.0, 0.06, 1.0).translate(0, 0.64, 0), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.36, 0.08).translate(-0.44, 0.84, -0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.36, 0.08).translate(0.44, 0.84, -0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.36, 0.08).translate(-0.44, 0.84, 0.44), COLORS.kioskTrim],
   [new BoxGeometry(0.08, 0.36, 0.08).translate(0.44, 0.84, 0.44), COLORS.kioskTrim],
];

/** A gate frame: two posts and a header across the opening (unit width 1 along x). */
export const gatePieces = (): Piece[] => [
   [new BoxGeometry(0.22, 2.2, 0.22).translate(-0.5, 1.1, 0), COLORS.woodDark],
   [new BoxGeometry(0.22, 2.2, 0.22).translate(0.5, 1.1, 0), COLORS.woodDark],
   [new BoxGeometry(1.24, 0.24, 0.26).translate(0, 2.25, 0), COLORS.wood],
   [new BoxGeometry(0.5, 0.18, 0.04).translate(0, 2.25, 0.14), COLORS.accent],
];

/** The searchlight tower: four legs, a platform and the lamp housing (origin at its foot). */
export function towerPieces(): Piece[] {
   const p: Piece[] = [];
   for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) p.push([new BoxGeometry(0.12, 4.3, 0.12).translate(x, 2.15, z), COLORS.metalDark]);
   p.push([new BoxGeometry(1.4, 0.14, 1.4).translate(0, 4.3, 0), COLORS.metal]);
   p.push([new BoxGeometry(1.4, 0.5, 0.06).translate(0, 4.6, 0.7), COLORS.metalDark]);
   p.push([new CylinderGeometry(0.3, 0.36, 0.5, 14).rotateX(Math.PI / 2).translate(0, 4.75, 0), COLORS.metal]);
   p.push([new CylinderGeometry(0.27, 0.27, 0.04, 14).rotateX(Math.PI / 2).translate(0, 4.75, 0.26), COLORS.lampGlow]);
   return p;
}

/** The bridge over the moat: deck planks and two rails (2 wide x 2.4 long, along z). */
export function bridgePieces(): Piece[] {
   const p: Piece[] = [[new BoxGeometry(2.2, 0.12, 2.6).translate(0, 0.06, 0), COLORS.wood]];
   for (let i = 0; i < 7; i++) p.push([new BoxGeometry(2.1, 0.04, 0.26).translate(0, 0.14, -1.1 + i * 0.37), COLORS.woodDark]);
   for (const x of [-1.05, 1.05]) {
      p.push([new BoxGeometry(0.08, 0.08, 2.6).translate(x, 0.75, 0), COLORS.wood]);
      for (const z of [-1.2, 0, 1.2]) p.push([new BoxGeometry(0.1, 0.75, 0.1).translate(x, 0.38, z), COLORS.woodDark]);
   }
   return p;
}
