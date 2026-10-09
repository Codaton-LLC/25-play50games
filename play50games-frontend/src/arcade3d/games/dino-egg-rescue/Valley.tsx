"use client";

import { useMemo } from "react";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { TreePrimitive } from "./Primitives";
import { BOULDER_LANES, MUD, NEST, TREES, VALLEY } from "./rules";

const TREE_SPOTS: InstanceSpot[] = TREES.positions.map((t, idx) => ({
   x: t.x,
   y: 0,
   z: t.z,
   yaw: (idx * 1.47) % (Math.PI * 2),
   scale: 1,
}));

export function Valley() {
   // Procedural straw texture for nest
   const strawTexture = useCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = "#b45309";
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
         const x1 = (i * 17) % 128;
         const y1 = (i * 31) % 128;
         const len = 15 + ((i * 7) % 25);
         const angle = ((i * 13) % 360) * (Math.PI / 180);
         ctx.beginPath();
         ctx.moveTo(x1, y1);
         ctx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
         ctx.stroke();
      }
   });

   return (
      <group name="valley">
         {/* Main valley terrain */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[VALLEY.halfX * 2 + 8, VALLEY.halfZ * 2 + 8]} />
            <meshStandardMaterial color="#84cc16" roughness={0.8} />
         </mesh>

         {/* Soil path patches / borders */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <ringGeometry args={[14.5, 18.0, 32]} />
            <meshStandardMaterial color="#a16207" roughness={0.9} />
         </mesh>

         {/* Gully lane indicators on terrain */}
         {BOULDER_LANES.map((lane) => {
            const midX = (lane.startX + lane.endX) / 2;
            const midZ = (lane.startZ + lane.endZ) / 2;
            const dx = lane.endX - lane.startX;
            const dz = lane.endZ - lane.startZ;
            const len = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            return (
               <mesh
                  key={lane.id}
                  position={[midX, 0.002, midZ]}
                  rotation={[-Math.PI / 2, 0, -angle]}
               >
                  <planeGeometry args={[len, 1.8]} />
                  <meshStandardMaterial
                     color="#713f12"
                     roughness={0.95}
                     transparent
                     opacity={0.35}
                  />
               </mesh>
            );
         })}

         {/* 3 Mud pits */}
         {MUD.patches.map((mud, idx) => (
            <mesh
               key={idx}
               position={[mud.x, 0.008, mud.z]}
               rotation={[-Math.PI / 2, 0, 0]}
            >
               <circleGeometry args={[MUD.radius, 24]} />
               <meshStandardMaterial color="#582f0e" roughness={0.95} />
            </mesh>
         ))}

         {/* Volcano backdrop cone in NE outside valley bounds at (16, -13) */}
         <group position={[16, 0, -13]}>
            {/* Mountain cone */}
            <mesh position={[0, 4.0, 0]}>
               <coneGeometry args={[5.5, 8.0, 16, 1, true]} />
               <meshStandardMaterial color="#292524" roughness={0.9} />
            </mesh>
            {/* Glowing lava crater */}
            <mesh position={[0, 7.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <circleGeometry args={[1.4, 16]} />
               <meshStandardMaterial
                  color="#ea580c"
                  emissive="#f97316"
                  emissiveIntensity={2.5}
                  roughness={0.3}
               />
            </mesh>
         </group>

         {/* Nest at SE (11, 7.5), outer radius 1.8 m */}
         <group position={[NEST.x, 0, NEST.z]}>
            {/* Straw torus rim */}
            <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
               <torusGeometry args={[1.5, 0.35, 12, 24]} />
               <meshStandardMaterial
                  map={strawTexture}
                  color="#d97706"
                  roughness={0.85}
               />
            </mesh>
            {/* Straw floor inside nest */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <circleGeometry args={[1.4, 24]} />
               <meshStandardMaterial
                  map={strawTexture}
                  color="#b45309"
                  roughness={0.9}
               />
            </mesh>
            {/* Delivery contact rim indicator */}
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
               <ringGeometry args={[1.35, 1.45, 24]} />
               <meshStandardMaterial
                  color="#facc15"
                  emissive="#eab308"
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.6}
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
