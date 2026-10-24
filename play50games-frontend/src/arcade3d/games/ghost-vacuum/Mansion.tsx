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
   OctahedronGeometry,
   PlaneGeometry,
   TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, Instanced } from "@/arcade3d/core/render";
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

      // 2. Ivory candle wax stalks
      const candle = new CylinderGeometry(0.024, 0.024, 0.22, 6);
      candle.translate(0, 0.11, 0);

      // 3. Glowing candle flame
      const flame = new OctahedronGeometry(0.038, 0);
      flame.scale(0.8, 1.4, 0.8);

      // 4. Wall clock case & dial
      const clockCase = new CylinderGeometry(0.24, 0.24, 0.07, 24).translate(0, 0, 0);
      const clockBezel = new TorusGeometry(0.23, 0.015, 6, 24);
      const clockFrame = mergeGeometries([clockCase, clockBezel]);
      clockCase.dispose();
      clockBezel.dispose();

      // 5. Picture frame
      const frameOuter = new BoxGeometry(0.86, 0.66, 0.06);

      // 6. Panelled door fallback
      const doorLeaf = new BoxGeometry(0.12, 2.2, 1.3).translate(0, 1.1, 0);
      const doorMoulding = new BoxGeometry(0.13, 0.85, 0.45).translate(0, 1.5, 0);
      const doorMouldingLower = new BoxGeometry(0.13, 0.85, 0.45).translate(0, 0.6, 0);
      const doorFallback = mergeGeometries([doorLeaf, doorMoulding, doorMouldingLower]);
      doorLeaf.dispose();
      doorMoulding.dispose();
      doorMouldingLower.dispose();

      // 7. Bevelled book fallback (cover + pages)
      const bookCover = new BoxGeometry(0.22, 0.06, 0.26);
      const bookPages = new BoxGeometry(0.19, 0.04, 0.23).translate(0.01, 0, 0);

      // 8. Cut gem reveal icon (outer gem + bright inner core)
      const gemOuter = new OctahedronGeometry(0.15, 0);
      const gemCore = new OctahedronGeometry(0.075, 0);

      // 9. Warm lamp pool on floor
      const lampPool = new CircleGeometry(2.3, 24).rotateX(-Math.PI / 2);

      return {
         candelabraBrass: candelabraBrass!,
         candle,
         flame,
         clockFrame: clockFrame!,
         frameOuter,
         doorFallback: doorFallback!,
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

   // Room rug spots under each desk
   const roomRugSpots = useMemo(
      () =>
         ROOMS.map((r) => ({
            x: r.x,
            y: 0.006,
            z: r.z,
            rotY: 0,
            sx: 1,
            sy: 1,
            sz: 1,
         })),
      []
   );

   return (
      <group name="mansion">
         {/* Spooky cool moonlit interior fill */}
         <ambientLight intensity={0.65} color="#c7d2fe" />

         {/* 1. Floor: Rich Victorian polished chestnut wood */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} name="mansion-floor">
            <planeGeometry args={[28, 20]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.78} />
         </mesh>

         {/* Central Hall Grand Carpet Runner (rich burgundy with golden border) */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} name="hall-carpet-border">
            <planeGeometry args={[3.6, 19.4]} />
            <meshStandardMaterial color={COLORS.carpetGold} roughness={0.85} />
         </mesh>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} name="hall-carpet-runner">
            <planeGeometry args={[3.2, 19.0]} />
            <meshStandardMaterial color={COLORS.carpet} roughness={0.9} />
         </mesh>

         {/* Room Rugs under the desks */}
         <Instanced spots={roomRugSpots} name="room-rugs-border">
            <planeGeometry args={[3.5, 2.5]} />
            <meshStandardMaterial color={COLORS.carpetGold} roughness={0.85} />
         </Instanced>
         <Instanced spots={roomRugSpots.map((s) => ({ ...s, y: 0.008 }))} name="room-rugs-main">
            <planeGeometry args={[3.2, 2.2]} />
            <meshStandardMaterial color={COLORS.carpet} roughness={0.9} />
         </Instanced>

         {/* 2. Warm Lamp Light Pools on the floor under the room candelabras */}
         <DynamicInstanced
            count={4}
            update={(i, m) => {
               const r = ROOMS[i];
               m.makeScale(1, 1, 1).setPosition(r.x, 0.012, r.z + 0.3);
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

         {/* 3. Mansion Walls (gothic dusty plum wallpaper) */}
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

         {/* 6. Doors & Hidden Ghost Reveal Icons */}
         {ROOMS.map((r, i) => (
            <group key={i}>
               <Model
                  asset={ASSETS.door}
                  position={[r.doorX + r.side * 0.3, 0, r.doorZ - r.north * 1.8]}
                  rotation={[0, Math.PI / 2, 0]}
                  fallback={
                     <mesh position={[0, 0, 0]}>
                        <primitive object={propsGeo.doorFallback} attach="geometry" />
                        <meshStandardMaterial color={COLORS.doorWood} roughness={0.8} />
                     </mesh>
                  }
               />
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

         {/* 7. Ornate Brass Candelabras on the 4 desks */}
         <DynamicInstanced
            count={4}
            update={(i, m) => {
               const r = ROOMS[i];
               m.makeTranslation(r.x, 0.6, r.z + 0.3);
            }}
            name="candelabra-brass-stands"
         >
            <primitive object={propsGeo.candelabraBrass} attach="geometry" />
            <meshStandardMaterial color={COLORS.brass} metalness={0.65} roughness={0.35} />
         </DynamicInstanced>

         {/* Ivory Candle Stalks (3 per candelabra) */}
         <DynamicInstanced
            count={12}
            update={(i, m) => {
               const r = ROOMS[Math.floor(i / 3)];
               const slot = (i % 3) - 1;
               const yOff = i % 3 === 1 ? 0.05 : 0;
               m.makeTranslation(r.x + slot * 0.14, 0.91 + yOff, r.z + 0.3);
            }}
            name="candle-wax-stalks"
         >
            <primitive object={propsGeo.candle} attach="geometry" />
            <meshStandardMaterial color={COLORS.candleWax} roughness={0.9} />
         </DynamicInstanced>

         {/* Glowing Candle Flames (3 per candelabra with subtle flicker) */}
         <DynamicInstanced
            count={12}
            update={(i, m) => {
               const r = ROOMS[Math.floor(i / 3)];
               const slot = (i % 3) - 1;
               const yOff = i % 3 === 1 ? 0.05 : 0;
               const flicker = !reduced ? 1 + Math.sin(time.now * 12 + i * 1.7) * 0.12 : 1;
               m.makeScale(flicker, flicker * 1.1, flicker).setPosition(
                  r.x + slot * 0.14,
                  1.18 + yOff,
                  r.z + 0.3
               );
            }}
            name="candle-flames"
         >
            <primitive object={propsGeo.flame} attach="geometry" />
            <meshBasicMaterial color={COLORS.candleFlame} />
         </DynamicInstanced>

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
