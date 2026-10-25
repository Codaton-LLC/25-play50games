"use client";

// The cave kitchen: tiled floor, the serving-hatch wall with stone arch trims,
// the warm bevelled wooden counter under the wheel, the glowing stove with copper trim,
// back wall with spooky-cute night windows, heavy ceiling beams, and shelves.
// Static set dressing: everything is placed once; textures and geometries are disposed on unmount.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   CanvasTexture,
   ExtrudeGeometry,
   MeshStandardMaterial,
   RepeatWrapping,
   Shape,
   SRGBColorSpace,
   type Mesh,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";
import { COLORS, drawKitchenTiles } from "./looks";

/** The counter top (m), also the stove drum's top and the wheel's height (rules.WHEEL.y). */
export const COUNTER_TOP = 0.9;
/** The serving hatch: wall plane and the two window slots (x) the monsters stand behind. */
export const HATCH_Z = -1.7;
export const HATCH_X = [-0.8, 0.8] as const;
/** Where the ordering monsters stand (z, on the floor behind the hatch). */
export const MONSTER_Z = -2.32;
/** The dimmed queue monster, further back. */
export const QUEUE_Z = -2.72;
/** The hatch opening: width and y band (m). */
const OPENING = { w: 1.35, y0: 0.7, y1: 2.3 };

/** The shelf over the left hatch: in front of the wall face (HATCH_Z), its top at SHELF.top. */
const SHELF = { x: -2.35, z: HATCH_Z + 0.13, depth: 0.26, top: 2.47 };
const JAR_H = 0.22;

export function Kitchen() {
   const quality = useQuality();
   const time = useGameTime();
   const fireRef = useRef<Mesh>(null);

   // Tiled kitchen floor with terracotta square tiles and warm grout
   const tileTexture = useCanvasTexture(512, 512, drawKitchenTiles);
   useEffect(() => {
      tileTexture.wrapS = tileTexture.wrapT = RepeatWrapping;
      tileTexture.repeat.set(16, 16);
      tileTexture.needsUpdate = true;
   }, [tileTexture]);

   // Soft ember pulsing inside the stove firebox
   useFrame(() => {
      const mesh = fireRef.current;
      if (!mesh) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.emissiveIntensity = 1.6 + 0.35 * Math.sin(time.now * 3.4) + 0.15 * Math.cos(time.now * 7.1);
   });

   // The hatch wall: one extruded shape with two arch openings
   const wall = useMemo(() => {
      const shape = new Shape();
      shape.moveTo(-3.2, 0);
      shape.lineTo(1.75, 0);
      shape.lineTo(1.75, 2.9);
      shape.lineTo(-3.2, 2.9);
      shape.closePath();
      for (const x of HATCH_X) {
         const hole = new Shape();
         hole.moveTo(x - OPENING.w / 2, OPENING.y0);
         hole.lineTo(x + OPENING.w / 2, OPENING.y0);
         hole.lineTo(x + OPENING.w / 2, OPENING.y1);
         hole.lineTo(x - OPENING.w / 2, OPENING.y1);
         hole.closePath();
         shape.holes.push(hole);
      }
      const geometry = new ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
      geometry.translate(0, 0, -0.14);
      return geometry;
   }, []);
   useEffect(() => () => wall.dispose(), [wall]);

   // Paper-label texture shared by all spice jars on the shelf
   const jarTexture = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#a16207";
      ctx.fillRect(0, 0, 64, 32);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(4, 6, 56, 20);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(10, 11, 26, 3);
      ctx.fillRect(10, 17, 40, 3);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      return texture;
   }, []);
   useEffect(() => () => jarTexture.dispose(), [jarTexture]);

   const jarSpots = useMemo(() => {
      const count = scaledCount(8, quality.tier === "low" ? 0.5 : 1);
      const spots = [];
      for (let i = 0; i < count; i++) {
         const scale = 0.9 + (i % 3) * 0.12;
         spots.push({
            x: -3.05 + i * 0.22,
            y: SHELF.top + (JAR_H / 2) * scale,
            z: HATCH_Z + 0.12,
            scale,
         });
      }
      return spots;
   }, [quality.tier]);

   const mushroomSpots = useMemo(() => {
      const count = scaledCount(5, quality.decor);
      const base = [
         { x: 1.15, z: -1.25, scale: 0.55, rotY: 0.4 },
         { x: 1.5, z: -1.0, scale: 0.4, rotY: 2.1 },
         { x: 0.95, z: -0.85, scale: 0.32, rotY: 4.0 },
         { x: -2.75, z: -1.15, scale: 0.45, rotY: 1.2 },
         { x: -3.0, z: -0.85, scale: 0.3, rotY: 5.3 },
      ];
      return base.slice(0, count).map((s) => ({ ...s, y: 0 }));
   }, [quality.decor]);

   return (
      <group name="kitchen">
         {/* Tiled kitchen floor: 44m x 44m so no screen edge ever shows sky/void */}
         <mesh rotation-x={-Math.PI / 2} position={[-0.7, 0, -1]}>
            <planeGeometry args={[44, 44]} />
            <meshStandardMaterial
               map={tileTexture}
               roughness={0.65}
               metalness={0.08}
            />
         </mesh>

         {/* The hatch wall (front face at HATCH_Z) in warm stone */}
         <mesh geometry={wall} position-z={HATCH_Z}>
            <meshStandardMaterial color={COLORS.wallBase} roughness={0.85} />
         </mesh>

         {/* Stone arch trims and voussoirs around the two hatch openings */}
         {HATCH_X.map((x, idx) => (
            <group key={idx} position={[x, 0, HATCH_Z + 0.01]}>
               {/* Wooden serving ledge sill */}
               <mesh position={[0, OPENING.y0 - 0.02, 0.06]}>
                  <boxGeometry args={[OPENING.w + 0.12, 0.07, 0.24]} />
                  <meshStandardMaterial color={COLORS.woodCounterTop} roughness={0.5} />
               </mesh>
               {/* Left arch stone post */}
               <mesh position={[-OPENING.w / 2 - 0.04, (OPENING.y0 + OPENING.y1) / 2, 0.02]}>
                  <boxGeometry args={[0.1, OPENING.y1 - OPENING.y0 + 0.04, 0.12]} />
                  <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
               </mesh>
               {/* Right arch stone post */}
               <mesh position={[OPENING.w / 2 + 0.04, (OPENING.y0 + OPENING.y1) / 2, 0.02]}>
                  <boxGeometry args={[0.1, OPENING.y1 - OPENING.y0 + 0.04, 0.12]} />
                  <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
               </mesh>
               {/* Top stone lintel / arch keystone */}
               <mesh position={[0, OPENING.y1 + 0.04, 0.03]}>
                  <boxGeometry args={[OPENING.w + 0.24, 0.11, 0.14]} />
                  <meshStandardMaterial color={COLORS.stoneKeystone} roughness={0.75} />
               </mesh>
            </group>
         ))}

         {/* Heavy wooden lintel across the entire hatch top */}
         <mesh position={[-0.72, OPENING.y1 + 0.12, HATCH_Z + 0.05]}>
            <boxGeometry args={[5.1, 0.12, 0.18]} />
            <meshStandardMaterial color={COLORS.woodBase} roughness={0.65} />
         </mesh>

         {/* Upper wall trim band */}
         <mesh position={[-0.72, 2.92, HATCH_Z - 0.07]}>
            <boxGeometry args={[5.2, 0.09, 0.18]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.8} />
         </mesh>

         {/* Far back rock wall behind the queue monster and hatch */}
         <mesh position={[-0.7, 3.4, -3.38]}>
            <planeGeometry args={[26, 7.2]} />
            <meshStandardMaterial color={COLORS.wallDark} roughness={0.95} />
         </mesh>

         {/* Spooky-cute night windows on the back wall outside play bounds */}
         {/* Left window: arched stone frame with moon & starry night sky */}
         <group position={[-4.1, 2.45, -3.34]}>
            {/* Night sky quad */}
            <mesh>
               <planeGeometry args={[1.2, 1.6]} />
               <meshBasicMaterial color={COLORS.nightWindowSky} />
            </mesh>
            {/* Cute glowing crescent moon */}
            <mesh position={[0.26, 0.42, 0.02]}>
               <circleGeometry args={[0.18, 18]} />
               <meshStandardMaterial
                  color={COLORS.moon}
                  emissive={COLORS.moon}
                  emissiveIntensity={1.2}
               />
            </mesh>
            {/* Stone window frame */}
            <mesh position={[0, 0, 0.03]}>
               <ringGeometry args={[0.54, 0.68, 20, 1, 0, Math.PI]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[-0.59, -0.4, 0.03]}>
               <boxGeometry args={[0.12, 0.82, 0.08]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[0.59, -0.4, 0.03]}>
               <boxGeometry args={[0.12, 0.82, 0.08]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.84, 0.06]}>
               <boxGeometry args={[1.42, 0.1, 0.16]} />
               <meshStandardMaterial color={COLORS.woodCounterTop} roughness={0.6} />
            </mesh>
         </group>

         {/* Right window: arched stone frame with starry night sky */}
         <group position={[3.6, 2.45, -3.34]}>
            <mesh>
               <planeGeometry args={[1.2, 1.6]} />
               <meshBasicMaterial color={COLORS.nightWindowSky} />
            </mesh>
            {/* Twinkling star glow */}
            <mesh position={[-0.22, 0.35, 0.02]}>
               <circleGeometry args={[0.06, 10]} />
               <meshStandardMaterial
                  color={COLORS.star}
                  emissive={COLORS.star}
                  emissiveIntensity={1.4}
               />
            </mesh>
            <mesh position={[0.25, 0.12, 0.02]}>
               <circleGeometry args={[0.045, 10]} />
               <meshStandardMaterial
                  color={COLORS.star}
                  emissive={COLORS.star}
                  emissiveIntensity={1.2}
               />
            </mesh>
            {/* Stone window frame */}
            <mesh position={[0, 0, 0.03]}>
               <ringGeometry args={[0.54, 0.68, 20, 1, 0, Math.PI]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[-0.59, -0.4, 0.03]}>
               <boxGeometry args={[0.12, 0.82, 0.08]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[0.59, -0.4, 0.03]}>
               <boxGeometry args={[0.12, 0.82, 0.08]} />
               <meshStandardMaterial color={COLORS.stoneArch} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.84, 0.06]}>
               <boxGeometry args={[1.42, 0.1, 0.16]} />
               <meshStandardMaterial color={COLORS.woodCounterTop} roughness={0.6} />
            </mesh>
         </group>

         {/* Overhead heavy ceiling timber beams spanning across x at y 3.35 */}
         <mesh position={[-0.7, 3.38, -2.1]}>
            <boxGeometry args={[16, 0.24, 0.28]} />
            <meshStandardMaterial color={COLORS.woodDark} roughness={0.8} />
         </mesh>
         <mesh position={[-0.7, 3.38, 0.2]}>
            <boxGeometry args={[16, 0.24, 0.28]} />
            <meshStandardMaterial color={COLORS.woodDark} roughness={0.8} />
         </mesh>

         {/* Wooden counter under the wheel with bevelled countertop & panel details */}
         <group position={[-2, 0, 0.05]}>
            {/* Counter cabinet main body */}
            <mesh position={[0, (COUNTER_TOP - 0.06) / 2, 0]}>
               <boxGeometry args={[2.08, COUNTER_TOP - 0.06, 1.02]} />
               <meshStandardMaterial color={COLORS.woodBase} roughness={0.6} />
            </mesh>
            {/* Polished bevelled countertop slab */}
            <mesh position={[0, COUNTER_TOP - 0.03, 0]}>
               <boxGeometry args={[2.18, 0.06, 1.12]} />
               <meshStandardMaterial
                  color={COLORS.woodCounterTop}
                  roughness={0.4}
                  metalness={0.06}
               />
            </mesh>
            {/* Front drawer and cabinet trim panels */}
            <mesh position={[-0.52, 0.42, 0.52]}>
               <boxGeometry args={[0.9, 0.64, 0.03]} />
               <meshStandardMaterial color={COLORS.woodLight} roughness={0.55} />
            </mesh>
            <mesh position={[0.52, 0.42, 0.52]}>
               <boxGeometry args={[0.9, 0.64, 0.03]} />
               <meshStandardMaterial color={COLORS.woodLight} roughness={0.55} />
            </mesh>
            {/* Brass drawer handles */}
            <mesh position={[-0.52, 0.52, 0.54]}>
               <boxGeometry args={[0.2, 0.035, 0.035]} />
               <meshStandardMaterial
                  color={COLORS.brass}
                  metalness={0.85}
                  roughness={0.25}
               />
            </mesh>
            <mesh position={[0.52, 0.52, 0.54]}>
               <boxGeometry args={[0.2, 0.035, 0.035]} />
               <meshStandardMaterial
                  color={COLORS.brass}
                  metalness={0.85}
                  roughness={0.25}
               />
            </mesh>
            {/* Dark wood kickplate along bottom */}
            <mesh position={[0, 0.05, 0.5]}>
               <boxGeometry args={[2.08, 0.1, 0.04]} />
               <meshStandardMaterial color={COLORS.woodDark} roughness={0.7} />
            </mesh>
         </group>

         {/* Stove drum under the cauldron: cast iron with stone rim and copper bands */}
         <group position={[0, 0, -0.1]}>
            {/* Cast-iron stove body */}
            <mesh position={[0, COUNTER_TOP / 2, 0]}>
               <cylinderGeometry args={[0.58, 0.62, COUNTER_TOP, 24]} />
               <meshStandardMaterial color={COLORS.stoveIron} roughness={0.7} />
            </mesh>
            {/* Stone top hearth lip */}
            <mesh position={[0, COUNTER_TOP - 0.02, 0]}>
               <cylinderGeometry args={[0.61, 0.59, 0.05, 24]} />
               <meshStandardMaterial color={COLORS.stoveTrim} roughness={0.75} />
            </mesh>
            {/* Copper trim rings around stove drum */}
            <mesh position={[0, 0.65, 0]}>
               <torusGeometry args={[0.595, 0.016, 8, 24]} />
               <meshStandardMaterial
                  color={COLORS.copper}
                  metalness={0.85}
                  roughness={0.28}
               />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
               <torusGeometry args={[0.615, 0.016, 8, 24]} />
               <meshStandardMaterial
                  color={COLORS.copper}
                  metalness={0.85}
                  roughness={0.28}
               />
            </mesh>
            {/* Firebox arched door frame */}
            <mesh position={[0, 0.32, 0.59]}>
               <boxGeometry args={[0.38, 0.36, 0.04]} />
               <meshStandardMaterial color={COLORS.stoveGrate} roughness={0.8} />
            </mesh>
            {/* Internal roaring charcoal fire glow */}
            <mesh ref={fireRef} position={[0, 0.32, 0.61]}>
               <circleGeometry args={[0.15, 16]} />
               <meshStandardMaterial
                  color={COLORS.fireGlow}
                  emissive={COLORS.fireCore}
                  emissiveIntensity={1.8}
                  roughness={1}
               />
            </mesh>
         </group>

         {/* Shelf over the left hatch: bevelled wood with copper brackets */}
         <group position={[SHELF.x, SHELF.top - 0.03, SHELF.z]}>
            <mesh>
               <boxGeometry args={[1.7, 0.06, SHELF.depth]} />
               <meshStandardMaterial color={COLORS.woodCounterTop} roughness={0.5} />
            </mesh>
            {/* Left & right copper shelf brackets */}
            <mesh position={[-0.65, -0.1, -0.06]}>
               <boxGeometry args={[0.04, 0.16, 0.16]} />
               <meshStandardMaterial
                  color={COLORS.copper}
                  metalness={0.8}
                  roughness={0.3}
               />
            </mesh>
            <mesh position={[0.65, -0.1, -0.06]}>
               <boxGeometry args={[0.04, 0.16, 0.16]} />
               <meshStandardMaterial
                  color={COLORS.copper}
                  metalness={0.8}
                  roughness={0.3}
               />
            </mesh>
         </group>

         {/* Instanced jars on the shelf */}
         <Instanced spots={jarSpots} name="jars">
            <cylinderGeometry args={[0.07, 0.075, JAR_H, 12]} />
            <meshStandardMaterial map={jarTexture} roughness={0.45} />
         </Instanced>

         {/* Shared mushroom decor */}
         <InstancedModel
            asset={ASSETS.mushroom}
            spots={mushroomSpots}
            fallback={
               <Instanced spots={mushroomSpots} name="mushroom-standins">
                  <sphereGeometry args={[0.2, 12, 10]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.6} />
               </Instanced>
            }
         />
      </group>
   );
}
