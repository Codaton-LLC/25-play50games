"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   Color,
   CylinderGeometry,
   IcosahedronGeometry,
   MeshBasicMaterial,
   MeshStandardMaterial,
   type Matrix4,
   type Mesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, InstancedModel, useModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, fitStationScene } from "./assets";
import { COLORS } from "./looks";
import { MODULES, REPAIR, stageAt, type Run } from "./rules";
import { StationHull } from "./StationHull";

const SPOTS = MODULES.map((m) => ({ x: m.x, y: 0, z: m.z, rotY: m.angle }));
const BASES = SPOTS.map((p) => ({ ...p, y: 0.48 }));
const CAPS = SPOTS.map((p) => ({ ...p, y: 1.03 }));
const STRUTS = MODULES.map((m) => ({ x: m.x / 2, y: -0.07, z: m.z / 2, rotY: m.angle }));
const STRUT_LIGHTS = MODULES.map((m) => ({ x: m.x / 2, y: 0.01, z: m.z / 2, rotY: m.angle }));
const STRUT_COLLARS_HUB = MODULES.map((m) => ({ x: m.x * 0.28, y: -0.07, z: m.z * 0.28, rotY: m.angle }));
const STRUT_COLLARS_MOD = MODULES.map((m) => ({ x: m.x * 0.72, y: -0.07, z: m.z * 0.72, rotY: m.angle }));

// Solar wings: mounted at x ±8.7
const PANELS = [-1, 1].map((side) => ({ x: side * 8.7, y: 0.35, z: 0 }));
const PANEL_GIMBALS = [-1, 1].map((side) => ({ x: side * 8.0, y: 0.35, z: 0 }));
const PANEL_GRIDS = [-1, 1].flatMap((side) =>
   Array.from({ length: 5 }, (_, i) => ({ x: side * 8.7, y: 0.41, z: -0.8 + i * 0.4 })),
);

const GOOD = new Color(COLORS.mint);
const BAD = new Color(COLORS.warning);
const ACCENT = new Color(COLORS.accent);
const DARK = new Color(COLORS.shadow);

function drawLabels(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   for (const m of MODULES) {
      const x = (0.5 + m.x / 12) * w;
      const y = (0.5 + m.z / 12) * h;
      ctx.fillStyle = COLORS.space;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.042, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.neonBlue;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = COLORS.white;
      ctx.font = `700 ${Math.round(w * 0.048)}px system-ui`;
      ctx.fillText(String(m.id + 1), x, y);
   }
}

function drawEarth(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.earth;
   ctx.fillRect(0, 0, w, h);

   // Continents
   ctx.fillStyle = COLORS.land;
   const continents = [
      [0.12, 0.22, 0.09, 0.18],
      [0.25, 0.52, 0.07, 0.26],
      [0.58, 0.30, 0.24, 0.14],
      [0.56, 0.54, 0.08, 0.24],
      [0.82, 0.72, 0.09, 0.08],
      [0.38, 0.18, 0.12, 0.09],
   ];
   for (const [x, y, a, b] of continents) {
      ctx.beginPath();
      ctx.ellipse(x * w, y * h, a * w, b * h, 0.3, 0, Math.PI * 2);
      ctx.fill();
   }

   // Swirling atmospheric cloud bands
   ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
   ctx.lineWidth = 12;
   for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (i / 5), h * (0.24 + i * 0.11), w * 0.18, h * 0.09, -0.25, 0, Math.PI);
      ctx.stroke();
   }
}

/** Deliberate code-made fallback for module GLB: bevelled pod with cupola and window ring. */
function Modules() {
   const { scene } = useModel(ASSETS.station);
   const fitted = useMemo(() => {
      if (!scene) return ASSETS.station;
      return fitStationScene(scene);
   }, [scene]);

   return (
      <InstancedModel
         asset={fitted}
         spots={SPOTS}
         fallback={
            <>
               <Instanced spots={BASES}>
                  <cylinderGeometry args={[0.61, 0.66, 0.96, 12]} />
                  <meshStandardMaterial color={COLORS.hull} metalness={0.4} roughness={0.35} />
               </Instanced>
               <Instanced spots={CAPS}>
                  <cylinderGeometry args={[0.5, 0.61, 0.3, 12]} />
                  <meshStandardMaterial color={COLORS.panel} metalness={0.45} roughness={0.3} />
               </Instanced>
            </>
         }
      />
   );
}

export default function Station({ run, reduced }: { run: Run; reduced: boolean }) {
   const time = useGameTime();
   const earth = useRef<Mesh>(null);
   const labels = useCanvasTexture(1024, 1024, drawLabels);
   const earthMap = useCanvasTexture(1024, 512, drawEarth);

   // Pre-built deliberate battery fallback parts (created once, disposed on unmount)
   const batteryParts = useMemo(() => [
      {
         geometry: new CylinderGeometry(0.22, 0.22, 1, 12).translate(0, 0.5, 0),
         material: new MeshStandardMaterial({ color: COLORS.mint, roughness: 0.3, metalness: 0.4, emissive: COLORS.mint, emissiveIntensity: 0.2 }),
      },
      {
         geometry: new CylinderGeometry(0.24, 0.24, 0.16, 12).translate(0, 0.72, 0),
         material: new MeshStandardMaterial({ color: COLORS.gold, metalness: 0.6, roughness: 0.25 }),
      },
      {
         geometry: new CylinderGeometry(0.24, 0.24, 0.14, 12).translate(0, 0.28, 0),
         material: new MeshStandardMaterial({ color: COLORS.panel, roughness: 0.4, metalness: 0.5 }),
      },
   ], []);

   // Pre-built deliberate central docking hub geometry (merged multi-tone structure)
   const hubGeometries = useMemo(() => {
      const baseCollar = new CylinderGeometry(1.22, 1.28, 0.5, 16).translate(0, 0.25, 0);
      const midRing = new CylinderGeometry(1.35, 1.35, 0.12, 16).translate(0, 0.48, 0);
      const dome = new CylinderGeometry(0.85, 1.22, 0.3, 16).translate(0, 0.65, 0);
      const mast = new CylinderGeometry(0.08, 0.12, 0.4, 8).translate(0, 0.95, 0);
      const dish = new CylinderGeometry(0.4, 0.15, 0.12, 12).translate(0, 1.12, 0);

      const hubHull = mergeGeometries([baseCollar, dome]);
      const hubTrim = mergeGeometries([midRing, mast, dish]);

      baseCollar.dispose();
      midRing.dispose();
      dome.dispose();
      mast.dispose();
      dish.dispose();

      const debrisGeo = new IcosahedronGeometry(0.26, 0);

      return {
         hubHull: hubHull ?? new CylinderGeometry(1.2, 1.2, 0.6, 16),
         hubTrim: hubTrim ?? new CylinderGeometry(1.3, 1.3, 0.1, 16),
         debrisGeo,
      };
   }, []);

   useEffect(() => () => {
      for (const part of batteryParts) {
         part.geometry.dispose();
         part.material.dispose();
      }
      hubGeometries.hubHull.dispose();
      hubGeometries.hubTrim.dispose();
      hubGeometries.debrisGeo.dispose();
   }, [batteryParts, hubGeometries]);

   useFrame(() => {
      if (earth.current && !reduced) {
         earth.current.rotation.y = time.now * 0.006;
      }
   });

   const ring = (i: number, m: Matrix4, c: Color) => {
      const p = MODULES[i], b = run.modules[i];
      m.makeRotationX(-Math.PI / 2);
      m.setPosition(p.x, 1.26, p.z);
      c.copy(b.broken ? BAD : run.time - b.fixedAt < 1.2 ? GOOD : ACCENT);
   };

   const dock = (i: number, m: Matrix4, c: Color) => {
      const p = MODULES[i];
      m.makeRotationX(-Math.PI / 2);
      m.setPosition(p.dx, 0.06, p.dz);
      c.copy(run.modules[i].broken ? (run.docked === i ? GOOD : ACCENT) : DARK);
   };

   const pip = (i: number, m: Matrix4, c: Color) => {
      const id = Math.floor(i / 3), n = i % 3, p = MODULES[id], b = run.modules[id];
      if (n >= REPAIR.hits[id]) return false;
      m.makeRotationX(-Math.PI / 2);
      m.setPosition(p.x - 0.18 + 0.18 * n, 1.285, p.z + 0.35);
      c.copy(!b.broken || n < b.hits ? GOOD : BAD);
   };

   const debris = (i: number, m: Matrix4) => {
      if (i >= stageAt(run.time) + 2) return false;
      const p = run.debris[i].position;
      m.makeRotationY(time.play * 0.7 + i);
      m.setPosition(p.x, p.y, p.z);
   };

   const cell = (i: number, m: Matrix4) => {
      const c = run.cells[i];
      if (!c.active) return false;
      m.makeRotationX((-50 * Math.PI) / 180);
      m.setPosition(c.x, c.y - 0.32 + (reduced ? 0 : 0.035 * Math.sin(time.now * 3)), c.z + 0.38);
   };

   return (
      <>
         {/* Sleek orbital station hull deck ground structure */}
         <StationHull />

         {/* Station modules (GLB with deliberate code fallback) */}
         <Modules />

         {/* Radial structural struts: truss body, blue light strip, and docking collars */}
         <Instanced spots={STRUTS} name="struts-body">
            <boxGeometry args={[0.3, 0.16, 4.2]} />
            <meshStandardMaterial color={COLORS.shadow} metalness={0.5} roughness={0.4} />
         </Instanced>
         <Instanced spots={STRUT_LIGHTS} name="struts-light">
            <boxGeometry args={[0.08, 0.03, 3.9]} />
            <meshStandardMaterial color={COLORS.neonBlue} emissive={COLORS.neonBlue} emissiveIntensity={0.8} />
         </Instanced>
         <Instanced spots={STRUT_COLLARS_HUB} name="struts-collars-hub">
            <boxGeometry args={[0.42, 0.22, 0.3]} />
            <meshStandardMaterial color={COLORS.hullTrim} metalness={0.6} roughness={0.35} />
         </Instanced>
         <Instanced spots={STRUT_COLLARS_MOD} name="struts-collars-mod">
            <boxGeometry args={[0.42, 0.22, 0.3]} />
            <meshStandardMaterial color={COLORS.hullTrim} metalness={0.6} roughness={0.35} />
         </Instanced>

         {/* Deliberate multi-tone Central Docking Hub */}
         <mesh geometry={hubGeometries.hubHull} name="hub-hull">
            <meshStandardMaterial color={COLORS.hull} metalness={0.45} roughness={0.35} />
         </mesh>
         <mesh geometry={hubGeometries.hubTrim} name="hub-trim">
            <meshStandardMaterial color={COLORS.panel} metalness={0.55} roughness={0.3} emissive={COLORS.panel} emissiveIntensity={0.2} />
         </mesh>

         {/* Sleek Solar Wings: mounting gimbals, dark panels, and golden grid busbars */}
         <Instanced spots={PANEL_GIMBALS} name="panels-gimbals">
            <cylinderGeometry args={[0.18, 0.18, 0.5, 8]} />
            <meshStandardMaterial color={COLORS.hullTrim} metalness={0.6} roughness={0.4} />
         </Instanced>
         <Instanced spots={PANELS} name="panels-wing">
            <boxGeometry args={[1.2, 0.1, 2]} />
            <meshStandardMaterial color={COLORS.panel} metalness={0.6} roughness={0.25} emissive={COLORS.panel} emissiveIntensity={0.35} />
         </Instanced>
         <Instanced spots={PANEL_GRIDS} name="panels-grid">
            <boxGeometry args={[1.16, 0.025, 0.025]} />
            <meshBasicMaterial color={COLORS.gold} />
         </Instanced>

         {/* Numbered decals on top of the modules */}
         <mesh position-y={1.24} rotation-x={-Math.PI / 2} renderOrder={2}>
            <planeGeometry args={[12, 12]} />
            <meshBasicMaterial map={labels} transparent depthWrite={false} alphaTest={0.02} />
         </mesh>

         {/* Interactive status rings, docking indicators, and hit pips */}
         <DynamicInstanced count={8} update={ring} tinted>
            <ringGeometry args={[0.66, 0.7, 32]} />
            <meshBasicMaterial color={COLORS.white} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={8} update={dock} tinted>
            <ringGeometry args={[0.5, 0.6, 32, 1, 0, Math.PI * 1.8]} />
            <meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={24} update={pip} tinted>
            <circleGeometry args={[0.055, 8]} />
            <meshBasicMaterial depthWrite={false} toneMapped={false} />
         </DynamicInstanced>

         {/* Moving Debris Hazards */}
         <DynamicInstanced count={4} update={debris}>
            <primitive object={hubGeometries.debrisGeo} attach="geometry" />
            <meshStandardMaterial color={COLORS.shadow} metalness={0.5} roughness={0.4} emissive={COLORS.accent} emissiveIntensity={0.25} flatShading />
         </DynamicInstanced>

         {/* Milestone Battery Cells */}
         <DynamicInstancedModel asset={ASSETS.battery} count={3} update={cell} fallbackParts={batteryParts} />

         {/* Planet Earth backdrop with clouds and atmospheric rim glow */}
         <mesh ref={earth} position={[0, -25, -12]} name="planet-earth">
            <sphereGeometry args={[12, 48, 32]} />
            <meshStandardMaterial map={earthMap} roughness={0.9} emissive={COLORS.earth} emissiveIntensity={0.25} />
         </mesh>
         <mesh position={[0, -25, -12]} name="planet-earth-rim">
            <sphereGeometry args={[12.18, 32, 24]} />
            <meshBasicMaterial color={COLORS.rim} transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
      </>
   );
}
