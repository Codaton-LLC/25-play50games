"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   SphereGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY ?? 0,
      sx: spot.sx ?? 1,
      sy: spot.sy ?? 1,
      sz: spot.sz ?? 1,
   }));
}

/**
 * Procedural decor outside the playable room:
 * Mahogany bookshelves, book rows, framed pictures, windows, potted plants,
 * and warm banker's lamps framing the cosy escape room office.
 * Includes a large extended foundation floor so no sky/void shows at any aspect.
 */
export function Decor() {
   const quality = useQuality();

   const geo = useMemo(() => {
      // Bookshelf: outer frame, backing board and 4 horizontal shelves
      const frameL = new BoxGeometry(0.08, 1, 0.35).translate(-0.46, 0, 0);
      const frameR = new BoxGeometry(0.08, 1, 0.35).translate(0.46, 0, 0);
      const top = new BoxGeometry(1, 0.06, 0.38).translate(0, 0.47, 0);
      const bottom = new BoxGeometry(1, 0.06, 0.38).translate(0, -0.47, 0);
      const back = new BoxGeometry(0.96, 0.94, 0.04).translate(0, 0, -0.15);
      const shelf1 = new BoxGeometry(0.92, 0.04, 0.32).translate(0, -0.22, 0);
      const shelf2 = new BoxGeometry(0.92, 0.04, 0.32).translate(0, 0.02, 0);
      const shelf3 = new BoxGeometry(0.92, 0.04, 0.32).translate(0, 0.26, 0);
      const shelf = mergeGeometries([frameL, frameR, top, bottom, back, shelf1, shelf2, shelf3]);
      frameL.dispose();
      frameR.dispose();
      top.dispose();
      bottom.dispose();
      back.dispose();
      shelf1.dispose();
      shelf2.dispose();
      shelf3.dispose();

      // Book row: stylized row of multi-height books
      const b1 = new BoxGeometry(0.12, 0.9, 0.7).translate(-0.4, 0, 0);
      const b2 = new BoxGeometry(0.14, 0.82, 0.68).translate(-0.25, -0.04, 0);
      const b3 = new BoxGeometry(0.11, 0.95, 0.72).translate(-0.11, 0.025, 0);
      const b4 = new BoxGeometry(0.13, 0.76, 0.66).translate(0.03, -0.07, 0);
      const b5 = new BoxGeometry(0.15, 0.88, 0.7).translate(0.18, -0.01, 0);
      const b6 = new BoxGeometry(0.12, 0.84, 0.68).translate(0.33, -0.03, 0);
      const b7 = new BoxGeometry(0.1, 0.92, 0.7).translate(0.45, 0.01, 0);
      const bookRow = mergeGeometries([b1, b2, b3, b4, b5, b6, b7]);
      b1.dispose();
      b2.dispose();
      b3.dispose();
      b4.dispose();
      b5.dispose();
      b6.dispose();
      b7.dispose();

      // Plant: ceramic pot + saucer + lush layered foliage
      const pot = new CylinderGeometry(0.32, 0.22, 0.55, 10).translate(0, -0.2, 0);
      const saucer = new CylinderGeometry(0.28, 0.28, 0.06, 10).translate(0, -0.49, 0);
      const potBase = mergeGeometries([pot, saucer]);
      pot.dispose();
      saucer.dispose();

      const leafA = new DodecahedronGeometry(0.42, 0).translate(0, 0.22, 0);
      const leafB = new IcosahedronGeometry(0.34, 0).translate(-0.14, 0.44, 0.08);
      const leafC = new IcosahedronGeometry(0.3, 0).translate(0.14, 0.46, -0.08);
      const plantLeaves = mergeGeometries([leafA, leafB, leafC]);
      leafA.dispose();
      leafB.dispose();
      leafC.dispose();

      // Framed picture: dark wood bevelled frame + canvas
      const fT = new BoxGeometry(1, 0.08, 0.06).translate(0, 0.46, 0);
      const fB = new BoxGeometry(1, 0.08, 0.06).translate(0, -0.46, 0);
      const fL = new BoxGeometry(0.08, 0.84, 0.06).translate(-0.46, 0, 0);
      const fR = new BoxGeometry(0.08, 0.84, 0.06).translate(0.46, 0, 0);
      const picFrame = mergeGeometries([fT, fB, fL, fR]);
      fT.dispose();
      fB.dispose();
      fL.dispose();
      fR.dispose();
      const picCanvas = new BoxGeometry(0.86, 0.86, 0.02).translate(0, 0, -0.01);

      // Window: outer frame + multi-pane crossbars
      const wT = new BoxGeometry(1, 0.08, 0.1).translate(0, 0.46, 0);
      const wB = new BoxGeometry(1, 0.08, 0.1).translate(0, -0.46, 0);
      const wL = new BoxGeometry(0.08, 0.84, 0.1).translate(-0.46, 0, 0);
      const wR = new BoxGeometry(0.08, 0.84, 0.1).translate(0.46, 0, 0);
      const wMidH = new BoxGeometry(0.84, 0.05, 0.06).translate(0, 0, 0);
      const wMidV = new BoxGeometry(0.05, 0.84, 0.06).translate(0, 0, 0);
      const winFrame = mergeGeometries([wT, wB, wL, wR, wMidH, wMidV]);
      wT.dispose();
      wB.dispose();
      wL.dispose();
      wR.dispose();
      wMidH.dispose();
      wMidV.dispose();
      const winGlass = new BoxGeometry(0.88, 0.88, 0.02);

      // Banker's lamp: brass base + neck + green glass shade + glowing bulb
      const lBase = new CylinderGeometry(0.25, 0.28, 0.08, 10).translate(0, -0.4, 0);
      const lStem = new CylinderGeometry(0.04, 0.04, 0.65, 8).translate(0, -0.05, 0);
      const lArm = new BoxGeometry(0.4, 0.04, 0.06).translate(0, 0.28, 0);
      const lampBody = mergeGeometries([lBase, lStem, lArm]);
      lBase.dispose();
      lStem.dispose();
      lArm.dispose();
      const lampShade = new BoxGeometry(0.6, 0.22, 0.32).translate(0, 0.24, 0);
      const lampBulb = new SphereGeometry(0.09, 8, 8).translate(0, 0.16, 0);

      // Wall panel: lower wainscoting (wood) + upper wall surface
      const wainscot = new BoxGeometry(1, 0.32, 1).translate(0, -0.34, 0);
      const dadoRail = new BoxGeometry(1.02, 0.06, 1.04).translate(0, -0.16, 0);
      const wallLower = mergeGeometries([wainscot, dadoRail]);
      wainscot.dispose();
      dadoRail.dispose();
      const wallUpper = new BoxGeometry(1, 0.68, 1).translate(0, 0.2, 0);

      // Moulding / cornice strip
      const moulding = new BoxGeometry(1, 1, 1);

      return {
         shelf: shelf ?? new BoxGeometry(1, 1, 1),
         bookRow: bookRow ?? new BoxGeometry(1, 1, 1),
         potBase: potBase ?? new BoxGeometry(1, 1, 1),
         plantLeaves: plantLeaves ?? new BoxGeometry(1, 1, 1),
         picFrame: picFrame ?? new BoxGeometry(1, 1, 1),
         picCanvas,
         winFrame: winFrame ?? new BoxGeometry(1, 1, 1),
         winGlass,
         lampBody: lampBody ?? new BoxGeometry(1, 1, 1),
         lampShade,
         lampBulb,
         wallLower: wallLower ?? new BoxGeometry(1, 1, 1),
         wallUpper,
         moulding,
      };
   }, []);

   // Clean disposal on unmount. No dispose={null} on primitives!
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Spots scaled by quality tier
   const shelves = useMemo(() => asSpots(decorOf("shelf").slice(0, scaledCount(decorOf("shelf").length, quality.decor))), [quality.decor]);
   const bookRows = useMemo(() => asSpots(decorOf("bookRow").slice(0, scaledCount(decorOf("bookRow").length, quality.decor))), [quality.decor]);
   const plants = useMemo(() => asSpots(decorOf("plant").slice(0, scaledCount(decorOf("plant").length, quality.decor))), [quality.decor]);
   const pictures = useMemo(() => asSpots(decorOf("picture").slice(0, scaledCount(decorOf("picture").length, quality.decor))), [quality.decor]);
   const windows = useMemo(() => asSpots(decorOf("window").slice(0, scaledCount(decorOf("window").length, quality.decor))), [quality.decor]);
   const lamps = useMemo(() => asSpots(decorOf("lamp").slice(0, scaledCount(decorOf("lamp").length, quality.decor))), [quality.decor]);
   const wallPanels = useMemo(() => asSpots(decorOf("wallPanel")), []);
   const mouldings = useMemo(() => asSpots(decorOf("moulding")), []);

   return (
      <group name="escape-decor">
         {/* Extended foundation floor: spans 90 x 90 so no sky/void shows at any aspect ratio */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]} name="extended-foundation-floor">
            <planeGeometry args={[90, 90]} />
            <meshStandardMaterial color={COLORS.floorSub} roughness={0.92} />
         </mesh>

         {/* Outer wall wainscoting (warm wood lower) */}
         {wallPanels.length > 0 && (
            <Instanced spots={wallPanels} name="outer-wall-wainscot">
               <primitive object={geo.wallLower} attach="geometry" />
               <meshStandardMaterial color={COLORS.wallWood} roughness={0.7} />
            </Instanced>
         )}

         {/* Outer wall upper surface (cosy painted slate-blue) */}
         {wallPanels.length > 0 && (
            <Instanced spots={wallPanels} name="outer-wall-upper">
               <primitive object={geo.wallUpper} attach="geometry" />
               <meshStandardMaterial color={COLORS.wallPaint} roughness={0.85} />
            </Instanced>
         )}

         {/* Crown moulding along top of wall */}
         {mouldings.length > 0 && (
            <Instanced spots={mouldings} name="outer-wall-cornice">
               <primitive object={geo.moulding} attach="geometry" />
               <meshStandardMaterial color={COLORS.wallTrim} roughness={0.7} />
            </Instanced>
         )}

         {/* Mahogany bookshelves */}
         {shelves.length > 0 && (
            <Instanced spots={shelves} name="bookshelves">
               <primitive object={geo.shelf} attach="geometry" />
               <meshStandardMaterial color={COLORS.shelfWood} roughness={0.65} />
            </Instanced>
         )}

         {/* Books on shelves */}
         {bookRows.length > 0 && (
            <Instanced spots={bookRows} name="book-rows">
               <primitive object={geo.bookRow} attach="geometry" />
               <meshStandardMaterial color={COLORS.bookRed} roughness={0.55} />
            </Instanced>
         )}

         {/* Framed pictures: frame */}
         {pictures.length > 0 && (
            <Instanced spots={pictures} name="picture-frames">
               <primitive object={geo.picFrame} attach="geometry" />
               <meshStandardMaterial color={COLORS.frameWood} roughness={0.6} />
            </Instanced>
         )}

         {/* Framed pictures: canvas */}
         {pictures.length > 0 && (
            <Instanced spots={pictures} name="picture-canvases">
               <primitive object={geo.picCanvas} attach="geometry" />
               <meshStandardMaterial color={COLORS.frameCanvas} roughness={0.8} />
            </Instanced>
         )}

         {/* Windows: frame */}
         {windows.length > 0 && (
            <Instanced spots={windows} name="window-frames">
               <primitive object={geo.winFrame} attach="geometry" />
               <meshStandardMaterial color={COLORS.windowFrame} roughness={0.5} />
            </Instanced>
         )}

         {/* Windows: glass */}
         {windows.length > 0 && (
            <Instanced spots={windows} name="window-glass">
               <primitive object={geo.winGlass} attach="geometry" />
               <meshStandardMaterial color={COLORS.windowGlass} roughness={0.2} transparent opacity={0.65} />
            </Instanced>
         )}

         {/* Plant pots */}
         {plants.length > 0 && (
            <Instanced spots={plants} name="plant-pots">
               <primitive object={geo.potBase} attach="geometry" />
               <meshStandardMaterial color={COLORS.plantPot} roughness={0.6} />
            </Instanced>
         )}

         {/* Plant leaves */}
         {plants.length > 0 && (
            <Instanced spots={plants} name="plant-leaves">
               <primitive object={geo.plantLeaves} attach="geometry" />
               <meshStandardMaterial color={COLORS.plantLeaf} flatShading roughness={0.7} />
            </Instanced>
         )}

         {/* Lamps: brass stand */}
         {lamps.length > 0 && (
            <Instanced spots={lamps} name="lamp-stands">
               <primitive object={geo.lampBody} attach="geometry" />
               <meshStandardMaterial color={COLORS.lampBrass} metalness={0.7} roughness={0.3} />
            </Instanced>
         )}

         {/* Lamps: green glass shade */}
         {lamps.length > 0 && (
            <Instanced spots={lamps} name="lamp-shades">
               <primitive object={geo.lampShade} attach="geometry" />
               <meshStandardMaterial color={COLORS.lampShade} roughness={0.35} />
            </Instanced>
         )}

         {/* Lamps: glowing bulb */}
         {lamps.length > 0 && (
            <Instanced spots={lamps} name="lamp-bulbs">
               <primitive object={geo.lampBulb} attach="geometry" />
               <meshStandardMaterial color={COLORS.lampGlow} emissive={COLORS.lampGlow} emissiveIntensity={0.6} />
            </Instanced>
         )}
      </group>
   );
}
