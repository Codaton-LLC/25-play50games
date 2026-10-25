"use client";

// Instanced yard dressing outside the play square. Geometries are created once and stay inside
// DECOR_LOCAL (looks.ts); the occlusion test uses those bounds. No dispose={null} on a primitive
// geometry: R3F v8 would overwrite geometry.dispose and the cleanup would throw.
import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstanceSpot } from "../../core/render";
import { COLORS, decorOf, type DecorSpot } from "./looks";

function rgb(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
   const count = geo.getAttribute("position").count;
   const color = new Float32Array(count * 3);
   const [r, g, b] = rgb(hex);
   for (let i = 0; i < count; i++) {
      color[i * 3] = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;
   }
   geo.setAttribute("color", new BufferAttribute(color, 3));
   return geo;
}

function merged(parts: BufferGeometry[]): BufferGeometry {
   const geo = mergeGeometries(parts, false);
   for (const part of parts) part.dispose();
   if (!geo) throw new Error("knight-arena look: merge");
   geo.computeVertexNormals();
   return geo;
}

function wallGeometry(): BufferGeometry {
   const body = paint(new BoxGeometry(1, 0.7, 0.78).translate(0, 0.35, 0), COLORS.stone);
   const cap = paint(new BoxGeometry(1.08, 0.12, 0.9).translate(0, 0.76, 0), COLORS.stoneDark);
   const merlons = [-0.32, 0, 0.32].map((x) =>
      paint(new BoxGeometry(0.2, 0.18, 0.4).translate(x, 0.91, 0), COLORS.stoneMid),
   );
   return merged([body, cap, ...merlons]);
}

function tentGeometry(): BufferGeometry {
   const cloth = paint(new ConeGeometry(0.66, 0.68, 7).translate(0, 0.5, 0), COLORS.tent);
   const band = paint(new CylinderGeometry(0.48, 0.5, 0.07, 7).translate(0, 0.4, 0), COLORS.tentStripe);
   const pole = paint(new CylinderGeometry(0.045, 0.055, 0.88, 6).translate(0, 0.44, 0), COLORS.woodDark);
   return merged([cloth, band, pole]);
}

function rackGeometry(): BufferGeometry {
   const posts = [-0.42, 0.42].map((x) =>
      paint(new CylinderGeometry(0.055, 0.07, 1, 6).translate(x, 0.5, 0), COLORS.wood),
   );
   const bar = paint(new CylinderGeometry(0.04, 0.04, 0.92, 6).rotateZ(Math.PI / 2).translate(0, 0.78, 0), COLORS.woodDark);
   const swords = [-0.24, 0, 0.24].map((x) =>
      paint(new ConeGeometry(0.035, 0.42, 4).translate(x, 0.5, 0), COLORS.steel),
   );
   const caps = [-0.42, 0.42].map((x) =>
      paint(new IcosahedronGeometry(0.045, 0).translate(x, 0.96, 0), COLORS.goldDeep),
   );
   return merged([...posts, bar, ...swords, ...caps]);
}

function houseGeometry(): BufferGeometry {
   const body = paint(new CylinderGeometry(0.44, 0.48, 0.52, 8).translate(0, 0.26, 0), COLORS.plaster);
   const roof = paint(new ConeGeometry(0.66, 0.48, 8).translate(0, 0.74, 0), COLORS.roof);
   const chimney = paint(new CylinderGeometry(0.07, 0.08, 0.26, 5).translate(0.22, 0.96, 0.08), COLORS.stoneDark);
   return merged([body, roof, chimney]);
}

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((item) => ({
      x: item.x, y: item.y, z: item.z, rotY: item.rotY, sx: item.sx, sy: item.sy, sz: item.sz,
   }));
}

export function Decor(): React.ReactElement {
   const geo = useMemo(() => ({
      wall: wallGeometry(),
      tent: tentGeometry(),
      rack: rackGeometry(),
      house: houseGeometry(),
      hillA: new IcosahedronGeometry(1, 1).translate(0, 0.9, 0),
      hillB: new IcosahedronGeometry(1, 1).translate(0, 0.9, 0),
      tuft: new ConeGeometry(0.4, 0.66, 5).translate(0, 0.33, 0),
      rock: new IcosahedronGeometry(0.42, 0).translate(0, 0.36, 0),
   }), []);
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const walls = useMemo(() => asSpots(decorOf("wall")), []);
   const tents = useMemo(() => asSpots(decorOf("tent")), []);
   const racks = useMemo(() => asSpots(decorOf("rack")), []);
   const houses = useMemo(() => asSpots(decorOf("house")), []);
   const hillsA = useMemo(() => asSpots(decorOf("hill", 0)), []);
   const hillsB = useMemo(() => asSpots(decorOf("hill", 1)), []);
   const tufts = useMemo(() => asSpots(decorOf("tuft")), []);
   const rocks = useMemo(() => asSpots(decorOf("rock")), []);

   return (
      <group name="knight-decor">
         <Instanced spots={walls} name="knight-walls">
            <primitive object={geo.wall} attach="geometry" />
            <meshStandardMaterial vertexColors flatShading roughness={0.92} />
         </Instanced>
         <Instanced spots={tents} name="knight-tents">
            <primitive object={geo.tent} attach="geometry" />
            <meshStandardMaterial vertexColors flatShading roughness={0.84} />
         </Instanced>
         <Instanced spots={racks} name="knight-racks">
            <primitive object={geo.rack} attach="geometry" />
            <meshStandardMaterial vertexColors flatShading roughness={0.62} metalness={0.08} />
         </Instanced>
         <Instanced spots={houses} name="knight-houses">
            <primitive object={geo.house} attach="geometry" />
            <meshStandardMaterial vertexColors flatShading roughness={0.88} />
         </Instanced>
         <Instanced spots={hillsA} name="knight-hills-a">
            <primitive object={geo.hillA} attach="geometry" />
            <meshStandardMaterial color={COLORS.grassShade} flatShading roughness={1} />
         </Instanced>
         <Instanced spots={hillsB} name="knight-hills-b">
            <primitive object={geo.hillB} attach="geometry" />
            <meshStandardMaterial color={COLORS.grass} flatShading roughness={1} />
         </Instanced>
         <Instanced spots={tufts} name="knight-tufts">
            <primitive object={geo.tuft} attach="geometry" />
            <meshStandardMaterial color={COLORS.grassSun} flatShading roughness={1} />
         </Instanced>
         <Instanced spots={rocks} name="knight-rocks">
            <primitive object={geo.rock} attach="geometry" />
            <meshStandardMaterial color={COLORS.stoneMid} flatShading roughness={0.95} />
         </Instanced>
      </group>
   );
}
