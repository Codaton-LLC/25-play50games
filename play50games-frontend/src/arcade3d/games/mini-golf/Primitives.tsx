"use client";

// Stand-ins drawn while a GLB is missing (never fetched until it is in the manifest) and code-built
// surroundings: the windmill, flags, trees, rocks, palms, flower beds, distant hills, clubhouse.
// All visible code-built objects feature bevelled shapes, 2-3 tones from COLORS, and clean low-poly styling.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   Float32BufferAttribute,
   IcosahedronGeometry,
   Matrix4,
   Vector3,
   Color,
   type BufferGeometry,
} from "three";
import { mergeGeometries as mergeIndexed } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { CUP } from "./physics";

/**
 * mergeGeometries needs every part indexed or none: polyhedra (icosahedron, dodecahedron) are
 * non-indexed, so mixed lists are merged non-indexed (a failed merge would draw a plain box).
 */
function mergeGeometries(parts: BufferGeometry[]): BufferGeometry | null {
   if (parts.every((p) => p.index) || parts.every((p) => !p.index)) return mergeIndexed(parts);
   const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
   const merged = mergeIndexed(flat);
   flat.forEach((g, k) => { if (g !== parts[k]) g.dispose(); });
   return merged;
}

function paintGeometry(geometry: BufferGeometry, hex: string): BufferGeometry {
   const c = new Color(hex);
   const count = geometry.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
   geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
   return geometry;
}

/** The windmill stand-in: a 2.2 m octagonal Dutch tower with stone base, arched tunnel and terracotta roof. */
export function WindmillPrimitive() {
   const geo = useMemo(() => {
      // 1. Octagonal stone base & tower body
      const base = paintGeometry(new CylinderGeometry(0.68, 0.82, 1.35, 8).translate(0, 0.675, 0), COLORS.rockSun);
      // 2. Timber balcony / gallery trim
      const balcony = paintGeometry(new CylinderGeometry(0.78, 0.74, 0.1, 8).translate(0, 1.35, 0), COLORS.spar);
      // 3. Bevelled conical roof with eaves
      const roof = paintGeometry(new ConeGeometry(0.78, 0.75, 8).translate(0, 1.775, 0), COLORS.clubhouseRoof);
      // 4. Roof finial cap
      const finial = paintGeometry(new CylinderGeometry(0.06, 0.08, 0.2, 8).translate(0, 2.18, 0), COLORS.gold);
      // 5. Arched tunnel doorway (arch surround + dark tunnel interior)
      const arch = paintGeometry(new BoxGeometry(0.32, 0.32, 0.35).translate(0, 0.16, 0.62), COLORS.curbDark);
      const mouth = paintGeometry(new BoxGeometry(0.24, 0.24, 0.38).translate(0, 0.12, 0.64), COLORS.cup);
      const merged = mergeGeometries([base, balcony, roof, finial, arch, mouth]);
      base.dispose();
      balcony.dispose();
      roof.dispose();
      finial.dispose();
      arch.dispose();
      mouth.dispose();
      return merged ?? new BoxGeometry(1, 2.2, 1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <group name="windmill-standin">
         <mesh geometry={geo}>
            <meshStandardMaterial vertexColors roughness={0.8} />
         </mesh>
      </group>
   );
}

/** The regulation golf flag: tapered white pole, brass finial ball, bevelled pennant flag, 0.8 m. */
export function FlagPrimitive() {
   const geo = useMemo(() => {
      // Slender white fiberglass pole
      const pole = paintGeometry(new CylinderGeometry(0.012, 0.016, CUP.flagHeight, 8).translate(0, CUP.flagHeight / 2, 0), COLORS.pole);
      // Brass finial ball on top
      const finial = paintGeometry(new IcosahedronGeometry(0.035, 1).translate(0, CUP.flagHeight + 0.02, 0), COLORS.gold);
      // Pennant flag with bevelled edge
      const flagBody = paintGeometry(new BoxGeometry(0.26, 0.16, 0.008).translate(0.14, CUP.flagHeight - 0.1, 0), COLORS.flag);
      const flagTrim = paintGeometry(new BoxGeometry(0.015, 0.16, 0.01).translate(0.012, CUP.flagHeight - 0.1, 0), COLORS.flagTrim);
      const ferrule = paintGeometry(new CylinderGeometry(0.025, 0.025, 0.04, 8).translate(0, 0.02, 0), COLORS.cup);
      const merged = mergeGeometries([pole, finial, flagBody, flagTrim, ferrule]);
      pole.dispose();
      finial.dispose();
      flagBody.dispose();
      flagTrim.dispose();
      ferrule.dispose();
      return merged ?? new BoxGeometry(0.2, 0.8, 0.1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <group name="flag-standin">
         <mesh geometry={geo}>
            <meshStandardMaterial vertexColors roughness={0.5} />
         </mesh>
      </group>
   );
}

/** Low-poly trees: tapered trunk and two-tone faceted crown. */
export function TreePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const trunk = paintGeometry(new CylinderGeometry(0.08, 0.14, 1.2, 6).translate(0, 0.6, 0), COLORS.palmTrunk);
      const lowCrown = paintGeometry(new IcosahedronGeometry(0.72, 0).translate(0, 1.5, 0), COLORS.feltDark);
      const highCrown = paintGeometry(new IcosahedronGeometry(0.55, 0).translate(0, 1.95, 0), COLORS.feltLight);
      const merged = mergeGeometries([trunk, lowCrown, highCrown]);
      trunk.dispose();
      lowCrown.dispose();
      highCrown.dispose();
      return merged ?? new BoxGeometry(1, 2, 1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="tree-standin">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.9} />
      </Instanced>
   );
}

/** Faceted limestone boulders with sunlit facets and shaded crevices. */
export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const rockA = paintGeometry(new DodecahedronGeometry(0.42, 0).translate(0, 0.28, 0), COLORS.rock);
      const rockB = paintGeometry(new IcosahedronGeometry(0.32, 0).translate(0.12, 0.2, -0.08), COLORS.rockSun);
      const merged = mergeGeometries([rockA, rockB]);
      rockA.dispose();
      rockB.dispose();
      return merged ?? new DodecahedronGeometry(0.45, 0);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="rock-standin">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </Instanced>
   );
}

/** Stylized tropical resort palm trees: curved segmented trunk and radiating umbrella fronds. */
export function PalmPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const parts: BufferGeometry[] = [];
      // Segmented curved trunk
      const segments = 5;
      for (let s = 0; s < segments; s++) {
         const t0 = s / segments;
         const y = t0 * 1.6;
         const r = 0.12 * (1 - t0 * 0.45);
         const lean = Math.sin(t0 * 0.9) * 0.15;
         const seg = paintGeometry(new CylinderGeometry(r * 0.9, r, 1.6 / segments + 0.02, 6).translate(lean, y + 0.8 / segments, 0), COLORS.palmTrunk);
         parts.push(seg);
      }
      // 6 Radiating palm fronds
      const frondCount = 6;
      for (let i = 0; i < frondCount; i++) {
         const angle = (i * Math.PI * 2) / frondCount;
         const frond = new BoxGeometry(0.24, 0.025, 0.95);
         frond.translate(0, 0, 0.45);
         frond.rotateX(-0.4);
         frond.rotateY(angle);
         frond.translate(0.12, 1.65, 0);
         paintGeometry(frond, i % 2 === 0 ? COLORS.palmFrond : COLORS.palmFrondLight);
         parts.push(frond);
      }
      const merged = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      return merged ?? new BoxGeometry(1, 2, 1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="palms">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.85} />
      </Instanced>
   );
}

/** Colourful low-poly resort flower beds: terracotta planter border, foliage, vibrant blossoms. */
export function FlowerBedPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const parts: BufferGeometry[] = [];
      // Octagonal planter retaining wall
      const planter = paintGeometry(new CylinderGeometry(0.48, 0.52, 0.14, 8).translate(0, 0.07, 0), COLORS.planter);
      parts.push(planter);
      // Dark green foliage bed
      const foliage = paintGeometry(new CylinderGeometry(0.44, 0.46, 0.12, 8).translate(0, 0.14, 0), COLORS.flowerFoliage);
      parts.push(foliage);
      // Cluster of blossoms in 4 cheerful colors
      const blossomColors = [COLORS.flowerRed, COLORS.flowerYellow, COLORS.flowerWhite, COLORS.flowerOrange];
      for (let b = 0; b < 7; b++) {
         const angle = (b * Math.PI * 2) / 6;
         const dist = b === 6 ? 0 : 0.26;
         const bx = Math.cos(angle) * dist;
         const bz = Math.sin(angle) * dist;
         const blossom = paintGeometry(
            new ConeGeometry(0.08, 0.12, 5).translate(bx, 0.22, bz),
            blossomColors[b % blossomColors.length]
         );
         parts.push(blossom);
      }
      const merged = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      return merged ?? new BoxGeometry(0.6, 0.2, 0.6);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="flower-beds">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.8} />
      </Instanced>
   );
}

/** Slender resort flags on rocks / island perimeter: pole, brass finial, triangular pennant. */
export function PennantPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const pole = paintGeometry(new CylinderGeometry(0.015, 0.018, 0.75, 6).translate(0, 0.375, 0), COLORS.pole);
      const finial = paintGeometry(new IcosahedronGeometry(0.035, 0).translate(0, 0.76, 0), COLORS.gold);
      const pennant = paintGeometry(new ConeGeometry(0.12, 0.28, 3).rotateZ(-Math.PI / 2).translate(0.14, 0.64, 0), COLORS.flag);
      const merged = mergeGeometries([pole, finial, pennant]);
      pole.dispose();
      finial.dispose();
      pennant.dispose();
      return merged ?? new BoxGeometry(0.2, 0.8, 0.1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="pennants">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.7} />
      </Instanced>
   );
}

/** Low-poly distant rolling hills in the background: gentle coastal knolls that eliminate any void. */
export function DistantHills({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const parts: BufferGeometry[] = [];
      const hillA = paintGeometry(new ConeGeometry(1.0, 0.45, 9).translate(0, 0.225, 0), COLORS.hillFar);
      const hillB = paintGeometry(new ConeGeometry(0.75, 0.38, 8).translate(0.35, 0.19, 0.1), COLORS.hillMid);
      parts.push(hillA, hillB);
      const merged = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      return merged ?? new BoxGeometry(1, 0.5, 1);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="distant-hills">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={1} />
      </Instanced>
   );
}

/** Charming resort clubhouse silhouette in the far distance: white pavilion, terracotta hipped roof, cupola. */
export function ClubhouseSilhouette({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const parts: BufferGeometry[] = [];
      // Main pavilion building (white walls)
      const main = paintGeometry(new BoxGeometry(3.2, 1.2, 2.2).translate(0, 0.6, 0), COLORS.clubhouseWall);
      // Terracotta hipped roof
      const roof = paintGeometry(new ConeGeometry(2.5, 0.95, 4).rotateY(Math.PI / 4).translate(0, 1.65, 0), COLORS.clubhouseRoof);
      // Portico / entry columns
      const porch = paintGeometry(new BoxGeometry(1.6, 0.8, 0.6).translate(0, 0.4, 1.2), COLORS.clubhouseTrim);
      // Center cupola / clocktower
      const cupola = paintGeometry(new BoxGeometry(0.65, 0.7, 0.65).translate(0, 2.2, 0), COLORS.clubhouseWall);
      const cupolaRoof = paintGeometry(new ConeGeometry(0.55, 0.5, 6).translate(0, 2.75, 0), COLORS.clubhouseRoof);
      const finial = paintGeometry(new CylinderGeometry(0.03, 0.03, 0.4, 6).translate(0, 3.1, 0), COLORS.gold);
      parts.push(main, roof, porch, cupola, cupolaRoof, finial);
      const merged = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      return merged ?? new BoxGeometry(3, 2, 2);
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="clubhouse">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors flatShading roughness={0.8} />
      </Instanced>
   );
}
