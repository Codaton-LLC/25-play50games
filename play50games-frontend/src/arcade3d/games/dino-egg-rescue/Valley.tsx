"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BufferAttribute,
   BufferGeometry,
   RepeatWrapping,
   type Mesh,
} from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import {
   Instanced,
   useCanvasTexture,
   type CanvasDraw,
   type InstanceSpot,
} from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { COLORS, valleyRidgeMesh, type ColoredMesh } from "./looks";
import { TreePrimitive, VolcanoConePrimitive } from "./Primitives";
import { BOULDER_LANES, MUD, NEST, TREES, VALLEY } from "./rules";

const TREE_SPOTS: InstanceSpot[] = TREES.positions.map((t, idx) => ({
   x: t.x,
   y: 0,
   z: t.z,
   yaw: (idx * 1.47) % (Math.PI * 2),
   scale: 1,
}));

function coloredGeometry(data: ColoredMesh): BufferGeometry {
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
   geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
   geometry.computeVertexNormals();
   return geometry;
}

const drawValleyMeadow: CanvasDraw = (ctx, width, height) => {
   // Lush prehistoric mossy grass base
   ctx.fillStyle = COLORS.grass;
   ctx.fillRect(0, 0, width, height);

   // Sunlit & deep shaded dappled patches
   const tones = [COLORS.grassSun, COLORS.grassShade, COLORS.grassDeep, COLORS.soilWarm];
   for (let i = 0; i < 48; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.22 + (i % 4) * 0.07;
      ctx.beginPath();
      ctx.ellipse(
         (i * 103) % width,
         (i * 57) % height,
         24 + (i * 19) % 65,
         14 + (i * 13) % 35,
         ((i * 23) % 60) * 0.02,
         0,
         Math.PI * 2
      );
      ctx.fill();
   }
   ctx.globalAlpha = 1;
};

export function Valley({ telegraphLanes }: { telegraphLanes?: readonly boolean[] }) {
   // Warm golden straw texture for nest with woven criss-crossing fibres
   const strawTexture = useCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = COLORS.straw;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = COLORS.strawLight;
      ctx.lineWidth = 2;
      for (let i = 0; i < 90; i++) {
         const x1 = (i * 17) % 128;
         const y1 = (i * 31) % 128;
         const len = 15 + ((i * 7) % 25);
         const angle = ((i * 13) % 360) * (Math.PI / 180);
         ctx.beginPath();
         ctx.moveTo(x1, y1);
         ctx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
         ctx.stroke();
      }
      ctx.strokeStyle = COLORS.strawDark;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 60; i++) {
         const x1 = (i * 23 + 5) % 128;
         const y1 = (i * 19 + 7) % 128;
         const len = 12 + ((i * 9) % 20);
         const angle = ((i * 27) % 360) * (Math.PI / 180);
         ctx.beginPath();
         ctx.moveTo(x1, y1);
         ctx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
         ctx.stroke();
      }
   });

   // Valley floor organic meadow texture
   const meadowTexture = useCanvasTexture(512, 512, drawValleyMeadow);
   useEffect(() => {
      meadowTexture.wrapS = meadowTexture.wrapT = RepeatWrapping;
      meadowTexture.repeat.set(4, 4);
      meadowTexture.needsUpdate = true;
   }, [meadowTexture]);

   // Low-poly surrounding ridges (stay flat inside valley, rise outside)
   const ridges = useMemo(() => coloredGeometry(valleyRidgeMesh()), []);
   useEffect(() => () => ridges.dispose(), [ridges]);

   // Telegraph warning markers read in frame loop (state mutated in place)
   const telegraphRefs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      for (let i = 0; i < telegraphRefs.current.length; i++) {
         const m = telegraphRefs.current[i];
         if (m) m.visible = telegraphLanes?.[i] ?? false;
      }
   });

   return (
      <group name="valley">
         {/* Main valley terrain meadow plane */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[VALLEY.halfX * 2 + 10, VALLEY.halfZ * 2 + 10]} />
            <meshStandardMaterial
               map={meadowTexture}
               roughness={0.8}
               polygonOffset
               polygonOffsetFactor={1}
               polygonOffsetUnits={1}
            />
         </mesh>

         {/* Surrounding low-poly prehistoric ridges */}
         <mesh geometry={ridges} dispose={null} name="valley-ridges">
            <meshStandardMaterial vertexColors flatShading roughness={1} />
         </mesh>

         {/* Soil path boundary ring */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <ringGeometry args={[14.5, 17.5, 32]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.9} />
         </mesh>

         {/* Gully lane tracks on terrain */}
         {BOULDER_LANES.map((lane, idx) => {
            const midX = (lane.startX + lane.endX) / 2;
            const midZ = (lane.startZ + lane.endZ) / 2;
            const dx = lane.endX - lane.startX;
            const dz = lane.endZ - lane.startZ;
            const len = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);

            return (
               <group key={lane.id}>
                  {/* Worn earthen trench */}
                  <mesh
                     position={[midX, 0.002, midZ]}
                     rotation={[-Math.PI / 2, 0, -angle]}
                  >
                     <planeGeometry args={[len, 1.8]} />
                     <meshStandardMaterial
                        color={COLORS.gullyBed}
                        roughness={0.95}
                        transparent
                        opacity={0.4}
                     />
                  </mesh>

                  {/* 0.8 s lane entrance warning telegraph */}
                  <mesh
                     ref={(el) => {
                        telegraphRefs.current[idx] = el;
                     }}
                     visible={false}
                     position={[lane.startX, 0.03, lane.startZ]}
                     rotation={[-Math.PI / 2, 0, 0]}
                  >
                     <circleGeometry args={[0.95, 24]} />
                     <meshStandardMaterial
                        color={COLORS.telegraphWarn}
                        emissive={COLORS.telegraphGlow}
                        emissiveIntensity={1.8}
                        transparent
                        opacity={0.75}
                     />
                  </mesh>
               </group>
            );
         })}

         {/* 3 Mud pits (layered: dried rim, glossy wet mud pool, bubbling blisters) */}
         {MUD.patches.map((mud, idx) => (
            <group key={idx} position={[mud.x, 0, mud.z]}>
               {/* Dried earthy rim */}
               <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[MUD.radius * 0.85, MUD.radius * 1.08, 28]} />
                  <meshStandardMaterial color={COLORS.mudRim} roughness={0.95} />
               </mesh>
               {/* Wet glossy mud center */}
               <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[MUD.radius, 28]} />
                  <meshStandardMaterial color={COLORS.mudDark} roughness={0.3} />
               </mesh>
               {/* Low-poly bubbling blisters */}
               <mesh position={[0.3, 0.04, 0.4]} scale={[1, 0.4, 1]}>
                  <sphereGeometry args={[0.22, 8, 8]} />
                  <meshStandardMaterial color={COLORS.mudBubble} roughness={0.35} />
               </mesh>
               <mesh position={[-0.4, 0.03, -0.3]} scale={[1, 0.35, 1]}>
                  <sphereGeometry args={[0.18, 8, 8]} />
                  <meshStandardMaterial color={COLORS.mudBubble} roughness={0.35} />
               </mesh>
            </group>
         ))}

         {/* Volcano backdrop GLB in NE outside valley bounds at (16, -13) */}
         <group position={[16, 0, -13]}>
            <Model asset={ASSETS.volcano} fallback={<VolcanoConePrimitive />} />
            {/* Glowing lava crater on the GLB crater rim */}
            <mesh position={[0, 7.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <circleGeometry args={[1.2, 16]} />
               <meshStandardMaterial
                  color={COLORS.lavaGlow}
                  emissive={COLORS.lavaCore}
                  emissiveIntensity={2.5}
                  roughness={0.3}
               />
            </mesh>
         </group>

         {/* Nest at SE (11, 7.5), outer radius 1.8 m */}
         <group position={[NEST.x, 0, NEST.z]}>
            {/* Warm straw torus rim */}
            <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
               <torusGeometry args={[1.5, 0.28, 12, 28]} />
               <meshStandardMaterial
                  map={strawTexture}
                  color="#ffffff"
                  roughness={0.7}
               />
            </mesh>
            {/* Straw floor inside nest */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <circleGeometry args={[1.4, 24]} />
               <meshStandardMaterial
                  map={strawTexture}
                  color="#ffffff"
                  roughness={0.75}
               />
            </mesh>
            {/* Delivery contact rim indicator */}
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <ringGeometry args={[1.35, 1.45, 28]} />
               <meshStandardMaterial
                  color={COLORS.nestRing}
                  emissive={COLORS.straw}
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.65}
               />
            </mesh>
         </group>

         {/* 8 Leafy trees */}
         <InstancedModel
            asset={ASSETS.leafyTree}
            spots={TREE_SPOTS}
            fallback={
               <Instanced spots={TREE_SPOTS}>
                  <TreePrimitive />
               </Instanced>
            }
         />
      </group>
   );
}
