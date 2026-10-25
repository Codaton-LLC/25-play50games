"use client";

// The modern airport baggage hall:
// - Polished airport tile floor (70x70 m) covering the view frustum at all three viewport sizes.
// - Panoramic North window wall overlooking outdoor tarmac, taxiway markings, and distant airfield.
// - West terminal wall with conveyor intake portal (spawn z=0) and reject portal (overflow z=14.2).
// - Outdoor taxiing plane and waving ground crew handler.
// - Instanced decor (carts, cargo, lights, pillars) via <Decor />.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, DoubleSide, Group, RepeatWrapping } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { HumanoidModel, blendPoses, bodyLift, createPose, idlePose, reachPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { Decor } from "./Decor";
import { ASSETS, HANDLER_SCALE } from "./assets";
import { COLORS, FLOOR } from "./looks";
import { HandlerPrimitive, PlanePrimitive } from "./Primitives";

function rgbOf(hex: string): [number, number, number] {
   const n = parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface MeshBuilder {
   positions: number[];
   colors: number[];
   normals: number[];
}

function pushQuad(
   b: MeshBuilder,
   v0: [number, number, number],
   v1: [number, number, number],
   v2: [number, number, number],
   v3: [number, number, number],
   normal: [number, number, number],
   hex: string
) {
   const c = rgbOf(hex);
   b.positions.push(...v0, ...v1, ...v2);
   b.normals.push(...normal, ...normal, ...normal);
   b.colors.push(...c, ...c, ...c);
   b.positions.push(...v0, ...v2, ...v3);
   b.normals.push(...normal, ...normal, ...normal);
   b.colors.push(...c, ...c, ...c);
}

function pushBox(
   b: MeshBuilder,
   cx: number,
   cy: number,
   cz: number,
   w: number,
   h: number,
   d: number,
   hex: string
) {
   const hw = w / 2;
   const hh = h / 2;
   const hd = d / 2;
   pushQuad(b, [cx + hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz + hd], [1, 0, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz + hd], [cx - hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz - hd], [-1, 0, 0], hex);
   pushQuad(b, [cx - hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd], [0, 1, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz + hd], [cx - hw, cy - hh, cz + hd], [0, -1, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd], [0, 0, 1], hex);
   pushQuad(b, [cx + hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz - hd], [cx - hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz - hd], [0, 0, -1], hex);
}

function buildGeometry(b: MeshBuilder): BufferGeometry {
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(new Float32Array(b.positions), 3));
   geo.setAttribute("normal", new BufferAttribute(new Float32Array(b.normals), 3));
   geo.setAttribute("color", new BufferAttribute(new Float32Array(b.colors), 3));
   return geo;
}

/** Merged terminal architecture: North window wall structure, West wall with portals and signage */
function createHallArchitectureGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };

   // 1. North Window Wall (z = -2.5, x from -10 to +24):
   // Lower sill / kickplate wall (y: 0 to 0.75):
   pushBox(b, 7.0, 0.375, -2.5, 34.0, 0.75, 0.3, COLORS.wall);
   pushBox(b, 7.0, 0.08, -2.34, 34.0, 0.16, 0.04, COLORS.wallBase);
   // Sill ledge:
   pushBox(b, 7.0, 0.78, -2.5, 34.2, 0.06, 0.4, COLORS.windowFrame);

   // Window vertical mullions / steel pillars:
   for (let x = -8.0; x <= 22.0; x += 5.0) {
      pushBox(b, x, 2.7, -2.5, 0.18, 3.8, 0.28, COLORS.windowFrame);
   }
   // Upper window frame header:
   pushBox(b, 7.0, 4.6, -2.5, 34.0, 0.24, 0.32, COLORS.windowFrame);
   // Upper wall transom header up to ceiling (y: 4.7 to 5.6):
   pushBox(b, 7.0, 5.15, -2.5, 34.0, 0.9, 0.3, COLORS.wall);
   // Roof fascia trim:
   pushBox(b, 7.0, 5.65, -2.48, 34.2, 0.1, 0.36, COLORS.steelFrame);

   // 2. West Terminal Wall (x = -2.0, z from -2.5 to 17.5):
   // Main wall body (y: 0 to 5.6):
   pushBox(b, -2.0, 2.8, 7.5, 0.3, 5.6, 20.0, COLORS.wall);
   // Baseboard:
   pushBox(b, -1.84, 0.1, 7.5, 0.04, 0.2, 20.0, COLORS.wallBase);
   // Accent stripe (airline blue):
   pushBox(b, -1.84, 3.6, 7.5, 0.03, 0.14, 20.0, COLORS.wallAccent);

   // 3. Conveyor Intake Portal at z = 0 (where bags spawn from west):
   // Stainless steel intake shroud housing:
   pushBox(b, -1.5, 0.85, 0, 1.2, 0.8, 1.3, COLORS.steelFrame);
   pushBox(b, -0.92, 0.85, 0, 0.08, 0.86, 1.36, COLORS.chuteTrim);
   // Rubber hanging curtain flaps inside portal:
   pushBox(b, -0.96, 0.75, 0, 0.04, 0.6, 1.1, COLORS.rubberBumper);
   // Portal status light bar above:
   pushBox(b, -0.9, 1.35, 0, 0.08, 0.12, 0.8, COLORS.signBg);
   pushBox(b, -0.85, 1.35, 0, 0.04, 0.08, 0.7, COLORS.diverterGlow);

   // 4. Overflow Reject Portal at z = 14.2 (where overflow belt terminates):
   pushBox(b, 0.2, 0.85, 14.2, 0.9, 0.8, 1.3, COLORS.steelFrame);
   pushBox(b, 0.62, 0.85, 14.2, 0.08, 0.86, 1.36, COLORS.chuteTrim);
   pushBox(b, 0.58, 0.75, 14.2, 0.04, 0.6, 1.1, COLORS.rubberBumper);

   // 5. Overhead Terminal Signboards along the West Wall:
   // Flight Ops sign:
   pushBox(b, -1.78, 3.2, 4.0, 0.06, 0.5, 2.2, COLORS.signBg);
   pushBox(b, -1.74, 3.2, 4.0, 0.03, 0.44, 2.1, COLORS.signYellow);
   // Security sign:
   pushBox(b, -1.78, 3.2, 11.0, 0.06, 0.5, 2.0, COLORS.signBg);
   pushBox(b, -1.74, 3.2, 11.0, 0.03, 0.44, 1.9, COLORS.signYellow);

   return buildGeometry(b);
}

const ARCHITECTURE_GEO = createHallArchitectureGeometry();

/** Polished airport terrazzo / tile canvas drawer */
const drawFloorTiles: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = COLORS.floor;
   ctx.fillRect(0, 0, width, height);

   // 8x8 tiles per texture block (each tile 64x64 px)
   const tiles = 8;
   const tileSize = width / tiles;
   for (let r = 0; r < tiles; r++) {
      for (let c = 0; c < tiles; c++) {
         const x = c * tileSize;
         const y = r * tileSize;
         const tone = (r * 7 + c * 13) % 4;
         ctx.fillStyle = tone === 0 ? COLORS.floorTile : tone === 1 ? COLORS.floor : COLORS.floorGrout;
         ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
   }
   // Clean grout lines:
   ctx.strokeStyle = COLORS.floorGrout;
   ctx.lineWidth = 2;
   for (let i = 0; i <= tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tileSize, 0);
      ctx.lineTo(i * tileSize, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * tileSize);
      ctx.lineTo(width, i * tileSize);
      ctx.stroke();
   }
};

/** Outdoor runway tarmac canvas drawer */
const drawTarmac: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = COLORS.tarmac;
   ctx.fillRect(0, 0, width, height);

   // Yellow taxiway centerline:
   ctx.strokeStyle = COLORS.tarmacLine;
   ctx.lineWidth = 12;
   ctx.beginPath();
   ctx.moveTo(0, height * 0.5);
   ctx.lineTo(width, height * 0.5);
   ctx.stroke();

   // White dashed safety edge lines:
   ctx.strokeStyle = COLORS.tarmacStripe;
   ctx.lineWidth = 6;
   ctx.setLineDash([24, 16]);
   ctx.beginPath();
   ctx.moveTo(0, height * 0.2);
   ctx.lineTo(width, height * 0.2);
   ctx.moveTo(0, height * 0.8);
   ctx.lineTo(width, height * 0.8);
   ctx.stroke();
   ctx.setLineDash([]);
};

export function Hall() {
   const quality = useQuality();
   const showDecor = quality.tier !== "low";

   // Polished floor texture:
   const floorTex = useCanvasTexture(512, 512, drawFloorTiles);
   useEffect(() => {
      floorTex.wrapS = floorTex.wrapT = RepeatWrapping;
      floorTex.repeat.set(14, 14);
      floorTex.needsUpdate = true;
   }, [floorTex]);

   // Outdoor tarmac texture:
   const tarmacTex = useCanvasTexture(512, 256, drawTarmac);
   useEffect(() => {
      tarmacTex.wrapS = tarmacTex.wrapT = RepeatWrapping;
      tarmacTex.repeat.set(6, 2);
      tarmacTex.needsUpdate = true;
   }, [tarmacTex]);

   return (
      <group name="hall">
         {/* 1. Main Polished Baggage Hall Floor (70x70 m) covering all viewports */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[FLOOR.centerX, 0, FLOOR.centerZ]}
            receiveShadow
            name="hall-floor"
         >
            <planeGeometry args={[FLOOR.width, FLOOR.depth]} />
            <meshStandardMaterial
               map={floorTex}
               color="#ffffff"
               roughness={0.35}
               metalness={0.05}
            />
         </mesh>

         {/* 2. Outdoor Airport Apron / Tarmac plane outside North Window */}
         <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[FLOOR.centerX, 0.015, -18.5]}
            name="outdoor-tarmac"
         >
            <planeGeometry args={[FLOOR.width, 32]} />
            <meshStandardMaterial
               map={tarmacTex}
               color="#ffffff"
               roughness={0.8}
            />
         </mesh>

         {/* 3. Terminal Architecture: North Window Wall, West Wall, Portals & Signage */}
         <mesh geometry={ARCHITECTURE_GEO} dispose={null} name="hall-architecture">
            <meshStandardMaterial vertexColors roughness={0.45} metalness={0.1} />
         </mesh>

         {/* 4. Panoramic North Window Glass (spanning x -8 to +22, y 0.8 to 4.6 at z -2.5) */}
         <mesh position={[7.0, 2.7, -2.5]} name="window-glass">
            <planeGeometry args={[30.0, 3.8]} />
            <meshStandardMaterial
               color="#bae6fd"
               emissive="#7dd3fc"
               emissiveIntensity={0.25}
               transparent
               opacity={0.35}
               side={DoubleSide}
               roughness={0.1}
               metalness={0.3}
            />
         </mesh>

         {/* 5. Instanced surroundings outside play area */}
         {showDecor && <Decor />}

         {/* 6. Taxiing airplane outside on the tarmac */}
         {showDecor && <WindowPlane />}

         {/* 7. Ground crew handler */}
         {showDecor && <Handler />}
      </group>
   );
}

function WindowPlane() {
   const time = useGameTime();
   const ref = useRef<Group>(null);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      // Smooth taxiing along runway outside the window (z = -6.5)
      g.position.x = 8.0 + Math.sin(time.now * 0.25) * 4.5;
   });
   return (
      <group ref={ref} position={[8.0, 0.45, -6.5]} rotation={[0, Math.PI, 0]}>
         <Model asset={ASSETS.plane} fallback={<PlanePrimitive />} />
      </group>
   );
}

function Handler() {
   const time = useGameTime();
   const [a] = useState(createPose);
   const [b] = useState(createPose);
   const lift = useRef(0);
   const pose = useHumanoidPose((p) => {
      idlePose(time.now, a);
      reachPose(1, 0.65, b);
      blendPoses(a, b, 0.8, p);
      lift.current = bodyLift(p, RUNNER_LANDMARKS) * HANDLER_SCALE;
   });
   const root = useRef<Group>(null);
   useFrame(() => {
      const g = root.current;
      if (g) g.position.y = lift.current;
   });
   return (
      <group ref={root} position={[8.6, 0, 6.2]} rotation={[0, Math.PI * 0.85, 0]}>
         <HumanoidModel asset={ASSETS.handler} pose={pose} applyLift={false} fallback={<HandlerPrimitive />} />
      </group>
   );
}
