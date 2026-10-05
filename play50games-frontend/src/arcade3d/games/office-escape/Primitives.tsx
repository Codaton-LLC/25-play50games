"use client";

// Office Escape look: the corridor, the obstacle and coin stand-ins, the local InstancedProp and
// the stand-in runner. Office-specific decoration: a new game copies the patterns in Scene.tsx,
// not this file. Nothing here moves by itself; Scene.tsx writes every moving matrix.
//
// - Every obstacle type is a few InstancedMeshes ("parts"), each holding all copies of that type
//   on the track (capacity 24 = 8 row slots x 3 lanes). A part is one geometry + one material;
//   its pieces (a desktop, two side panels, ...) are extra instances with their own transform and
//   colour (instanceColor), so a whole desk is one or two draw calls whatever the count.
// - InstancedProp swaps the stand-in parts for the GLB's own meshes once the model is listed in
//   core/modelManifest.ts (useModel + modelParts): same slots, same matrices, no scene change.
// - The corridor is static and repeats every 12 m: Scene.tsx slides its group by
//   distance mod 12 m (a treadmill), so floor, walls, ceiling and decor never re-spawn.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
   AdditiveBlending,
   BoxGeometry,
   CapsuleGeometry,
   Color,
   CylinderGeometry,
   Euler,
   Matrix4,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   Quaternion,
   RepeatWrapping,
   SphereGeometry,
   TorusGeometry,
   Vector3,
   type BufferGeometry,
   type Group,
   type InstancedMesh,
   type Material,
} from "three";
import { modelParts, useModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LANES, OBSTACLE_TYPES, type ObstacleType } from "./rules";

// ---------- look ----------

export const COLORS = {
   fog: "#dbeafe",
   floorTile: "#d5dde8",
   floorTileAlt: "#cbd5e1",
   wood: "#e8d3ad",
   woodSeam: "#c9ad80",
   wall: "#f1f5f9",
   skirting: "#475569",
   glass: "#bfdbfe",
   glassDeep: "#93c5fd",
   mullion: "#ffffff",
   accent: "#fbbf24",
   ceiling: "#dfe6ef",
   panel: "#ffffff",
   stripe: "#ffffff",
   pillar: "#f8fafc",
   pot: "#f8fafc",
   leaf: "#22c55e",
   cabinet: "#94a3b8",
   coin: "#fbbf24",
   coinEdge: "#d97706",
   hoodie: "#f97316",
   hood: "#ea580c",
   pants: "#1e293b",
   shoes: "#f8fafc",
   skin: "#f5c9a3",
   hair: "#3f2a1d",
   band: "#14b8a6",
   pack: "#1d4ed8",
   eye: "#0f172a",
} as const;

/** The corridor (m): half-width at the walls, height, the length it covers and its repeat. */
export const CORRIDOR = {
   halfWidth: 4.6,
   height: 9.5,
   /** local z range the treadmill's meshes cover (the group slides up to `period` towards +z) */
   near: 24,
   far: -96,
   period: 12,
} as const;
const LENGTH = CORRIDOR.near - CORRIDOR.far;
const MID_Z = (CORRIDOR.near + CORRIDOR.far) / 2;
/** The lane edges (m): the outer lane centres +/- 1 m. */
const LANE_EDGE = LANES[LANES.length - 1] / 1000 + 1;
/** Decor stands outside the lanes, between the lane edge and the wall. */
const SIDE = { pillar: CORRIDOR.halfWidth - 0.25, plant: 3.95, cabinet: CORRIDOR.halfWidth - 0.32 } as const;
/** Floor texture tile along the track (m); the treadmill period is a multiple of it. */
const FLOOR_TILE = 2;

/** Copies `count` of something every `step` m along the treadmill's local z range. */
function along(step: number, offset: number, make: (z: number) => InstanceSpot[]): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let z = CORRIDOR.near - (((CORRIDOR.near - offset) % step) + step) % step; z >= CORRIDOR.far; z -= step) spots.push(...make(z));
   return spots;
}

// ---------- textures (drawn once, module-level draw functions) ----------

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // x: -halfWidth..halfWidth across the canvas, one FLOOR_TILE (2 m) of track down it
   const pxPerM = w / (CORRIDOR.halfWidth * 2);
   const u = (x: number) => (x + CORRIDOR.halfWidth) * pxPerM;
   ctx.fillStyle = COLORS.wood;
   ctx.fillRect(0, 0, w, h);
   // wood planks outside the lanes
   ctx.fillStyle = COLORS.woodSeam;
   for (let x = LANE_EDGE; x < CORRIDOR.halfWidth; x += 0.4) {
      ctx.fillRect(u(x), 0, 1.5, h);
      ctx.fillRect(u(-x), 0, 1.5, h);
   }
   ctx.fillRect(u(LANE_EDGE + 0.2), h * 0.5, u(LANE_EDGE + 0.6) - u(LANE_EDGE + 0.2), 1.5);
   ctx.fillRect(u(-LANE_EDGE - 0.6), h * 0.25, u(-LANE_EDGE - 0.2) - u(-LANE_EDGE - 0.6), 1.5);
   // carpet tiles in the lanes: 1 m squares in a soft checker, every lane one shade
   const rows = FLOOR_TILE;
   for (let lane = -LANE_EDGE; lane < LANE_EDGE - 1e-6; lane += 1) {
      for (let r = 0; r < rows; r++) {
         const odd = (Math.round(lane + LANE_EDGE) + r) % 2 === 1;
         ctx.fillStyle = odd ? COLORS.floorTileAlt : COLORS.floorTile;
         ctx.fillRect(u(lane), (r * h) / rows, pxPerM, h / rows);
      }
   }
   ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
   for (let lane = -LANE_EDGE; lane <= LANE_EDGE + 1e-6; lane += 1) ctx.fillRect(u(lane) - 0.5, 0, 1, h);
   for (let r = 0; r < rows; r++) ctx.fillRect(u(-LANE_EDGE), (r * h) / rows, u(LANE_EDGE) - u(-LANE_EDGE), 1);
}

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // x: one 12 m treadmill period, y: floor (bottom) to the ceiling (top)
   const X = (m: number) => (m * w) / CORRIDOR.period;
   const Y = (m: number) => h - (m * h) / CORRIDOR.height;
   const rect = (x0: number, y0: number, x1: number, y1: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
   };
   rect(0, 0, 12, CORRIDOR.height, COLORS.wall);
   // ground floor: glass office front (4 panes), a door, a notice board and a picture
   const glass = ctx.createLinearGradient(0, Y(3.3), 0, Y(0.15));
   glass.addColorStop(0, COLORS.glassDeep);
   glass.addColorStop(1, COLORS.glass);
   ctx.fillStyle = glass;
   ctx.fillRect(X(0.8), Y(3.3), X(5.6) - X(0.8), Y(0.15) - Y(3.3));
   ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
   for (const x of [1.2, 2.5, 3.6, 4.9]) {
      ctx.beginPath();
      ctx.moveTo(X(x), Y(3.3));
      ctx.lineTo(X(x + 0.35), Y(3.3));
      ctx.lineTo(X(x - 0.25), Y(0.15));
      ctx.lineTo(X(x - 0.6), Y(0.15));
      ctx.closePath();
      ctx.fill();
   }
   for (const x of [0.8, 2.0, 3.2, 4.4, 5.6]) rect(x - 0.04, 0.15, x + 0.04, 3.3, COLORS.mullion);
   rect(0.8, 3.26, 5.6, 3.34, COLORS.mullion);
   rect(0.8, 1.05, 5.6, 1.1, "rgba(255, 255, 255, 0.8)");
   // door with a frame, a handle and a coloured sign
   rect(6.25, 0, 7.45, 2.45, "#cbd5e1");
   rect(6.33, 0, 7.37, 2.37, "#0f766e");
   rect(7.15, 1.05, 7.25, 1.2, "#e2e8f0");
   rect(6.6, 2.65, 7.1, 2.95, COLORS.accent);
   // notice board with paper notes
   rect(8.0, 1.25, 9.9, 2.35, "#b45309");
   rect(8.06, 1.31, 9.84, 2.29, "#d6a77a");
   const notes = ["#fef08a", "#ffffff", "#bae6fd", "#fecaca", "#bbf7d0", "#ffffff"];
   notes.forEach((c, i) => rect(8.2 + (i % 3) * 0.55, 1.45 + Math.floor(i / 3) * 0.42, 8.55 + (i % 3) * 0.55, 1.75 + Math.floor(i / 3) * 0.42, c));
   // framed picture: abstract hills
   rect(10.4, 1.3, 11.6, 2.2, "#334155");
   rect(10.46, 1.36, 11.54, 2.14, "#fde68a");
   ctx.fillStyle = "#16a34a";
   ctx.beginPath();
   ctx.moveTo(X(10.46), Y(1.36));
   ctx.quadraticCurveTo(X(10.9), Y(2.0), X(11.54), Y(1.5));
   ctx.lineTo(X(11.54), Y(1.36));
   ctx.closePath();
   ctx.fill();
   // skirting, trim, accent stripe, the floor slab of the upper storey
   rect(0, 0, 12, 0.15, COLORS.skirting);
   rect(0, 3.62, 12, 3.7, "#cbd5e1");
   rect(0, 4.0, 12, 4.14, COLORS.accent);
   rect(0, 4.4, 12, 5.0, "#e2e8f0");
   rect(0, 4.4, 12, 4.48, "#94a3b8");
   // upper storey: glass railing, office windows, the cove under the ceiling
   rect(0, 5.0, 12, 6.0, "#e0f2fe");
   for (let x = 0.5; x < 12; x += 1.5) rect(x - 0.03, 5.0, x + 0.03, 6.0, "#94a3b8");
   rect(0, 5.97, 12, 6.05, "#64748b");
   const upper = ctx.createLinearGradient(0, Y(8.8), 0, Y(6.3));
   upper.addColorStop(0, "#7dd3fc");
   upper.addColorStop(1, COLORS.glass);
   ctx.fillStyle = upper;
   ctx.fillRect(X(0), Y(8.8), X(12), Y(6.3) - Y(8.8));
   for (let x = 0; x <= 12; x += 1.5) rect(x - 0.05, 6.3, x + 0.05, 8.8, COLORS.mullion);
   rect(0, 7.45, 12, 7.5, COLORS.mullion);
   rect(0, 8.8, 12, CORRIDOR.height, "#e2e8f0");
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // the bright window at the end of the corridor: a pale city behind the fog
   const sky = ctx.createLinearGradient(0, 0, 0, h);
   sky.addColorStop(0, "#f0f9ff");
   sky.addColorStop(1, COLORS.fog);
   ctx.fillStyle = sky;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "#c7dcf5";
   const towers = [0.05, 0.12, 0.2, 0.31, 0.38, 0.47, 0.58, 0.66, 0.74, 0.83, 0.9];
   towers.forEach((x, i) => {
      const top = h * (0.45 + ((i * 37) % 23) / 100);
      ctx.fillRect(x * w, top, w * (0.05 + ((i * 13) % 5) / 100), h - top);
   });
   ctx.fillStyle = "#ffffff";
   for (let x = 0; x <= w; x += w / 4) ctx.fillRect(x - 3, 0, 6, h);
   ctx.fillRect(0, h * 0.3, w, 5);
}

function drawCoinFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 4, w / 2, h / 2, w / 2);
   g.addColorStop(0, "#fef3c7");
   g.addColorStop(0.55, COLORS.coin);
   g.addColorStop(1, COLORS.coinEdge);
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "#fde68a";
   ctx.lineWidth = w * 0.05;
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
   ctx.stroke();
   // a star
   ctx.fillStyle = "#fffbeb";
   ctx.beginPath();
   for (let i = 0; i < 10; i++) {
      const r = (i % 2 === 0 ? 0.26 : 0.11) * w;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
   }
   ctx.closePath();
   ctx.fill();
}

function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255, 237, 160, 0.9)");
   g.addColorStop(0.35, "rgba(251, 191, 36, 0.35)");
   g.addColorStop(1, "rgba(251, 191, 36, 0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
}

function drawSoftRect(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // contact shadow: a soft rounded rectangle (alpha only; the material colour is dark)
   ctx.clearRect(0, 0, w, h);
   ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
   for (let i = 0; i < 6; i++) {
      const a = (i * w) / 16;
      const b = w - a;
      const r = Math.min(w * 0.22, (b - a) / 2);
      ctx.beginPath();
      ctx.moveTo(a + r, a);
      ctx.arcTo(b, a, b, b, r);
      ctx.arcTo(b, b, a, b, r);
      ctx.arcTo(a, b, a, a, r);
      ctx.arcTo(a, a, b, a, r);
      ctx.closePath();
      ctx.fill();
   }
}

// ---------- instanced props ----------

/** One InstancedMesh of a prop: a geometry, a material and the pieces drawn per copy. */
export interface PropPart {
   geometry: BufferGeometry;
   material: Material | Material[];
   /** each piece's transform inside the prop (origin = the prop's feet) */
   locals: Matrix4[];
   /** one colour per piece (instanceColor), or null for the material's own colour */
   colors: Color[] | null;
}

/** Where a prop type's meshes are, for the frame loop that writes their matrices (Scene.tsx). */
export interface PropSlot {
   parts: PropPart[];
   meshes: Array<InstancedMesh | null>;
}

export function createPropSlot(): PropSlot {
   return { parts: [], meshes: [] };
}

type Vec3 = readonly [number, number, number];
type Shape = "box" | "cylinder" | "sphere";
type Finish = "matte" | "satin" | "gloss";

/** A stand-in piece: centre, full size along x/y/z (unit geometry), optional turn, colour. */
interface PieceDef {
   at: Vec3;
   size: Vec3;
   rot?: Vec3;
   color: string;
}

interface PartDef {
   shape: Shape;
   finish: Finish;
   pieces: PieceDef[];
}

const box = (at: Vec3, size: Vec3, color: string, rot?: Vec3): PieceDef => ({ at, size, color, rot });

/** Stand-ins for the six obstacle types (README "Obstacles" drawn sizes), facing +z (the runner). */
const OBSTACLE_DEFS: Record<ObstacleType["name"], PartDef[]> = {
   // 1.6 x 0.8 x 0.6: oak desktop, white side panels, modesty panel, a closed laptop, papers, a mug
   desk: [
      {
         shape: "box",
         finish: "satin",
         pieces: [
            box([0, 0.575, 0], [1.6, 0.05, 0.8], "#d6a76c"),
            box([-0.76, 0.275, 0], [0.06, 0.55, 0.74], "#f1f5f9"),
            box([0.76, 0.275, 0], [0.06, 0.55, 0.74], "#f1f5f9"),
            box([0, 0.34, -0.22], [1.46, 0.4, 0.03], "#e2e8f0"),
            box([-0.28, 0.612, 0.06], [0.42, 0.024, 0.3], "#334155", [0, 0.12, 0]),
            box([0.18, 0.604, 0.14], [0.3, 0.008, 0.22], "#ffffff", [0, -0.25, 0]),
         ],
      },
      { shape: "cylinder", finish: "gloss", pieces: [box([0.5, 0.66, -0.12], [0.1, 0.12, 0.1], COLORS.accent)] },
   ],
   // 1.0 x 0.8 x 0.6: grey body, darker lid, paper tray and output, teal control panel
   printer: [
      {
         shape: "box",
         finish: "satin",
         pieces: [
            box([0, 0.025, 0], [0.9, 0.05, 0.68], "#64748b"),
            box([0, 0.28, 0], [0.96, 0.46, 0.74], "#e5e7eb"),
            box([0, 0.54, -0.06], [0.92, 0.07, 0.6], "#94a3b8"),
            box([0, 0.15, 0.37], [0.8, 0.13, 0.04], "#cbd5e1"),
            box([-0.05, 0.585, 0.08], [0.44, 0.02, 0.3], "#ffffff"),
            box([0.32, 0.53, 0.26], [0.26, 0.05, 0.16], "#14b8a6"),
            box([0.3, 0.557, 0.26], [0.13, 0.006, 0.08], "#0f172a"),
         ],
      },
   ],
   // 1.2 x 0.9 x 0.65: two cartons and a small one, with packing tape
   boxes: [
      {
         shape: "box",
         finish: "matte",
         pieces: [
            box([-0.3, 0.275, 0.05], [0.58, 0.55, 0.52], "#c68a4c", [0, 0.08, 0]),
            box([0.3, 0.25, -0.1], [0.56, 0.5, 0.64], "#b7793f", [0, -0.1, 0]),
            box([0.27, 0.575, -0.12], [0.36, 0.15, 0.3], "#d6a065", [0, 0.35, 0]),
            box([-0.3, 0.553, 0.05], [0.1, 0.008, 0.53], "#f3e2bd", [0, 0.08, 0]),
            box([0.3, 0.503, -0.1], [0.57, 0.008, 0.1], "#f3e2bd", [0, -0.1, 0]),
            box([-0.3, 0.3, 0.315], [0.3, 0.16, 0.006], "#f8fafc", [0, 0.08, 0]),
         ],
      },
   ],
   // 0.9 x 0.9 x 1.4: high-back office chair on a five-star base, backrest on the far side
   chair: [
      {
         shape: "box",
         finish: "satin",
         pieces: [
            box([0, 0.5, 0.03], [0.56, 0.1, 0.52], "#334155"),
            box([0, 0.98, -0.25], [0.52, 0.8, 0.09], "#334155", [-0.1, 0, 0]),
            box([0, 1.28, -0.29], [0.4, 0.2, 0.1], "#475569", [-0.1, 0, 0]),
            box([-0.31, 0.68, 0], [0.06, 0.05, 0.36], "#1e293b"),
            box([0.31, 0.68, 0], [0.06, 0.05, 0.36], "#1e293b"),
            box([-0.31, 0.6, -0.04], [0.04, 0.14, 0.04], "#1e293b"),
            box([0.31, 0.6, -0.04], [0.04, 0.14, 0.04], "#1e293b"),
            ...[0, 1, 2, 3, 4].map((i) => {
               const a = (i * 2 * Math.PI) / 5;
               return box([Math.sin(a) * 0.2, 0.07, Math.cos(a) * 0.2], [0.07, 0.05, 0.4], "#1e293b", [0, a, 0]);
            }),
         ],
      },
      {
         shape: "cylinder",
         finish: "gloss",
         pieces: [
            box([0, 0.3, 0], [0.07, 0.42, 0.07], "#94a3b8"),
            ...[0, 1, 2, 3, 4].map((i) => {
               const a = (i * 2 * Math.PI) / 5;
               return box([Math.sin(a) * 0.38, 0.035, Math.cos(a) * 0.38], [0.07, 0.06, 0.07], "#0f172a", [0, 0, Math.PI / 2]);
            }),
         ],
      },
   ],
   // 1.2 x 1.4 x 1.4: red two-shelf cart, silver urn, paper cups, chunky wheels
   coffeeCart: [
      {
         shape: "box",
         finish: "satin",
         pieces: [
            box([0, 0.88, 0], [1.15, 0.06, 1.35], "#dc2626"),
            box([0, 0.26, 0], [1.1, 0.05, 1.3], "#b91c1c"),
            ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.54, 0.57, sz * 0.63], [0.05, 0.62, 0.05], "#991b1b"))),
            box([0, 1.04, 0.68], [0.9, 0.04, 0.04], "#e5e7eb"),
            box([-0.43, 0.97, 0.68], [0.04, 0.14, 0.04], "#e5e7eb"),
            box([0.43, 0.97, 0.68], [0.04, 0.14, 0.04], "#e5e7eb"),
            box([0.2, 0.35, 0.1], [0.42, 0.13, 0.32], "#fde68a"),
            box([-0.25, 0.34, -0.25], [0.3, 0.11, 0.3], "#ffffff"),
         ],
      },
      {
         shape: "cylinder",
         finish: "gloss",
         pieces: [
            box([-0.2, 1.12, -0.15], [0.36, 0.42, 0.36], "#cbd5e1"),
            box([-0.2, 1.355, -0.15], [0.3, 0.05, 0.3], "#64748b"),
            box([-0.2, 1.4, -0.15], [0.07, 0.05, 0.07], "#0f172a"),
            box([-0.2, 0.98, 0.05], [0.05, 0.08, 0.05], "#0f172a", [Math.PI / 2, 0, 0]),
            box([0.3, 1.0, 0.25], [0.12, 0.18, 0.12], "#ffffff"),
            box([0.45, 0.98, 0.05], [0.12, 0.14, 0.12], "#fef3c7"),
            ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.5, 0.09, sz * 0.55], [0.18, 0.06, 0.18], "#111827", [0, 0, Math.PI / 2]))),
         ],
      },
   ],
   // 0.6 x 0.6 x 1.6: white body, blue bottle on top, hot and cold taps, cup holder
   waterCooler: [
      {
         shape: "box",
         finish: "satin",
         pieces: [
            box([0, 0.03, 0], [0.44, 0.06, 0.44], "#94a3b8"),
            box([0, 0.53, 0], [0.42, 0.94, 0.42], "#f8fafc"),
            box([0, 1.02, 0], [0.44, 0.04, 0.44], "#e2e8f0"),
            box([0, 0.74, 0.205], [0.26, 0.22, 0.02], "#cbd5e1"),
            box([0, 0.62, 0.23], [0.22, 0.03, 0.08], "#64748b"),
            box([-0.06, 0.78, 0.225], [0.04, 0.06, 0.05], "#3b82f6"),
            box([0.06, 0.78, 0.225], [0.04, 0.06, 0.05], "#ef4444"),
         ],
      },
      {
         shape: "cylinder",
         finish: "gloss",
         pieces: [
            box([0, 1.08, 0], [0.13, 0.08, 0.13], "#3b82f6"),
            box([0, 1.32, 0], [0.34, 0.4, 0.34], "#60a5fa"),
            box([0, 1.535, 0], [0.24, 0.05, 0.24], "#93c5fd"),
            box([0.255, 0.76, 0.06], [0.08, 0.26, 0.08], "#e2e8f0"),
         ],
      },
   ],
};

/** Drawn footprint (w, d) of each obstacle type for its contact shadow, by OBSTACLE id. */
const FOOTPRINTS: Record<ObstacleType["name"], [number, number]> = {
   desk: [1.6, 0.8],
   printer: [1.0, 0.8],
   boxes: [1.2, 0.9],
   chair: [0.9, 0.9],
   coffeeCart: [1.2, 1.4],
   waterCooler: [0.6, 0.6],
};

/** The contact shadow's transform per obstacle type (a unit soft square scaled to the footprint). */
export const SHADOW_LOCALS: readonly Matrix4[] = OBSTACLE_TYPES.map((o) => {
   const [w, d] = FOOTPRINTS[o.name];
   return new Matrix4().makeScale(w * 1.25, 1, d * 1.3);
});

const scratch = { q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() };

function pieceMatrix(piece: PieceDef): Matrix4 {
   const [rx, ry, rz] = piece.rot ?? [0, 0, 0];
   scratch.q.setFromEuler(scratch.e.set(rx, ry, rz));
   return new Matrix4().compose(scratch.p.set(...piece.at), scratch.q, scratch.s.set(...piece.size));
}

function finishMaterial(finish: Finish): MeshStandardMaterial {
   switch (finish) {
      case "gloss":
         return new MeshStandardMaterial({ color: "#ffffff", roughness: 0.25, metalness: 0.15 });
      case "matte":
         return new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
      case "satin":
      default:
         return new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 });
   }
}

export interface StandIns {
   /** stand-in parts per OBSTACLE id */
   obstacles: PropPart[][];
   coin: PropPart[];
   glow: PropPart[];
   shadow: PropPart[];
}

/**
 * Geometries and materials of every stand-in, made once per run (the Scene mounts per run) and
 * disposed with it. Unit shapes are shared by all props: one box, one cylinder, one sphere.
 */
export function useStandIns(): StandIns {
   const coinFace = useCanvasTexture(128, 128, drawCoinFace);
   const glowMap = useCanvasTexture(64, 64, drawGlow);
   const softRect = useCanvasTexture(64, 64, drawSoftRect);
   const kit = useMemo(() => {
      const shapes: Record<Shape, BufferGeometry> = {
         box: new BoxGeometry(1, 1, 1),
         cylinder: new CylinderGeometry(0.5, 0.5, 1, 14),
         sphere: new SphereGeometry(0.5, 14, 10),
      };
      const owned: Array<{ dispose(): void }> = Object.values(shapes);
      const build = (def: PartDef): PropPart => {
         const material = finishMaterial(def.finish);
         owned.push(material);
         return { geometry: shapes[def.shape], material, locals: def.pieces.map(pieceMatrix), colors: def.pieces.map((p) => new Color(p.color)) };
      };
      const obstacles = OBSTACLE_TYPES.map((o) => OBSTACLE_DEFS[o.name].map(build));

      // coin: a gold disc standing up (axis along z), star on both faces
      const coinGeo = new CylinderGeometry(0.3, 0.3, 0.07, 24);
      coinGeo.rotateX(Math.PI / 2);
      const edge = new MeshStandardMaterial({ color: COLORS.coinEdge, roughness: 0.3, metalness: 0.6, emissive: "#b45309", emissiveIntensity: 0.25 });
      const face = new MeshStandardMaterial({ map: coinFace, roughness: 0.3, metalness: 0.45, emissive: "#f59e0b", emissiveIntensity: 0.3 });
      // CylinderGeometry groups: 0 = side, 1 = top, 2 = bottom
      const coin: PropPart = { geometry: coinGeo, material: [edge, face, face], locals: [new Matrix4()], colors: null };

      const glowGeo = new PlaneGeometry(1, 1);
      const glowMat = new MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
      const glow: PropPart = { geometry: glowGeo, material: glowMat, locals: [new Matrix4()], colors: null };

      const shadowGeo = new PlaneGeometry(1, 1);
      shadowGeo.rotateX(-Math.PI / 2);
      shadowGeo.translate(0, 0.012, 0);
      const shadowMat = new MeshBasicMaterial({ color: "#0f172a", alphaMap: softRect, transparent: true, opacity: 0.45, depthWrite: false });
      const shadow: PropPart = { geometry: shadowGeo, material: shadowMat, locals: [new Matrix4()], colors: null };

      owned.push(coinGeo, edge, face, glowGeo, glowMat, shadowGeo, shadowMat);
      return { standIns: { obstacles, coin: [coin], glow: [glow], shadow: [shadow] }, owned };
   }, [coinFace, glowMap, softRect]);
   useEffect(() => () => kit.owned.forEach((item) => item.dispose()), [kit]);
   return kit.standIns;
}

function PartMesh({ part, capacity, index, slot }: { part: PropPart; capacity: number; index: number; slot: PropSlot }) {
   const ref = useRef<InstancedMesh>(null);
   const n = part.locals.length;
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      mesh.count = 0;
      if (part.colors) {
         for (let k = 0; k < capacity; k++) for (let j = 0; j < n; j++) mesh.setColorAt(k * n + j, part.colors[j]);
         if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      slot.meshes[index] = mesh;
      return () => {
         if (slot.meshes[index] === mesh) slot.meshes[index] = null;
      };
   }, [part, capacity, n, index, slot]);
   // dispose={null}: stand-in parts belong to useStandIns, GLB parts to the loader cache
   return <instancedMesh ref={ref} args={[part.geometry, part.material, capacity * n]} frustumCulled={false} dispose={null} />;
}

/** Draws `parts` as InstancedMeshes (`capacity` copies each) and publishes them in `slot`. */
export function PropMeshes({ parts, capacity, slot }: { parts: PropPart[]; capacity: number; slot: PropSlot }) {
   useLayoutEffect(() => {
      slot.parts = parts;
      slot.meshes.length = parts.length;
   }, [parts, slot]);
   return (
      <>
         {parts.map((part, i) => (
            <PartMesh key={i} part={part} capacity={capacity} index={i} slot={slot} />
         ))}
      </>
   );
}

/**
 * A prop type that may become a GLB (README "InstancedProp"): once `asset` is listed in
 * core/modelManifest.ts, every mesh of the GLB becomes one InstancedMesh (core modelParts: the
 * asset's scale / rotationY / yOffset are folded into its piece matrix); until then the stand-in
 * parts. Suspends while a listed GLB loads.
 */
export function InstancedProp({ asset, fallback, capacity, slot }: { asset: ModelAsset; fallback: PropPart[]; capacity: number; slot: PropSlot }) {
   const { scene } = useModel(asset);
   const parts = useMemo<PropPart[] | null>(() => {
      if (!scene) return null;
      const found = modelParts(scene, asset);
      return found.length > 0 ? found.map((p) => ({ geometry: p.geometry, material: p.material, locals: [p.matrix], colors: null })) : null;
   }, [scene, asset]);
   return <PropMeshes parts={parts ?? fallback} capacity={capacity} slot={slot} />;
}

// ---------- the corridor (static; Scene.tsx slides it) ----------

const STRIPE_SPOTS: InstanceSpot[] = [
   // lane dividers: 1.4 m dashes every 3 m
   ...along(3, 0, (z) => [-1, 1].map((x) => ({ x, y: 0.004, z, sx: 0.09, sy: 0.006, sz: 1.4 }))),
   // solid lane edges
   ...[-LANE_EDGE, LANE_EDGE].map((x) => ({ x, y: 0.004, z: MID_Z, sx: 0.12, sy: 0.006, sz: LENGTH })),
];
const PANEL_SPOTS = along(4, 0, (z) => [-1.8, 1.8].map((x) => ({ x, y: CORRIDOR.height - 0.04, z, sx: 2.6, sy: 0.06, sz: 1.1 })));
const PILLAR_SPOTS = along(CORRIDOR.period, 0, (z) =>
   [-SIDE.pillar, SIDE.pillar].map((x) => ({ x, y: CORRIDOR.height / 2, z, sx: 0.5, sy: CORRIDOR.height, sz: 0.62 }))
);
const PILLAR_BAND_SPOTS = along(CORRIDOR.period, 0, (z) =>
   [-SIDE.pillar, SIDE.pillar].flatMap((x) => [
      { x, y: 1.0, z, sx: 0.54, sy: 0.14, sz: 0.66 },
      { x, y: 4.07, z, sx: 0.54, sy: 0.14, sz: 0.66 },
   ])
);
const POT_SPOTS = along(CORRIDOR.period, -6, (z) => [-SIDE.plant, SIDE.plant].map((x) => ({ x, y: 0.24, z, sx: 0.46, sy: 0.48, sz: 0.46 })));
const LEAF_SPOTS = along(CORRIDOR.period, -6, (z) =>
   [-SIDE.plant, SIDE.plant].flatMap((x, i) => [
      { x, y: 0.82, z, scale: 0.78, rotY: i },
      { x: x + 0.08, y: 1.2, z: z - 0.05, scale: 0.5, rotY: i + 1 },
   ])
);
const CABINET_SPOTS = [
   ...along(CORRIDOR.period, -3, (z) => [{ x: -SIDE.cabinet, y: 0.55, z, sx: 0.5, sy: 1.1, sz: 0.62 }]),
   ...along(CORRIDOR.period, -9, (z) => [{ x: SIDE.cabinet, y: 0.55, z, sx: 0.5, sy: 1.1, sz: 0.62 }]),
];

/**
 * Floor, walls, ceiling and decor: one 12 m pattern laid out over the covered range. Static; the
 * Scene slides its parent group. `stripes` gets the lane-stripe material (it flashes on a
 * speed-up), `ceiling` the ceiling group (hidden under a camera fitted above it).
 */
export function OfficeCorridor({ stripes, ceiling }: { stripes: RefObject<MeshBasicMaterial>; ceiling: RefObject<Group> }) {
   const floorMap = useCanvasTexture(512, 128, drawFloor);
   const wallMap = useCanvasTexture(1024, 810, drawWall);
   useLayoutEffect(() => {
      floorMap.wrapT = RepeatWrapping;
      floorMap.repeat.set(1, LENGTH / FLOOR_TILE);
      floorMap.needsUpdate = true;
      wallMap.wrapS = RepeatWrapping;
      wallMap.repeat.set(LENGTH / CORRIDOR.period, 1);
      wallMap.needsUpdate = true;
   }, [floorMap, wallMap]);

   return (
      <group name="corridor">
         <mesh rotation-x={-Math.PI / 2} position-z={MID_Z}>
            <planeGeometry args={[CORRIDOR.halfWidth * 2, LENGTH]} />
            <meshLambertMaterial map={floorMap} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * CORRIDOR.halfWidth, CORRIDOR.height / 2, MID_Z]} rotation-y={(-side * Math.PI) / 2}>
               <planeGeometry args={[LENGTH, CORRIDOR.height]} />
               <meshLambertMaterial map={wallMap} />
            </mesh>
         ))}
         <group ref={ceiling} name="ceiling">
            <mesh rotation-x={Math.PI / 2} position={[0, CORRIDOR.height, MID_Z]}>
               <planeGeometry args={[CORRIDOR.halfWidth * 2, LENGTH]} />
               <meshBasicMaterial color={COLORS.ceiling} />
            </mesh>
            <Instanced spots={PANEL_SPOTS} name="ceiling-panels">
               <boxGeometry />
               <meshBasicMaterial color={COLORS.panel} />
            </Instanced>
         </group>
         <Instanced spots={STRIPE_SPOTS} name="lane-stripes">
            <boxGeometry />
            <meshBasicMaterial ref={stripes} color={COLORS.stripe} />
         </Instanced>
         <Instanced spots={PILLAR_SPOTS}>
            <boxGeometry />
            <meshLambertMaterial color={COLORS.pillar} />
         </Instanced>
         <Instanced spots={PILLAR_BAND_SPOTS}>
            <boxGeometry />
            <meshLambertMaterial color={COLORS.accent} />
         </Instanced>
         <Instanced spots={POT_SPOTS}>
            <cylinderGeometry args={[0.5, 0.4, 1, 12]} />
            <meshLambertMaterial color={COLORS.pot} />
         </Instanced>
         <Instanced spots={LEAF_SPOTS}>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshLambertMaterial color={COLORS.leaf} flatShading />
         </Instanced>
         <Instanced spots={CABINET_SPOTS}>
            <boxGeometry />
            <meshLambertMaterial color={COLORS.cabinet} />
         </Instanced>
      </group>
   );
}

/** The window at the far end of the corridor (outside the treadmill, unaffected by the fog). */
export function Backdrop() {
   const map = useCanvasTexture(512, 512, drawBackdrop);
   return (
      <mesh position={[0, CORRIDOR.height / 2, CORRIDOR.far + 4]} name="backdrop">
         <planeGeometry args={[CORRIDOR.halfWidth * 2 + 0.2, CORRIDOR.height + 0.2]} />
         <meshBasicMaterial map={map} fog={false} />
      </mesh>
   );
}

// ---------- the stand-in runner ----------

/** The joints Scene.tsx swings (null with a GLB: only the whole-body effects apply then). */
export interface RunnerRig {
   hipL: Group | null;
   hipR: Group | null;
   kneeL: Group | null;
   kneeR: Group | null;
   shoulderL: Group | null;
   shoulderR: Group | null;
   elbowL: Group | null;
   elbowR: Group | null;
   head: Group | null;
   tails: Group | null;
}

export function createRunnerRig(): RunnerRig {
   return { hipL: null, hipR: null, kneeL: null, kneeR: null, shoulderL: null, shoulderR: null, elbowL: null, elbowR: null, head: null, tails: null };
}

function useRunnerParts() {
   const parts = useMemo(() => {
      const mat = (color: string, roughness = 0.6) => new MeshStandardMaterial({ color, roughness });
      const hair = new SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
      return {
         thigh: new CapsuleGeometry(0.085, 0.2, 4, 10),
         shin: new CapsuleGeometry(0.07, 0.19, 4, 10),
         shoe: new BoxGeometry(0.15, 0.1, 0.27),
         torso: new CapsuleGeometry(0.2, 0.26, 6, 14),
         hood: new SphereGeometry(0.15, 14, 10),
         pack: new BoxGeometry(0.3, 0.34, 0.14),
         upperArm: new CapsuleGeometry(0.065, 0.13, 4, 10),
         forearm: new CapsuleGeometry(0.058, 0.1, 4, 10),
         hand: new SphereGeometry(0.065, 10, 8),
         head: new SphereGeometry(0.2, 20, 14),
         hair,
         band: new TorusGeometry(0.205, 0.026, 8, 24),
         tail: new BoxGeometry(0.05, 0.015, 0.2),
         eye: new SphereGeometry(0.028, 8, 6),
         hoodie: mat(COLORS.hoodie, 0.7),
         hoodDark: mat(COLORS.hood, 0.75),
         pants: mat(COLORS.pants, 0.8),
         shoes: mat(COLORS.shoes, 0.45),
         skin: mat(COLORS.skin, 0.5),
         hairMat: mat(COLORS.hair, 0.65),
         bandMat: mat(COLORS.band, 0.5),
         packMat: mat(COLORS.pack, 0.55),
         eyeMat: mat(COLORS.eye, 0.3),
      };
   }, []);
   useEffect(() => () => Object.values(parts).forEach((part) => part.dispose()), [parts]);
   return parts;
}

/**
 * The Play50 Runner until runner.glb exists: an orange-hoodie vinyl toy about 1.55 m tall, its
 * feet at the origin, running towards -z (the camera sees its back). Scene.tsx swings the joints.
 */
export function RunnerPrimitive({ rig }: { rig: RunnerRig }) {
   const p = useRunnerParts();
   const leg = (side: -1 | 1) => (
      <group
         ref={(g) => {
            if (side < 0) rig.hipL = g;
            else rig.hipR = g;
         }}
         position={[side * 0.1, 0.74, 0]}
      >
         <mesh geometry={p.thigh} material={p.pants} position-y={-0.17} />
         <group
            ref={(g) => {
               if (side < 0) rig.kneeL = g;
               else rig.kneeR = g;
            }}
            position-y={-0.34}
         >
            <mesh geometry={p.shin} material={p.pants} position-y={-0.15} />
            <mesh geometry={p.shoe} material={p.shoes} position={[0, -0.33, -0.05]} />
         </group>
      </group>
   );
   const arm = (side: -1 | 1) => (
      <group
         ref={(g) => {
            if (side < 0) rig.shoulderL = g;
            else rig.shoulderR = g;
         }}
         position={[side * 0.26, 1.2, 0]}
      >
         <mesh geometry={p.upperArm} material={p.hoodie} position-y={-0.12} />
         <group
            ref={(g) => {
               if (side < 0) rig.elbowL = g;
               else rig.elbowR = g;
            }}
            position-y={-0.24}
         >
            <mesh geometry={p.forearm} material={p.hoodie} position-y={-0.1} />
            <mesh geometry={p.hand} material={p.skin} position-y={-0.21} />
         </group>
      </group>
   );
   return (
      <group name="runner-primitive">
         {leg(-1)}
         {leg(1)}
         <mesh geometry={p.torso} material={p.hoodie} position-y={0.99} />
         <mesh geometry={p.hood} material={p.hoodDark} position={[0, 1.24, 0.14]} scale={[1.1, 0.7, 0.75]} />
         <mesh geometry={p.pack} material={p.packMat} position={[0, 1.02, 0.2]} />
         {arm(-1)}
         {arm(1)}
         <group
            ref={(g) => {
               rig.head = g;
            }}
            position-y={1.35}
         >
            <mesh geometry={p.head} material={p.skin} />
            <mesh geometry={p.hair} material={p.hairMat} position={[0, 0.01, 0.015]} rotation-x={0.45} />
            <mesh geometry={p.band} material={p.bandMat} position-y={0.06} rotation-x={Math.PI / 2 + 0.12} />
            {[-1, 1].map((side) => (
               <mesh key={side} geometry={p.eye} material={p.eyeMat} position={[side * 0.075, 0.0, -0.188]} />
            ))}
            <group
               ref={(g) => {
                  rig.tails = g;
               }}
               position={[0, 0.07, 0.2]}
            >
               {[-1, 1].map((side) => (
                  <mesh key={side} geometry={p.tail} material={p.bandMat} position={[side * 0.04, 0, 0.09]} rotation-y={side * 0.25} />
               ))}
            </group>
         </group>
      </group>
   );
}
