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
   type PointLight,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, InstancedModel, useModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, fitStationScene } from "./assets";
import { COLORS } from "./looks";
import { REPAIR, stageAt, stationOf, type Run, type StationLayout } from "./rules";

/** Everything Station draws from the level's layout (rules.ts STATIONS): pods, struts to the centre,
 *  the solid boxes by role (solar wings, power spine, antenna masts, bulkheads, cargo crates). */
function stationSpots(st: StationLayout) {
   const M = st.modules;
   const SPOTS = M.map((m) => ({ x: m.x, y: 0, z: m.z, rotY: m.angle }));
   // a strut runs from the pod to the station centre (yawed along that line, its length stretched)
   const strut = (m: (typeof M)[number], k: number, y: number) => ({ x: m.x * k, y, z: m.z * k, rotY: Math.atan2(m.x, m.z), sz: Math.hypot(m.x, m.z) / 4.2 });
   const boxes = (role: StationLayout["boxes"][number]["role"]) => st.boxes.filter((b) => b.role === role);
   const wing = boxes("wing");
   return {
      SPOTS,
      BASES: SPOTS.map((p) => ({ ...p, y: 0.48 })),
      CAPS: SPOTS.map((p) => ({ ...p, y: 1.03 })),
      STRUTS: M.map((m) => strut(m, 0.5, -0.07)),
      STRUT_LIGHTS: M.map((m) => strut(m, 0.5, 0.01)),
      STRUT_COLLARS_HUB: M.map((m) => ({ ...strut(m, 0.28, -0.07), sz: 1 })),
      STRUT_COLLARS_MOD: M.map((m) => ({ ...strut(m, 0.72, -0.07), sz: 1 })),
      // solar wings: dark panels with gold busbars, gimbal on the station side
      PANELS: wing.map((b) => ({ x: (b.x0 + b.x1) / 2, y: 0.35, z: (b.z0 + b.z1) / 2, sx: (b.x1 - b.x0) / 1.2, sz: (b.z1 - b.z0) / 2 })),
      PANEL_GIMBALS: wing.map((b) => {
         const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, alongX = Math.abs(cx) > Math.abs(cz);
         return { x: alongX ? cx - Math.sign(cx) * 0.7 : cx, y: 0.35, z: alongX ? cz : cz - Math.sign(cz) * 0.7 };
      }),
      PANEL_GRIDS: wing.flatMap((b) => {
         const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, dpt = b.z1 - b.z0;
         return Array.from({ length: 5 }, (_, i) => ({ x: cx, y: 0.41, z: cz - dpt * 0.4 + i * dpt * 0.2, sx: w / 1.2 }));
      }),
      SPINES: boxes("spine").map((b) => ({ x: (b.x0 + b.x1) / 2, y: 0.3, z: (b.z0 + b.z1) / 2, sx: b.x1 - b.x0, sy: 0.6, sz: b.z1 - b.z0 })),
      MASTS: boxes("mast").map((b) => ({ x: (b.x0 + b.x1) / 2, y: 1, z: (b.z0 + b.z1) / 2, sx: (b.x1 - b.x0) / 0.64, sz: (b.z1 - b.z0) / 0.64 })),
      BULKHEADS: boxes("bulkhead").map((b) => ({ x: (b.x0 + b.x1) / 2, y: 0.55, z: (b.z0 + b.z1) / 2, rotY: Math.atan2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), sx: b.x1 - b.x0, sy: 1.1, sz: b.z1 - b.z0 })),
      CRATES: boxes("crate").map((b) => ({ x: (b.x0 + b.x1) / 2, y: 0.45, z: (b.z0 + b.z1) / 2, rotY: 0.2, sx: b.x1 - b.x0, sy: 0.9, sz: b.z1 - b.z0 })),
   };
}
type Spots = ReturnType<typeof stationSpots>;

const GOOD = new Color(COLORS.mint);
const BAD = new Color(COLORS.warning);
const ACCENT = new Color(COLORS.accent);
const DOCK_LIVE = new Color(COLORS.dockLive);
const DOCK_IDLE = new Color(COLORS.dockIdle);

const labelDrawer = (st: StationLayout) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.clearRect(0, 0, w, h);
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   for (const m of st.modules) {
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
};

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
function Modules({ spots }: { spots: Spots }) {
   const { SPOTS, BASES, CAPS } = spots;
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
   const st = stationOf(run.level), MODULES = st.modules;
   const spots = useMemo(() => stationSpots(st), [st]);
   const { STRUTS, STRUT_LIGHTS, STRUT_COLLARS_HUB, STRUT_COLLARS_MOD, PANELS, PANEL_GIMBALS, PANEL_GRIDS, SPINES, MASTS, BULKHEADS, CRATES } = spots;
   const drawLabels = useMemo(() => labelDrawer(st), [st]);
   const labels = useCanvasTexture(1024, 1024, drawLabels);
   const hub = st.hub;
   const alarm = useRef<PointLight>(null);
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
      // Emergency: the red alarm light sweeps the station (steady when motion is reduced)
      if (alarm.current) alarm.current.intensity = reduced ? 6 : 4 + 5 * Math.max(0, Math.sin(time.now * 4));
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
      c.copy(run.modules[i].broken ? (run.docked === i ? GOOD : DOCK_LIVE) : DOCK_IDLE);
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
         {/* Station modules (GLB with deliberate code fallback). No full-screen deck:
             Earth and the starfield stay visible around this core. */}
         <Modules spots={spots} />

         {/* Radial structural struts: truss body, blue light strip, and docking collars */}
         <Instanced spots={STRUTS} name="struts-body">
            <boxGeometry args={[0.3, 0.16, 4.2]} />
            <meshStandardMaterial color={COLORS.hullDeck} metalness={0.5} roughness={0.4} />
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

         {/* Deliberate multi-tone Central Docking Hub (scaled to the layout's hub: the comms dish is wider,
             the platform's command block is a four-sided diamond) */}
         {hub && hub.sides === 16 && (
            <group scale={[hub.inradius / 1.2, hub.inradius > 1.5 ? 1.4 : 1, hub.inradius / 1.2]}>
               <mesh geometry={hubGeometries.hubHull} name="hub-hull">
                  <meshStandardMaterial color={COLORS.hullDeck} metalness={0.55} roughness={0.4} />
               </mesh>
               <mesh geometry={hubGeometries.hubTrim} name="hub-trim">
                  <meshStandardMaterial color={COLORS.panel} metalness={0.55} roughness={0.3} emissive={COLORS.panel} emissiveIntensity={0.2} />
               </mesh>
            </group>
         )}
         {/* Comms wing: the big tilted dish on its hub */}
         {st.kind === "comms" && (
            <group position={[0, 1.7, 0]} rotation={[-0.5, 0, 0]} name="comms-dish">
               <mesh>
                  <sphereGeometry args={[1.7, 24, 10, 0, Math.PI * 2, 0, 0.75]} />
                  <meshStandardMaterial color={COLORS.hullBright} metalness={0.4} roughness={0.35} side={2} />
               </mesh>
               <mesh position={[0, 1.15, 0]}>
                  <cylinderGeometry args={[0.04, 0.06, 1.1, 6]} />
                  <meshStandardMaterial color={COLORS.hullTrim} />
               </mesh>
               <mesh position={[0, 1.75, 0]}>
                  <sphereGeometry args={[0.12, 10, 8]} />
                  <meshStandardMaterial color={COLORS.warning} emissive={COLORS.warning} emissiveIntensity={1.2} />
               </mesh>
            </group>
         )}
         {hub && hub.sides === 4 && (
            <mesh position={[0, 0.45, 0]} rotation={[0, Math.PI / 4, 0]} name="command-block">
               <boxGeometry args={[hub.inradius * 2, 0.9, hub.inradius * 2]} />
               <meshStandardMaterial color={COLORS.hullDeck} metalness={0.5} roughness={0.4} emissive={COLORS.panel} emissiveIntensity={0.15} />
            </mesh>
         )}
         {/* External platform: the square deck plate under the pods, with a lit edge */}
         {st.kind === "platform" && (
            <group name="platform-deck">
               <mesh position={[0, -0.12, 0]}>
                  <boxGeometry args={[9.6, 0.12, 9.6]} />
                  <meshStandardMaterial color={COLORS.hullDeck} metalness={0.45} roughness={0.5} />
               </mesh>
               <mesh position={[0, -0.05, 0]}>
                  <boxGeometry args={[9.8, 0.03, 9.8]} />
                  <meshStandardMaterial color={COLORS.gold} emissive={COLORS.gold} emissiveIntensity={0.4} transparent opacity={0.5} />
               </mesh>
            </group>
         )}
         {st.kind === "emergency" && <pointLight ref={alarm} position={[0, 3.2, 0]} color="#ef4444" intensity={6} distance={18} decay={1.2} />}
         {/* Power wing: the long power spine with its glowing conduit */}
         <Instanced spots={SPINES} name="power-spine">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.hullDeck} metalness={0.55} roughness={0.4} />
         </Instanced>
         <Instanced spots={SPINES.map((p) => ({ ...p, y: 0.62, sy: 0.05, sz: p.sz! * 0.3 }))} name="power-conduit">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.neonBlue} emissive={COLORS.neonBlue} emissiveIntensity={1.1} />
         </Instanced>
         {/* Comms wing: antenna masts between the docks (solid: bounce off them) */}
         <Instanced spots={MASTS} name="antenna-masts">
            <cylinderGeometry args={[0.32, 0.38, 2.6, 6]} />
            <meshStandardMaterial color={COLORS.hullMid} metalness={0.5} roughness={0.4} />
         </Instanced>
         <Instanced spots={MASTS.map((p) => ({ ...p, y: 2.35 }))} name="antenna-tips">
            <sphereGeometry args={[0.16, 8, 6]} />
            <meshStandardMaterial color={COLORS.warning} emissive={COLORS.warning} emissiveIntensity={1.4} />
         </Instanced>
         {/* Emergency: sealed bulkheads with hazard stripes between the docks */}
         <Instanced spots={BULKHEADS} name="bulkheads">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.shadow} metalness={0.5} roughness={0.45} />
         </Instanced>
         <Instanced spots={BULKHEADS.map((p) => ({ ...p, y: 1.13, sy: 0.08 }))} name="bulkhead-stripes">
            <boxGeometry args={[1.02, 1, 1.02]} />
            <meshStandardMaterial color={COLORS.gold} emissive={COLORS.warning} emissiveIntensity={0.6} />
         </Instanced>
         {/* External platform: cargo crates lashed at two corners */}
         <Instanced spots={CRATES} name="cargo-crates">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#b45309" roughness={0.7} />
         </Instanced>

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
            <meshBasicMaterial transparent opacity={1} depthWrite={false} toneMapped={false} />
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
            <meshStandardMaterial map={earthMap} roughness={0.95} emissive={COLORS.earth} emissiveIntensity={0.25} />
         </mesh>
         <mesh position={[0, -25, -12]} name="planet-earth-rim">
            <sphereGeometry args={[12.15, 32, 24]} />
            <meshBasicMaterial color={COLORS.rim} transparent opacity={0.065} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
      </>
   );
}
