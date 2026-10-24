// Stand-ins while a GLB is missing, and the chute-mouth shapes.
// Every code-made stand-in is deliberate: bevelled shapes, 2-3 tones from COLORS,
// merged into single geometries with vertex colours (1 draw call each, zero per-frame allocation).
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import { COLORS } from "./looks";
import { DIVERTER_AT, FLIGHTS, MOUTH_M } from "./rules";

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

// ---------------- Chute Mouths & Hoppers ----------------
const GATES = DIVERTER_AT.map((at) => ({ x: at.x + 4, y: at.y, z: at.z }));

function createChuteMouthsGeometry(gates: ReadonlyArray<{ x: number; y: number; z: number }>): BufferGeometry {
   const b = createBuilder();

   gates.forEach((gate, flight) => {
      const color = FLIGHTS[flight].color;
      const r = MOUTH_M / 2;
      const cx = gate.x - 0.2;
      const cy = gate.y + 0.06;
      const cz = gate.z;

      // 1. Stainless-steel chute hood / entry cowl at the wall (x = 7.4):
      pushBox(b, gate.x + 0.1, gate.y + 0.38, gate.z, 0.45, 0.72, 1.15, COLORS.chuteMetal);
      pushBox(b, gate.x - 0.08, gate.y + 0.38, gate.z, 0.08, 0.76, 1.2, COLORS.chuteTrim);
      // Chute hood top sign plate:
      pushBox(b, gate.x - 0.02, gate.y + 0.78, gate.z, 0.12, 0.18, 0.85, COLORS.signBg);
      // Gate accent indicator matching flight colour:
      pushBox(b, gate.x - 0.09, gate.y + 0.78, gate.z, 0.04, 0.12, 0.75, color);

      // 2. Crisp flight symbols on the chute belt floor:
      const ring = (count: number, radius: number, turn = 0) => {
         const norm: [number, number, number] = [0, 1, 0];
         const col = rgbOf(color);
         for (let i = 0; i < count; i++) {
            const a0 = turn + (i / count) * Math.PI * 2;
            const a1 = turn + ((i + 1) / count) * Math.PI * 2;
            b.positions.push(cx, cy, cz);
            b.positions.push(cx + Math.cos(a0) * radius, cy, cz + Math.sin(a0) * radius);
            b.positions.push(cx + Math.cos(a1) * radius, cy, cz + Math.sin(a1) * radius);
            b.normals.push(...norm, ...norm, ...norm);
            b.colors.push(...col, ...col, ...col);
         }
      };

      if (flight === 0) {
         ring(16, r);
      } else if (flight === 1) {
         const s = r * 0.85;
         const corners: [number, number][] = [
            [-s, -s],
            [s, -s],
            [s, s],
            [-s, s],
         ];
         const norm: [number, number, number] = [0, 1, 0];
         const col = rgbOf(color);
         for (let i = 0; i < 4; i++) {
            const [x0, z0] = corners[i];
            const [x1, z1] = corners[(i + 1) % 4];
            b.positions.push(cx, cy, cz);
            b.positions.push(cx + x0, cy, cz + z0);
            b.positions.push(cx + x1, cy, cz + z1);
            b.normals.push(...norm, ...norm, ...norm);
            b.colors.push(...col, ...col, ...col);
         }
      } else if (flight === 2) {
         const tip = r;
         const base = r * 0.86;
         const norm: [number, number, number] = [0, 1, 0];
         const col = rgbOf(color);
         b.positions.push(cx - tip, cy, cz);
         b.positions.push(cx + r * 0.55, cy, cz - base);
         b.positions.push(cx + r * 0.55, cy, cz + base);
         b.normals.push(...norm, ...norm, ...norm);
         b.colors.push(...col, ...col, ...col);
      } else {
         ring(5, r, -Math.PI / 2);
      }
   });

   return buildGeometry(b);
}

const CHUTE_MOUTHS_GEO = createChuteMouthsGeometry(GATES);

export function ChuteMouths() {
   return (
      <mesh geometry={CHUTE_MOUTHS_GEO} dispose={null} name="chute-mouths">
         <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.45} metalness={0.15} />
      </mesh>
   );
}
