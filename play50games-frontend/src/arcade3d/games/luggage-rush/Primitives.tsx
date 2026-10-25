"use client";

// Stand-ins while a GLB is missing, and the chute-mouth shapes.
// Every code-made stand-in is deliberate: bevelled shapes, 2-3 tones from COLORS,
// merged into single geometries with vertex colours (1 draw call each, zero per-frame allocation).
// Chute mouths include the stainless-steel collection cowl hoods at the wall and the
// large, bright destination markers facing the camera on each chute belt.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferAttribute,
   BufferGeometry,
   DoubleSide,
   InstancedBufferAttribute,
   InstancedMesh,
   Matrix4,
   MeshBasicMaterial,
   Quaternion,
   Vector3,
} from "three";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { BELT_MARKERS, BELT_MARKER_SIZE, COLORS } from "./looks";
import { DIVERTER_AT, FLIGHTS } from "./rules";

function rgbOf(hex: string): [number, number, number] {
   const n = parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface MeshBuilder {
   positions: number[];
   colors: number[];
   normals: number[];
}

function createBuilder(): MeshBuilder {
   return { positions: [], colors: [], normals: [] };
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
   // Triangle 1: v0, v1, v2
   b.positions.push(...v0, ...v1, ...v2);
   b.normals.push(...normal, ...normal, ...normal);
   b.colors.push(...c, ...c, ...c);
   // Triangle 2: v0, v2, v3
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
   // +X (right)
   pushQuad(b, [cx + hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz + hd], [1, 0, 0], hex);
   // -X (left)
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz + hd], [cx - hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz - hd], [-1, 0, 0], hex);
   // +Y (top)
   pushQuad(b, [cx - hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd], [0, 1, 0], hex);
   // -Y (bottom)
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz + hd], [cx - hw, cy - hh, cz + hd], [0, -1, 0], hex);
   // +Z (front)
   pushQuad(b, [cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd], [0, 0, 1], hex);
   // -Z (back)
   pushQuad(b, [cx + hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz - hd], [cx - hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz - hd], [0, 0, -1], hex);
}

function buildGeometry(b: MeshBuilder): BufferGeometry {
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(new Float32Array(b.positions), 3));
   geo.setAttribute("normal", new BufferAttribute(new Float32Array(b.normals), 3));
   geo.setAttribute("color", new BufferAttribute(new Float32Array(b.colors), 3));
   return geo;
}

// ---------------- Suitcase Stand-in ----------------
function createSuitcaseGeometry(): BufferGeometry {
   const b = createBuilder();
   // Main shell: 0.48 x 0.22 x 0.68
   pushBox(b, 0, 0.12, 0, 0.48, 0.22, 0.68, COLORS.suitcase.body);
   // Outer bumper trim / edge band:
   pushBox(b, 0, 0.12, 0, 0.49, 0.23, 0.12, COLORS.suitcase.trim);
   // Corner guards (4 corners):
   const corners = [
      [-0.23, -0.32],
      [0.23, -0.32],
      [-0.23, 0.32],
      [0.23, 0.32],
   ];
   for (const [cx, cz] of corners) {
      pushBox(b, cx, 0.12, cz, 0.08, 0.23, 0.08, COLORS.suitcase.trim);
   }
   // Top handle & latches:
   pushBox(b, 0, 0.245, 0, 0.16, 0.03, 0.06, COLORS.suitcase.latch);
   pushBox(b, -0.15, 0.235, 0, 0.05, 0.02, 0.04, COLORS.suitcase.latch);
   pushBox(b, 0.15, 0.235, 0, 0.05, 0.02, 0.04, COLORS.suitcase.latch);
   return buildGeometry(b);
}

const SUITCASE_GEO = createSuitcaseGeometry();

export function SuitcasePrimitive() {
   return (
      <mesh geometry={SUITCASE_GEO} dispose={null}>
         <meshStandardMaterial vertexColors roughness={0.4} metalness={0.05} />
      </mesh>
   );
}

// ---------------- Plane Stand-in ----------------
function createPlaneGeometry(): BufferGeometry {
   const b = createBuilder();
   // Fuselage: length 3.2 m along z, centered
   pushBox(b, 0, 0.35, 0, 0.38, 0.38, 3.2, COLORS.plane.body);
   // Cockpit window visor (front at +z):
   pushBox(b, 0, 0.42, 1.3, 0.32, 0.12, 0.28, COLORS.plane.cockpit);
   // Airline blue cheatline / side stripe:
   pushBox(b, 0, 0.33, 0, 0.39, 0.06, 2.8, COLORS.plane.stripe);
   // Main swept wings: spanning x 2.8 m
   pushBox(b, 0, 0.28, 0.1, 2.8, 0.05, 0.52, COLORS.plane.wing);
   // Winglet tips:
   pushBox(b, -1.38, 0.38, 0.1, 0.04, 0.16, 0.24, COLORS.plane.stripe);
   pushBox(b, 1.38, 0.38, 0.1, 0.04, 0.16, 0.24, COLORS.plane.stripe);
   // Twin jet engines under wings:
   pushBox(b, -0.65, 0.16, 0.2, 0.18, 0.18, 0.48, COLORS.plane.wing);
   pushBox(b, 0.65, 0.16, 0.2, 0.18, 0.18, 0.48, COLORS.plane.wing);
   // Tail fin (vertical stabilizer at back -z):
   pushBox(b, 0, 0.72, -1.25, 0.06, 0.48, 0.46, COLORS.plane.stripe);
   // Horizontal tail planes:
   pushBox(b, 0, 0.48, -1.35, 1.1, 0.04, 0.32, COLORS.plane.wing);
   return buildGeometry(b);
}

const PLANE_GEO = createPlaneGeometry();

export function PlanePrimitive() {
   return (
      <mesh geometry={PLANE_GEO} dispose={null}>
         <meshStandardMaterial vertexColors roughness={0.35} metalness={0.15} />
      </mesh>
   );
}

// ---------------- Handler Stand-in ----------------
function createHandlerGeometry(): BufferGeometry {
   const b = createBuilder();
   // Boots:
   pushBox(b, -0.1, 0.06, 0.02, 0.13, 0.12, 0.22, COLORS.handler.boots);
   pushBox(b, 0.1, 0.06, 0.02, 0.13, 0.12, 0.22, COLORS.handler.boots);
   // Legs / dark pants:
   pushBox(b, -0.1, 0.36, 0, 0.14, 0.5, 0.16, COLORS.handler.pants);
   pushBox(b, 0.1, 0.36, 0, 0.14, 0.5, 0.16, COLORS.handler.pants);
   // Torso: safety vest in hi-vis orange
   pushBox(b, 0, 0.85, 0, 0.34, 0.52, 0.22, COLORS.handler.vest);
   // Reflective safety stripes (silver-white):
   pushBox(b, 0, 0.78, 0, 0.35, 0.06, 0.23, COLORS.handler.stripe);
   pushBox(b, 0, 0.95, 0, 0.35, 0.06, 0.23, COLORS.handler.stripe);
   // Head & airport crew cap:
   pushBox(b, 0, 1.25, 0, 0.22, 0.22, 0.22, COLORS.suitcase.latch);
   pushBox(b, 0, 1.35, 0.03, 0.24, 0.08, 0.26, COLORS.handler.stripe);
   return buildGeometry(b);
}

const HANDLER_GEO = createHandlerGeometry();

export function HandlerPrimitive() {
   return (
      <mesh geometry={HANDLER_GEO} dispose={null}>
         <meshStandardMaterial vertexColors roughness={0.65} />
      </mesh>
   );
}

// ---------------- Chute Mouths, Stanchions & Destination Belt Markers ----------------
const GATES = DIVERTER_AT.map((at) => ({ x: at.x + 4, y: at.y, z: at.z }));

function createChuteMouthsGeometry(gates: ReadonlyArray<{ x: number; y: number; z: number }>): BufferGeometry {
   const b = createBuilder();

   gates.forEach((gate, flight) => {
      const color = FLIGHTS[flight].color;

      // 1. Stainless-steel chute collection hood / cowl at the wall (x = 7.4):
      pushBox(b, gate.x + 0.1, gate.y + 0.38, gate.z, 0.45, 0.72, 1.15, COLORS.chuteMetal);
      pushBox(b, gate.x - 0.08, gate.y + 0.38, gate.z, 0.08, 0.76, 1.2, COLORS.chuteTrim);
      // Chute hood top sign plate:
      pushBox(b, gate.x - 0.02, gate.y + 0.78, gate.z, 0.12, 0.18, 0.85, COLORS.steelDark);
      // Gate accent indicator matching flight colour:
      pushBox(b, gate.x - 0.09, gate.y + 0.78, gate.z, 0.04, 0.14, 0.78, color);

      // 2. Heavy-duty support stanchion post anchoring the destination belt marker:
      const marker = BELT_MARKERS[flight];
      pushBox(b, marker.x, (gate.y + marker.y) / 2, marker.z, 0.06, marker.y - gate.y, 0.06, COLORS.steelFrame);
      pushBox(b, marker.x, gate.y + 0.02, marker.z, 0.18, 0.04, 0.18, COLORS.steelDark);
   });

   return buildGeometry(b);
}

const CHUTE_MOUTHS_GEO = createChuteMouthsGeometry(GATES);

const ATLAS_MAP = /* glsl */ `
#ifdef USE_MAP
   float cell = floor(vCell + 0.5);
   vec4 sampledDiffuseColor = texture2D(map, vec2((vMapUv.x + cell) * 0.25, vMapUv.y));
   diffuseColor *= sampledDiffuseColor;
#endif
`;

function bindMarkerAtlas(material: MeshBasicMaterial | null) {
   if (!material || material.userData.cellAtlas) return;
   material.userData.cellAtlas = 1;
   material.customProgramCacheKey = () => "luggage-belt-marker-atlas";
   material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
         .replace("#include <common>", "#include <common>\nattribute float cell;\nvarying float vCell;")
         .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell = cell;");
      shader.fragmentShader = shader.fragmentShader
         .replace("#include <common>", "#include <common>\nvarying float vCell;")
         .replace("#include <map_fragment>", ATLAS_MAP);
   };
   material.needsUpdate = true;
}

/**
 * Large, luminous circular destination badge with glowing white border,
 * vibrant destination flight background, and centered black destination symbol.
 * High contrast against dark belts and crystal-clear at 390x844.
 */
const drawMarkerAtlas: CanvasDraw = (ctx, width, height) => {
   const cell = width / 4;
   FLIGHTS.forEach((flight, i) => {
      const cx = i * cell + cell / 2;
      const cy = height / 2;
      const outerR = cell * 0.46;
      const innerR = cell * 0.38;
      const symR = cell * 0.22;

      // 1. Glowing pure-white outer border disc (10.4:1 contrast against belt):
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // 2. High-vibrancy destination flight color inner badge:
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = flight.color;
      ctx.fill();

      // 3. Crisp dark destination symbol matching bag tags:
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      if (flight.symbol === "circle") {
         ctx.arc(cx, cy, symR, 0, Math.PI * 2);
      } else if (flight.symbol === "square") {
         ctx.rect(cx - symR, cy - symR, symR * 2, symR * 2);
      } else if (flight.symbol === "triangle") {
         ctx.moveTo(cx, cy - symR * 1.1);
         ctx.lineTo(cx - symR * 1.0, cy + symR * 0.85);
         ctx.lineTo(cx + symR * 1.0, cy + symR * 0.85);
      } else {
         for (let p = 0; p < 10; p++) {
            const rad = p % 2 === 0 ? symR : symR * 0.42;
            const a = -Math.PI / 2 + (p * Math.PI) / 5;
            const x = cx + Math.cos(a) * rad;
            const y = cy + Math.sin(a) * rad;
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
      }
      ctx.closePath();
      ctx.fill();
   });
};

/**
 * 4 destination markers on the chute belts facing the camera.
 * Emissive / light material (MeshBasicMaterial) ensures 100% luminous visibility
 * without shadowing or darkening.
 */
export function BeltMarkers() {
   const camera = useThree((state) => state.camera);
   const mesh = useRef<InstancedMesh>(null);
   const atlas = useCanvasTexture(512, 128, drawMarkerAtlas);
   const [scratch] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      s: new Vector3(BELT_MARKER_SIZE, BELT_MARKER_SIZE, 1),
   }));

   const cell = useMemo(() => {
      const attr = new InstancedBufferAttribute(new Float32Array(4), 1);
      for (let i = 0; i < 4; i++) attr.setX(i, i);
      return attr;
   }, []);

   useLayoutEffect(() => {
      const inst = mesh.current;
      if (!inst) return;
      inst.geometry.setAttribute("cell", cell);
      cell.needsUpdate = true;
   }, [cell]);

   useFrame(() => {
      const inst = mesh.current;
      if (!inst) return;
      const { m, q, p, s } = scratch;
      q.copy(camera.quaternion);
      for (let i = 0; i < 4; i++) {
         const marker = BELT_MARKERS[i];
         p.set(marker.x, marker.y, marker.z);
         m.compose(p, q, s);
         inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
   });

   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, 4]} frustumCulled={false} name="belt-markers">
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial
            ref={bindMarkerAtlas}
            map={atlas}
            transparent
            depthWrite={false}
         />
      </instancedMesh>
   );
}

export function ChuteMouths() {
   return (
      <group name="chute-mouths">
         <mesh geometry={CHUTE_MOUTHS_GEO} dispose={null} name="chute-hoods">
            <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.4} metalness={0.2} />
         </mesh>
         <BeltMarkers />
      </group>
   );
}
