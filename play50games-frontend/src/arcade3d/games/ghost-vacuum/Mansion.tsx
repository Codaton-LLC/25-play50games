"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   CircleGeometry,
   CylinderGeometry,
   DoubleSide,
   Group,
   Matrix4,
   MeshStandardMaterial,
   OctahedronGeometry,
   PlaneGeometry,
   TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { active, ROOMS, WALLS, type Run } from "./rules";

const chairs = ROOMS.map((r) => ({ x: r.x, y: 0, z: r.north * 5.5 }));

/**
 * 2-3 tone Victorian armchair stand-in fallback:
 * dark mahogany frame and carved back with rich velvet cushion.
 */
function FurnitureFallback() {
   const geo = useMemo(() => {
      // Chair seat cushion
      const seat = new BoxGeometry(0.56, 0.12, 0.54).translate(0, 0.34, 0);
      // Chair backrest
      const back = new BoxGeometry(0.54, 0.44, 0.08).translate(0, 0.58, -0.22);
      // 4 turned legs
      const leg1 = new CylinderGeometry(0.035, 0.025, 0.34, 6).translate(-0.22, 0.17, -0.2);
      const leg2 = new CylinderGeometry(0.035, 0.025, 0.34, 6).translate(0.22, 0.17, -0.2);
      const leg3 = new CylinderGeometry(0.035, 0.025, 0.34, 6).translate(-0.22, 0.17, 0.2);
      const leg4 = new CylinderGeometry(0.035, 0.025, 0.34, 6).translate(0.22, 0.17, 0.2);
      const frame = mergeGeometries([back, leg1, leg2, leg3, leg4]);
      leg1.dispose();
      leg2.dispose();
      leg3.dispose();
      leg4.dispose();
      back.dispose();
      return { seat, frame: frame! };
   }, []);

   useEffect(() => () => {
      geo.seat.dispose();
      geo.frame.dispose();
   }, [geo]);

   return (
      <group name="chair-fallback">
         <DynamicInstanced
            count={4}
            update={(i, m) => {
               const p = chairs[i];
               m.makeTranslation(p.x, 0, p.z);
            }}
         >
            <primitive object={geo.seat} attach="geometry" />
            <meshStandardMaterial color={COLORS.chairSeat} roughness={0.7} />
         </DynamicInstanced>
         <DynamicInstanced
            count={4}
            update={(i, m) => {
               const p = chairs[i];
               m.makeTranslation(p.x, 0, p.z);
            }}
         >
            <primitive object={geo.frame} attach="geometry" />
            <meshStandardMaterial color={COLORS.chairWood} roughness={0.8} />
         </DynamicInstanced>
      </group>
   );
}

export default function Mansion({ run }: { run: Run }) {
   const quality = useQuality(), time = useGameTime(), icons = useRef<Array<Group | null>>([]);
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const hidden = (i: number) => run.ghosts.some((g) => g.room === i && g.mode === "hidden");

   useFrame(() => {
      for (let i = 0; i < 4; i++) {
         const icon = icons.current[i];
         if (!icon) continue;
         icon.visible = hidden(i);
         icon.rotation.y = reduced || quality.tier === "low" ? 0 : time.now * 1.8;
         icon.scale.setScalar(reduced || quality.tier === "low" ? 1 : 1 + Math.sin(time.now * 5.5 + i) * 0.18);
      }
   });

   const faded = (i: number) => {
      if (!(i % 2)) return false;
      const b = WALLS[Math.floor(i / 2)];
      const occludes = (x: number, z: number) => x >= b.min.x - 0.5 && x <= b.max.x + 0.5 && b.max.z >= z && b.min.z < z + 3;
      return occludes(run.hunter.x, run.hunter.z) || run.ghosts.some((g) => active(g) && g.mode !== "hidden" && occludes(g.x, g.z));
   };

   const wall = (i: number, m: Matrix4, fade: boolean) => {
      if (faded(i) !== fade) return false;
      const b = WALLS[Math.floor(i / 2)], x = (b.min.x + b.max.x) / 2;
      const lo = i % 2 ? Math.max(b.min.z, run.hunter.z) : b.min.z;
      const hi = i % 2 ? b.max.z : Math.min(b.max.z, run.hunter.z);
      if (hi <= lo) return false;
      const h = i % 2 ? 0.35 : 2.4;
      m.makeScale(b.max.x - b.min.x, h, hi - lo).setPosition(x, h / 2, (lo + hi) / 2);
   };

   // Pre-built geometries for interior props & architectural trims
   const propsGeo = useMemo(() => {
      // 1. Candelabra brass base & decorative curved arms
      const stem = new CylinderGeometry(0.04, 0.08, 0.32, 8).translate(0, 0.16, 0);
      const baseFoot = new CylinderGeometry(0.12, 0.14, 0.04, 10).translate(0, 0.02, 0);
      const armBar = new BoxGeometry(0.36, 0.03, 0.03).translate(0, 0.28, 0);
      const cupL = new CylinderGeometry(0.04, 0.025, 0.04, 6).translate(-0.14, 0.31, 0);
      const cupM = new CylinderGeometry(0.04, 0.025, 0.04, 6).translate(0, 0.36, 0);
      const cupR = new CylinderGeometry(0.04, 0.025, 0.04, 6).translate(0.14, 0.31, 0);
      const candelabraBrass = mergeGeometries([stem, baseFoot, armBar, cupL, cupM, cupR]);
      stem.dispose();
      baseFoot.dispose();
      armBar.dispose();
      cupL.dispose();
      cupM.dispose();
      cupR.dispose();

      // 2. Wall clock case & dial
      const clockCase = new CylinderGeometry(0.24, 0.24, 0.07, 24).translate(0, 0, 0);
      const clockBezel = new TorusGeometry(0.23, 0.015, 6, 24);
      const clockFrame = mergeGeometries([clockCase, clockBezel]);
      clockCase.dispose();
      clockBezel.dispose();

      // 3. Picture frame
      const frameOuter = new BoxGeometry(0.86, 0.66, 0.06);

      // 4. Bevelled book fallback (cover + pages)
      const bookCover = new BoxGeometry(0.22, 0.06, 0.26);
      const bookPages = new BoxGeometry(0.19, 0.04, 0.23).translate(0.01, 0, 0);

      // 5. Cut gem reveal icon (outer gem + bright inner core)
      const gemOuter = new OctahedronGeometry(0.15, 0);
      const gemCore = new OctahedronGeometry(0.075, 0);

      // 6. Warm lamp pool on floor
      const lampPool = new CircleGeometry(2.3, 24).rotateX(-Math.PI / 2);

      return {
         candelabraBrass: candelabraBrass!,
         clockFrame: clockFrame!,
         frameOuter,
         bookCover,
         bookPages,
         gemOuter,
         gemCore,
         lampPool,
      };
   }, []);

   useEffect(() => () => {
      for (const geometry of Object.values(propsGeo)) geometry.dispose();
   }, [propsGeo]);

   // The brass stand-in rides the same pool update as the GLB (fallbackParts are not scaled by asset.scale).
   const candelabraParts = useMemo<readonly InstancePart[]>(() => [{
      geometry: propsGeo.candelabraBrass,
      material: new MeshStandardMaterial({ color: COLORS.brass, metalness: 0.65, roughness: 0.35 }),
   }], [propsGeo]);
   useEffect(() => () => {
      for (const part of candelabraParts) (part.material as MeshStandardMaterial).dispose();
   }, [candelabraParts]);

   return (
      <group name="mansion">
         {/* Spooky cool moonlit interior fill with high ghost readability */}
         <ambientLight intensity={0.82} color="#c7d2fe" />

         {/* 1. Floor: Readable warm Victorian oak parquet base (>= 3:1 contrast against ghosts) */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} name="mansion-floor-border">
            <planeGeometry args={[28, 20]} />
            <meshStandardMaterial color={COLORS.floorDark} roughness={0.82} />
         </mesh>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} name="mansion-floor-main">
            <planeGeometry args={[27.6, 19.6]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.78} />
         </mesh>

         {/* 2. Warm Lamp Light Pools under room candelabras (accents on the readable floor) */}
         <DynamicInstanced
            count={4}
            update={(i, m) => {
               const r = ROOMS[i];
               m.makeScale(1, 1, 1).setPosition(r.x, 0.008, r.z + 0.3);
            }}
            name="warm-lamp-pools"
         >
            <primitive object={propsGeo.lampPool} attach="geometry" />
            <meshBasicMaterial
               color={COLORS.lampPool}
               transparent
               opacity={0.24}
               blending={AdditiveBlending}
               depthWrite={false}
               side={DoubleSide}
            />
         </DynamicInstanced>

         {/* 3. Mansion Walls (Victorian lilac-plum wallpaper, as bright as main) */}
         <DynamicInstanced count={WALLS.length * 2} update={(i, m) => wall(i, m, false)} name="walls-solid">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wall} roughness={0.75} />
         </DynamicInstanced>
         <DynamicInstanced count={WALLS.length * 2} update={(i, m) => wall(i, m, true)} name="walls-faded">
            <boxGeometry />
            <meshStandardMaterial color={COLORS.wallFaded} roughness={0.75} transparent opacity={0.15} depthWrite={false} />
         </DynamicInstanced>

         {/* 4. Furniture: Desks & Chairs */}
         <DynamicInstancedModel
            asset={ASSETS.desk}
            count={4}
            update={(i, m) => {
               const r = ROOMS[i];
               const shake = hidden(i) && !reduced && quality.tier !== "low" ? Math.sin(time.now * 18 + i) * 0.025 : 0;
               m.makeTranslation(r.x + shake, 0, r.z);
            }}
         />
         <InstancedModel asset={ASSETS.chair} spots={chairs} fallback={<FurnitureFallback />} />

         {/* 5. Library Books (leather bound with aged parchment pages) */}
         {[0, 1, 2, 3].map((i) => (
            <Model
               key={i}
               asset={ASSETS.book}
               position={[-10 + (i - 1.5) * 0.3, 0.52, -7]}
               rotation={[Math.PI / 2, 0, 0]}
               fallback={
                  <group>
                     <mesh>
                        <primitive object={propsGeo.bookCover} attach="geometry" />
                        <meshStandardMaterial color={i % 2 === 0 ? COLORS.bookCoverA : COLORS.bookCoverB} roughness={0.7} />
                     </mesh>
                     <mesh>
                        <primitive object={propsGeo.bookPages} attach="geometry" />
                        <meshStandardMaterial color={COLORS.bookPages} roughness={0.9} />
                     </mesh>
                  </group>
               }
            />
         ))}

         {/* 6. Hidden Ghost Reveal Icons in room doorways */}
         {ROOMS.map((r, i) => (
            <group key={i}>
               <group
                  position={[r.x, 1.6, r.z]}
                  ref={(node) => {
                     icons.current[i] = node;
                  }}
               >
                  {/* Sparkling faceted crystal gem reveal icon */}
                  <mesh>
                     <primitive object={propsGeo.gemOuter} attach="geometry" />
                     <meshBasicMaterial color={COLORS.revealIcon} depthWrite={false} />
                  </mesh>
                  <mesh>
                     <primitive object={propsGeo.gemCore} attach="geometry" />
                     <meshBasicMaterial color={COLORS.revealCore} depthWrite={false} blending={AdditiveBlending} />
                  </mesh>
               </group>
            </group>
         ))}

         {/* 7. Ornate candelabras on the 4 desks (Hyper3D GLB; candles and flame shapes are baked in) */}
         <DynamicInstancedModel
            asset={ASSETS.candelabra}
            count={4}
            update={(i, m) => {
               const r = ROOMS[i];
               m.makeTranslation(r.x, 0.6, r.z + 0.3);
            }}
            fallbackParts={candelabraParts}
            name="candelabra-brass-stands"
         />

         {/* 8. Ornate Victorian Wall Clock on North Hall Wall */}
         <group position={[0, 1.5, -9.75]} rotation={[Math.PI / 2, 0, 0]} name="hall-clock">
            <mesh>
               <primitive object={propsGeo.clockFrame} attach="geometry" />
               <meshStandardMaterial color={COLORS.brass} metalness={0.65} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.038, 0]}>
               <circleGeometry args={[0.2, 24]} />
               <meshStandardMaterial color={COLORS.clockFace} roughness={0.9} />
            </mesh>
            {/* Clock hands */}
            <mesh position={[0, 0.042, 0.04]}>
               <boxGeometry args={[0.02, 0.005, 0.12]} />
               <meshBasicMaterial color={COLORS.clockHands} />
            </mesh>
            <mesh position={[0.03, 0.042, 0]}>
               <boxGeometry args={[0.08, 0.005, 0.015]} />
               <meshBasicMaterial color={COLORS.clockHands} />
            </mesh>
         </group>

         {/* 9. Gilded Baroque Oil Painting on Library Wall */}
         <group position={[-13.75, 1.5, -7]} rotation={[0, Math.PI / 2, 0]} name="library-painting">
            <mesh>
               <primitive object={propsGeo.frameOuter} attach="geometry" />
               <meshStandardMaterial color={COLORS.paintingFrame} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
               <planeGeometry args={[0.72, 0.52]} />
               <meshStandardMaterial color={COLORS.paintingCanvas} roughness={0.8} />
            </mesh>
         </group>
      </group>
   );
}
