// Belts, conveyor steel chassis frames, chute mouths, and the four diverter arrows.
// The spine is one Conveyor (2 draw calls), chutes are 4 Conveyors (8 calls), overflow is 1 Conveyor (2 calls).
// Side steel channels, rubber bumper guards, and support legs are merged into 1 static mesh (1 draw call).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { Conveyor } from "@/arcade3d/core/kit";
import { ChuteMouths } from "./Primitives";
import { COLORS } from "./looks";
import { CHUTE_PATHS, DIVERTER_AT, OVERFLOW_PATH, SPINE_PATH, type RunState } from "./rules";

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

/** Merged steel conveyor frames, side guide rails, rubber bumper skirts and stanchion legs. */
function createConveyorFramesGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   const X = 3.4;
   const Y = 0.45;
   const halfW = 0.48;

   // 1. Spine left outer rail (continuous from z=0 to z=14.2)
   pushBox(b, X - halfW - 0.03, Y + 0.05, 7.1, 0.06, 0.14, 14.2, COLORS.steelFrame);
   pushBox(b, X - halfW - 0.03, Y + 0.12, 7.1, 0.07, 0.04, 14.2, COLORS.rubberBumper);
   // Spine under-chassis beam:
   pushBox(b, X, Y - 0.06, 7.1, 0.94, 0.08, 14.2, COLORS.steelDark);

   // Support legs under the spine every ~2.8 m:
   for (let z = 0.6; z <= 14.0; z += 2.8) {
      pushBox(b, X - halfW - 0.02, Y / 2, z, 0.06, Y, 0.06, COLORS.steelLeg);
      pushBox(b, X + halfW + 0.02, Y / 2, z, 0.06, Y, 0.06, COLORS.steelLeg);
   }

   // 2. Chutes: along +x from X to 7.4 at Z1, Z2, Z3, Z4
   const gatesZ = [4.4, 8.0, 11.2, 14.2];
   for (const z of gatesZ) {
      const chuteLen = 4.0;
      const chuteMidX = X + chuteLen / 2;
      // Front rail (z - halfW) and back rail (z + halfW):
      pushBox(b, chuteMidX, Y + 0.05, z - halfW - 0.03, chuteLen, 0.14, 0.06, COLORS.steelFrame);
      pushBox(b, chuteMidX, Y + 0.12, z - halfW - 0.03, chuteLen, 0.04, 0.07, COLORS.rubberBumper);
      pushBox(b, chuteMidX, Y + 0.05, z + halfW + 0.03, chuteLen, 0.14, 0.06, COLORS.steelFrame);
      pushBox(b, chuteMidX, Y + 0.12, z + halfW + 0.03, chuteLen, 0.04, 0.07, COLORS.rubberBumper);
      // Chute under-chassis:
      pushBox(b, chuteMidX, Y - 0.06, z, chuteLen, 0.08, 0.94, COLORS.steelDark);

      // Support legs under chutes:
      for (const lx of [X + 1.4, X + 2.8, 7.2]) {
         pushBox(b, lx, Y / 2, z - halfW - 0.02, 0.06, Y, 0.06, COLORS.steelLeg);
         pushBox(b, lx, Y / 2, z + halfW + 0.02, 0.06, Y, 0.06, COLORS.steelLeg);
      }
   }

   // 3. Overflow conveyor: along -x from X to 0.6 at Z4 (14.2)
   const ofLen = 2.8;
   const ofMidX = X - ofLen / 2;
   const ofZ = 14.2;
   pushBox(b, ofMidX, Y + 0.05, ofZ - halfW - 0.03, ofLen, 0.14, 0.06, COLORS.steelFrame);
   pushBox(b, ofMidX, Y + 0.12, ofZ - halfW - 0.03, ofLen, 0.04, 0.07, COLORS.rubberBumper);
   pushBox(b, ofMidX, Y + 0.05, ofZ + halfW + 0.03, ofLen, 0.14, 0.06, COLORS.steelFrame);
   pushBox(b, ofMidX, Y + 0.12, ofZ + halfW + 0.03, ofLen, 0.04, 0.07, COLORS.rubberBumper);
   pushBox(b, ofMidX, Y - 0.06, ofZ, ofLen, 0.08, 0.94, COLORS.steelDark);
   for (const lx of [X - 1.2, 0.8]) {
      pushBox(b, lx, Y / 2, ofZ - halfW - 0.02, 0.06, Y, 0.06, COLORS.steelLeg);
      pushBox(b, lx, Y / 2, ofZ + halfW + 0.02, 0.06, Y, 0.06, COLORS.steelLeg);
   }

   return buildGeometry(b);
}

const FRAMES_GEO = createConveyorFramesGeometry();

export function Belts({ run }: { run: RunState }) {
   return (
      <group name="belts">
         {/* Moving conveyor belts with chevron slats */}
         <Conveyor path={SPINE_PATH} width={0.92} speed={run.config.beltBase} color={COLORS.beltSlat} stripe="#94a3b8" />
         {CHUTE_PATHS.map((path, i) => (
            <Conveyor key={i} path={path} width={0.92} speed={run.config.beltBase} color={COLORS.beltSlat} stripe="#94a3b8" />
         ))}
         <Conveyor path={OVERFLOW_PATH} width={0.92} speed={run.config.beltBase} color="#7f1d1d" stripe="#fecaca" />

         {/* Static steel frames, guide rails & support legs (1 draw call) */}
         <mesh geometry={FRAMES_GEO} dispose={null} name="conveyor-frames">
            <meshStandardMaterial vertexColors roughness={0.4} metalness={0.2} />
         </mesh>

         <ChuteMouths />
         <Arrows run={run} />
      </group>
   );
}

/** Diverter arrow geometry: a circular steel turntable base plate with a 3D bevelled direction pointer */
function createDiverterGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   // Turntable circular base puck:
   const radius = 0.28;
   const segments = 16;
   const cBase = rgbOf(COLORS.diverterBase);
   const cPuck = rgbOf(COLORS.diverterPuck);
   const normUp: [number, number, number] = [0, 1, 0];

   for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      b.positions.push(0, 0, 0);
      b.positions.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius);
      b.positions.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
      b.normals.push(...normUp, ...normUp, ...normUp);
      b.colors.push(...cBase, ...cBase, ...cBase);

      b.positions.push(0, 0.04, 0);
      b.positions.push(Math.cos(a0) * (radius * 0.8), 0.04, Math.sin(a0) * (radius * 0.8));
      b.positions.push(Math.cos(a1) * (radius * 0.8), 0.04, Math.sin(a1) * (radius * 0.8));
      b.normals.push(...normUp, ...normUp, ...normUp);
      b.colors.push(...cPuck, ...cPuck, ...cPuck);
   }

   // 3D Direction Chevron Arm pointing along -Z (local forward):
   // Shaft:
   pushBox(b, 0, 0.07, 0.08, 0.12, 0.06, 0.24, COLORS.diverterArrow);
   // Chevron head pointing along -Z:
   const normHead: [number, number, number] = [0, 1, 0];
   const cArrow = rgbOf(COLORS.diverterArrow);
   const cGlow = rgbOf(COLORS.diverterGlow);
   // Pointer tip at [0, 0.07, -0.22], wings at [-0.16, 0.07, -0.02], [0.16, 0.07, -0.02]
   b.positions.push(0, 0.08, -0.22);
   b.positions.push(-0.16, 0.08, -0.02);
   b.positions.push(0.16, 0.08, -0.02);
   b.normals.push(...normHead, ...normHead, ...normHead);
   b.colors.push(...cGlow, ...cGlow, ...cGlow);

   // Side bevels of arrow head:
   pushQuad(b, [0, 0.04, -0.22], [0.16, 0.04, -0.02], [0.16, 0.08, -0.02], [0, 0.08, -0.22], [1, 0, -1], COLORS.diverterArrow);
   pushQuad(b, [-0.16, 0.04, -0.02], [0, 0.04, -0.22], [0, 0.08, -0.22], [-0.16, 0.08, -0.02], [-1, 0, -1], COLORS.diverterArrow);

   return buildGeometry(b);
}

const ARROW_GEO = createDiverterGeometry();

function Arrows({ run }: { run: RunState }) {
   const mesh = useRef<InstancedMesh>(null);
   const [scratch] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      up: new Vector3(0, 1, 0),
      scale: new Vector3(1, 1, 1),
   }));

   useFrame(() => {
      const inst = mesh.current;
      if (!inst) return;
      const { m, q, p, up, scale } = scratch;
      for (let i = 0; i < 4; i++) {
         const at = DIVERTER_AT[i];
         // choice 0 points down a chute (+x); choice 1 continues along spine (+z), D4 choice 1 is overflow (-x)
         // Our arrow mesh points along -Z locally.
         // To point +X: turn -PI/2
         // To point +Z: turn PI
         // To point -X: turn +PI/2
         let yaw = 0;
         if (run.choices[i] === 0) {
            yaw = -Math.PI / 2; // points +x
         } else if (i === 3) {
            yaw = Math.PI / 2; // points -x
         } else {
            yaw = Math.PI; // points +z
         }

         q.setFromAxisAngle(up, yaw);
         p.set(at.x, at.y + 0.52, at.z);
         m.compose(p, q, scale);
         inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
   });

   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, 4]} name="diverter-arrows">
         <primitive object={ARROW_GEO} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.35} metalness={0.2} />
      </instancedMesh>
   );
}
