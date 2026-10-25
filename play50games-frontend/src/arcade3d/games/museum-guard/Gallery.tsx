"use client";

// The round gallery at night: panelled plum walls with gold trim, a polished dark floor, a coffered
// ceiling with a moonlit skylight, framed paintings (one merged mesh on a canvas atlas), warm
// sconces and picture lights (fixtures + additive wall washes), brass-and-velvet barrier.
// Every texture is drawn once on a canvas (core useCanvasTexture); static pieces are merged or
// instanced, so the room is 12 draw calls (README "Performance").
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BackSide,
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   CatmullRomCurve3,
   Color,
   CylinderGeometry,
   PlaneGeometry,
   RepeatWrapping,
   SphereGeometry,
   TubeGeometry,
   Vector3,
   type CanvasTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model, InstancedModel } from "@/arcade3d/core/assets";
import { PEDESTAL_TOP } from "@/arcade3d/core/kit";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";
import { BARRIER, barrierPostAngle, barrierRope, COLORS } from "./looks";
import { BenchFallback } from "./Primitives";
import { EXITS, makePedestal, RING } from "./rules";

const WALL_R = 7.9;
const WALL_H = 4.4;
const WALL_TILES = 16;

const PEDESTAL_SPOTS: InstanceSpot[] = Array.from({ length: RING.count }, (_, i) => {
   const ped = makePedestal(i);
   return { x: ped.x, y: 0, z: ped.z, rotY: ped.angle };
});

const PAINT_ANGLES = [0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
/** Sconces sit on the wall behind each pedestal (between the paintings and the doors). */
const SCONCE_ANGLES = Array.from({ length: RING.count }, (_, i) => ((i + 0.5) * Math.PI) / 4);
const PAINT_W = 1.05;
const PAINT_H = 0.8;
const PAINT_Y = 1.78;
const PAINT_R = 7.78;
const SCONCE_Y = 2.55;

const VASES: InstanceSpot[] = [0, Math.PI / 4, Math.PI, (5 * Math.PI) / 4].map((angle) => ({
   x: Math.sin(angle) * 6.65,
   y: 0,
   z: Math.cos(angle) * 6.65,
}));

const DOOR_R = 7.35;
export const DOOR_SPOTS: InstanceSpot[] = [EXITS.pos, EXITS.neg].map((angle) => ({
   x: Math.sin(angle) * DOOR_R,
   y: 0,
   z: Math.cos(angle) * DOOR_R,
   rotY: angle + Math.PI,
}));

const DOOR_FALLBACK: InstanceSpot[] = DOOR_SPOTS.map((spot) => ({ ...spot, y: 1.05 }));

const POST_SPOTS: InstanceSpot[] = Array.from({ length: BARRIER.posts }, (_, i) => {
   const a = barrierPostAngle(i);
   return { x: Math.sin(a) * BARRIER.radius, y: 0, z: Math.cos(a) * BARRIER.radius };
});

const MOTES = 40;

// ---------- canvas textures (module level, so the hook draws each once) ----------

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
   // canvas top = top of the wall (y 4.4 m), 1 m = h / 4.4 px
   const m = h / WALL_H;
   const y = (metres: number) => h - metres * m;
   const grad = ctx.createLinearGradient(0, 0, 0, h);
   grad.addColorStop(0, COLORS.wallTop);
   grad.addColorStop(0.35, COLORS.wallMid);
   grad.addColorStop(0.75, COLORS.wallMid);
   grad.addColorStop(1, COLORS.wallLow);
   ctx.fillStyle = grad;
   ctx.fillRect(0, 0, w, h);
   // upper panel (behind a painting or a sconce) and lower wainscot panel, inset lines
   ctx.strokeStyle = COLORS.wallPanel;
   ctx.lineWidth = 3;
   ctx.strokeRect(w * 0.12, y(3.75), w * 0.76, (3.75 - 1.15) * m);
   ctx.strokeStyle = "rgba(205, 190, 255, 0.05)";
   ctx.lineWidth = 2;
   ctx.strokeRect(w * 0.15, y(3.65), w * 0.7, (3.65 - 1.25) * m);
   ctx.strokeStyle = "rgba(205, 190, 255, 0.08)";
   ctx.lineWidth = 3;
   ctx.strokeRect(w * 0.12, y(0.9), w * 0.76, (0.9 - 0.24) * m);
   // wainscot darker below the dado rail
   ctx.fillStyle = "rgba(4, 3, 12, 0.28)";
   ctx.fillRect(0, y(1.0), w, 1.0 * m);
   // gold dado rail, skirting and cornice
   const gold = (top: number, thick: number) => {
      const g = ctx.createLinearGradient(0, y(top), 0, y(top - thick));
      g.addColorStop(0, "#f3d58a");
      g.addColorStop(0.5, COLORS.trim);
      g.addColorStop(1, COLORS.trimDark);
      ctx.fillStyle = g;
      ctx.fillRect(0, y(top), w, thick * m);
   };
   gold(1.04, 0.04);
   ctx.fillStyle = "#07060f";
   ctx.fillRect(0, y(0.16), w, 0.16 * m);
   gold(0.2, 0.035);
   ctx.fillStyle = "#0a0816";
   ctx.fillRect(0, 0, w, 0.32 * m);
   gold(4.1, 0.05);
   // pilasters at the tile edges
   const pil = ctx.createLinearGradient(0, 0, w * 0.05, 0);
   pil.addColorStop(0, "rgba(0, 0, 0, 0.35)");
   pil.addColorStop(1, "rgba(0, 0, 0, 0)");
   ctx.fillStyle = pil;
   ctx.fillRect(0, y(4.05), w * 0.05, 3.85 * m);
   const pilR = ctx.createLinearGradient(w, 0, w * 0.95, 0);
   pilR.addColorStop(0, "rgba(0, 0, 0, 0.35)");
   pilR.addColorStop(1, "rgba(0, 0, 0, 0)");
   ctx.fillStyle = pilR;
   ctx.fillRect(w * 0.95, y(4.05), w * 0.05, 3.85 * m);
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cx = w / 2;
   const cy = h / 2;
   const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
   base.addColorStop(0, COLORS.floorCore);
   base.addColorStop(0.45, COLORS.floorMid);
   base.addColorStop(1, COLORS.floorEdge);
   ctx.fillStyle = base;
   ctx.fillRect(0, 0, w, h);
   // marble slabs: concentric courses cut by radial joints
   ctx.strokeStyle = "rgba(190, 175, 255, 0.07)";
   ctx.lineWidth = 2;
   for (let k = 1; k <= 7; k += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (w * 0.5 * k) / 7.5, 0, Math.PI * 2);
      ctx.stroke();
   }
   for (let k = 0; k < 32; k += 1) {
      const a = (k / 32) * Math.PI * 2;
      const r0 = w * 0.5 * (k % 2 === 0 ? 0.14 : 0.28);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.5);
      ctx.stroke();
   }
   // polished sheen: a soft lighter band around the room
   const sheen = ctx.createRadialGradient(cx, cy, w * 0.18, cx, cy, w * 0.48);
   sheen.addColorStop(0, "rgba(160, 140, 255, 0)");
   sheen.addColorStop(0.55, "rgba(160, 140, 255, 0.10)");
   sheen.addColorStop(1, "rgba(160, 140, 255, 0)");
   ctx.fillStyle = sheen;
   ctx.fillRect(0, 0, w, h);
   // gold inlay rings: the guard's medallion and the statue lane
   const ring = (r: number, width: number, alpha: number) => {
      ctx.strokeStyle = `rgba(212, 166, 74, ${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
   };
   const px = w / 2 / 8.1;
   ring(5.2 * px, 4, 0.35);
   ring(6.75 * px, 3, 0.25);
   ring(1.3 * px, 5, 0.5);
   ring(1.45 * px, 2, 0.35);
   // compass star in the medallion
   ctx.fillStyle = "rgba(212, 166, 74, 0.28)";
   for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      const len = (k % 2 === 0 ? 1.2 : 0.75) * px;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a + 0.25) * 0.22 * px, cy + Math.sin(a + 0.25) * 0.22 * px);
      ctx.lineTo(cx + Math.cos(a - 0.25) * 0.22 * px, cy + Math.sin(a - 0.25) * 0.22 * px);
      ctx.closePath();
      ctx.fill();
   }
}

function drawCeiling(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cx = w / 2;
   const cy = h / 2;
   const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
   base.addColorStop(0, "#2d2560");
   base.addColorStop(0.3, "#151230");
   base.addColorStop(1, COLORS.ceiling);
   ctx.fillStyle = base;
   ctx.fillRect(0, 0, w, h);
   // coffers: rings and spokes
   ctx.strokeStyle = "rgba(212, 166, 74, 0.16)";
   ctx.lineWidth = 3;
   for (const r of [0.2, 0.3, 0.4, 0.49]) {
      ctx.beginPath();
      ctx.arc(cx, cy, w * r, 0, Math.PI * 2);
      ctx.stroke();
   }
   for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.2, cy + Math.sin(a) * w * 0.2);
      ctx.lineTo(cx + Math.cos(a) * w * 0.49, cy + Math.sin(a) * w * 0.49);
      ctx.stroke();
   }
   // moonlit skylight: glowing ring and a soft disc
   const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.19);
   glow.addColorStop(0, "rgba(220, 210, 255, 0.85)");
   glow.addColorStop(0.55, "rgba(185, 168, 255, 0.55)");
   glow.addColorStop(0.8, "rgba(140, 120, 240, 0.25)");
   glow.addColorStop(1, "rgba(140, 120, 240, 0)");
   ctx.fillStyle = glow;
   ctx.beginPath();
   ctx.arc(cx, cy, w * 0.19, 0, Math.PI * 2);
   ctx.fill();
   ctx.strokeStyle = COLORS.skylight;
   ctx.lineWidth = 6;
   ctx.beginPath();
   ctx.arc(cx, cy, w * 0.15, 0, Math.PI * 2);
   ctx.stroke();
}

/** Soft elliptical glow, white on black (used additively). */
function drawGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, w, h);
   ctx.save();
   ctx.translate(w / 2, h / 2);
   ctx.scale(1, h / w);
   const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.3, "rgba(255,255,255,0.55)");
   g.addColorStop(0.65, "rgba(255,255,255,0.15)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.beginPath();
   ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
   ctx.fill();
   ctx.restore();
}

// Painting atlas: 3 x 2 cells of 320 x 240 plus a gold strip at x 960..1024 for the frame boxes.
const CELL_W = 320;
const CELL_H = 240;
const ATLAS_W = 1024;
const ATLAS_H = 512;
const GOLD_U = 992 / ATLAS_W;
const GOLD_V = 0.5;

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const PAINTERS: Painter[] = [
   // starry night over hills
   (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0f1e5a");
      sky.addColorStop(1, "#2f5fa8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(180, 210, 255, 0.55)";
      ctx.lineWidth = 4;
      for (const [x, y, r] of [[0.35, 0.3, 0.12], [0.6, 0.22, 0.08], [0.2, 0.18, 0.06]]) {
         ctx.beginPath();
         ctx.arc(x * w, y * h, r * w, 0.3, Math.PI * 1.7);
         ctx.stroke();
      }
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.2, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef9c3";
      for (const [x, y] of [[0.1, 0.4], [0.48, 0.12], [0.7, 0.42], [0.92, 0.45], [0.28, 0.5]]) {
         ctx.beginPath();
         ctx.arc(x * w, y * h, 3, 0, Math.PI * 2);
         ctx.fill();
      }
      ctx.fillStyle = "#0b1a2e";
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.6, h * 0.78);
      ctx.quadraticCurveTo(w * 0.85, h * 0.62, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.fill();
      ctx.fillStyle = "#06101f";
      ctx.fillRect(w * 0.16, h * 0.42, w * 0.05, h * 0.5);
   },
   // sunset over layered mountains
   (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#f97362");
      sky.addColorStop(0.5, "#fbbf74");
      sky.addColorStop(1, "#fde7b0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff4d6";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.58, w * 0.12, 0, Math.PI * 2);
      ctx.fill();
      const layers = ["#b4567a", "#7b3a6b", "#3f2253"];
      layers.forEach((c, i) => {
         ctx.fillStyle = c;
         ctx.beginPath();
         ctx.moveTo(0, h);
         const base = h * (0.6 + i * 0.12);
         for (let k = 0; k <= 6; k += 1) ctx.lineTo((k / 6) * w, base - ((k + i) % 2 === 0 ? h * 0.14 : 0));
         ctx.lineTo(w, h);
         ctx.fill();
      });
   },
   // modern abstract: circles and blocks on cream
   (ctx, w, h) => {
      ctx.fillStyle = "#f4ecd8";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#1d3557";
      ctx.fillRect(w * 0.08, h * 0.55, w * 0.35, h * 0.35);
      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.38, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2b134";
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.3, w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(w * 0.05, h * 0.8);
      ctx.lineTo(w * 0.95, h * 0.15);
      ctx.stroke();
      ctx.fillStyle = "#2a9d8f";
      ctx.fillRect(w * 0.7, h * 0.66, w * 0.2, h * 0.2);
   },
   // seascape with a sailboat
   (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, "#9ad1d4");
      sky.addColorStop(1, "#e0f2f1");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.55);
      const sea = ctx.createLinearGradient(0, h * 0.55, 0, h);
      sea.addColorStop(0, "#1f7a8c");
      sea.addColorStop(1, "#0b3c49");
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 3;
      for (let r = 0; r < 4; r += 1) {
         ctx.beginPath();
         for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.66 + r * 0.08) + Math.sin(x / 18 + r) * 4);
         ctx.stroke();
      }
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(w * 0.42, h * 0.56, w * 0.2, h * 0.05);
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.18);
      ctx.lineTo(w * 0.52, h * 0.54);
      ctx.lineTo(w * 0.36, h * 0.54);
      ctx.fill();
   },
   // portrait silhouette with a pearl
   (ctx, w, h) => {
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.5, w * 0.6);
      bg.addColorStop(0, "#6b4226");
      bg.addColorStop(1, "#1c120c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2f3e66";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 1.05, w * 0.32, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c39e";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.42, w * 0.11, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.27, w * 0.15, h * 0.1, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(w * 0.41, h * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
   },
   // still life: vase and fruit
   (ctx, w, h) => {
      ctx.fillStyle = "#283618";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#606c38";
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
      ctx.fillStyle = "#4361ee";
      ctx.beginPath();
      ctx.ellipse(w * 0.36, h * 0.5, w * 0.11, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.32, h * 0.22, w * 0.08, h * 0.12);
      ctx.strokeStyle = "#84cc16";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.22);
      ctx.lineTo(w * 0.3, h * 0.08);
      ctx.moveTo(w * 0.36, h * 0.22);
      ctx.lineTo(w * 0.44, h * 0.06);
      ctx.stroke();
      for (const [x, c] of [[0.6, "#ef4444"], [0.7, "#f59e0b"], [0.8, "#a3e635"]] as const) {
         ctx.fillStyle = c;
         ctx.beginPath();
         ctx.arc(x * w, h * 0.66, w * 0.05, 0, Math.PI * 2);
         ctx.fill();
      }
   },
];

function drawPaintings(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, w, h);
   PAINTERS.forEach((painter, i) => {
      const x0 = (i % 3) * CELL_W;
      const y0 = Math.floor(i / 3) * CELL_H;
      ctx.save();
      ctx.translate(x0, y0);
      // gilded frame
      const gold = ctx.createLinearGradient(0, 0, CELL_W, CELL_H);
      gold.addColorStop(0, "#f6dc8f");
      gold.addColorStop(0.5, COLORS.trim);
      gold.addColorStop(1, COLORS.trimDark);
      ctx.fillStyle = gold;
      ctx.fillRect(0, 0, CELL_W, CELL_H);
      ctx.strokeStyle = "rgba(60, 40, 10, 0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, CELL_W - 24, CELL_H - 24);
      ctx.fillStyle = "#1a1206";
      ctx.fillRect(20, 20, CELL_W - 40, CELL_H - 40);
      ctx.translate(24, 24);
      ctx.beginPath();
      ctx.rect(0, 0, CELL_W - 48, CELL_H - 48);
      ctx.clip();
      painter(ctx, CELL_W - 48, CELL_H - 48);
      // varnish highlight
      const hl = ctx.createLinearGradient(0, 0, CELL_W - 48, CELL_H - 48);
      hl.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      hl.addColorStop(0.4, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = hl;
      ctx.fillRect(0, 0, CELL_W - 48, CELL_H - 48);
      ctx.restore();
   });
   ctx.fillStyle = COLORS.trim;
   ctx.fillRect(960, 0, w - 960, h);
}

// ---------- static geometry, built once ----------

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
   const color = new Color(hex);
   const count = geo.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   return geo;
}

/** Copies `parts` into one geometry and disposes the inputs (and any indexed originals already swapped). */
function mergeOwned(parts: BufferGeometry[], fallback: () => BufferGeometry): BufferGeometry {
   const merged = mergeGeometries(parts);
   for (let i = 0; i < parts.length; i++) parts[i].dispose();
   return merged ?? fallback();
}

/** Drops the index (merge wants one kind) and disposes the indexed original. */
function flatten(parts: BufferGeometry[]): BufferGeometry[] {
   const flat: BufferGeometry[] = [];
   for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const next = part.toNonIndexed();
      if (next !== part) part.dispose();
      flat.push(next);
   }
   return flat;
}

/** A geometry this mount owns. Disposed on unmount, so Retry does not keep the GPU buffer. */
export function useOwnedGeometry<T extends { dispose(): void }>(factory: () => T): T {
   const geometry = useMemo(factory, [factory]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return geometry;
}

function pedestalGeometry(): BufferGeometry {
   const top = PEDESTAL_TOP(RING.pedestalTop);
   const parts = [
      paint(new BoxGeometry(0.92, 0.1, 0.92).translate(0, 0.05, 0), COLORS.plinth),
      paint(new BoxGeometry(0.52, top - 0.22, 0.52).translate(0, 0.1 + (top - 0.22) / 2, 0), COLORS.column),
      paint(new BoxGeometry(0.56, 0.03, 0.56).translate(0, 0.16, 0), COLORS.trim),
      paint(new BoxGeometry(0.8, 0.12, 0.8).translate(0, top - 0.06, 0), COLORS.cap),
   ];
   return mergeOwned(parts, () => new BoxGeometry(0.8, 0.12, 0.8));
}

function vaseGeometry(): BufferGeometry {
   return mergeOwned(
      [
         new CylinderGeometry(0.1, 0.13, 0.08, 10).translate(0, 0.04, 0),
         new SphereGeometry(0.16, 12, 10).translate(0, 0.26, 0),
         new CylinderGeometry(0.05, 0.08, 0.14, 8).translate(0, 0.46, 0),
      ],
      () => new SphereGeometry(0.16, 10, 8),
   );
}

/** Place a geometry built facing +z on the wall at `angle`, facing the room centre. */
function onWall(geo: BufferGeometry, angle: number, r: number, y: number): BufferGeometry {
   return geo.rotateY(angle + Math.PI).translate(Math.sin(angle) * r, y, Math.cos(angle) * r);
}

function setUv(geo: BufferGeometry, u: number, v: number) {
   const uv = geo.getAttribute("uv");
   for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u, v);
}

function paintingsGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   PAINT_ANGLES.forEach((angle, i) => {
      const canvas = new PlaneGeometry(PAINT_W, PAINT_H);
      const u0 = ((i % 3) * CELL_W) / ATLAS_W;
      const u1 = ((i % 3) * CELL_W + CELL_W) / ATLAS_W;
      const v1 = 1 - (Math.floor(i / 3) * CELL_H) / ATLAS_H;
      const v0 = v1 - CELL_H / ATLAS_H;
      const uv = canvas.getAttribute("uv");
      for (let k = 0; k < uv.count; k += 1) uv.setXY(k, uv.getX(k) === 0 ? u0 : u1, uv.getY(k) === 0 ? v0 : v1);
      parts.push(onWall(canvas, angle, PAINT_R, PAINT_Y));
      const frame = new BoxGeometry(PAINT_W + 0.06, PAINT_H + 0.06, 0.05).translate(0, 0, -0.03);
      setUv(frame, GOLD_U, GOLD_V);
      parts.push(onWall(frame, angle, PAINT_R, PAINT_Y));
   });
   return mergeOwned(flatten(parts), () => new PlaneGeometry(1, 1));
}

function fixturesGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (const angle of PAINT_ANGLES) {
      // picture light bar above the frame
      parts.push(onWall(new BoxGeometry(0.46, 0.035, 0.05).translate(0, 0, 0.1), angle, PAINT_R, PAINT_Y + PAINT_H / 2 + 0.12));
   }
   for (const angle of SCONCE_ANGLES) {
      parts.push(onWall(new BoxGeometry(0.1, 0.22, 0.02).translate(0, 0, 0.01), angle, 7.84, SCONCE_Y));
      parts.push(onWall(new CylinderGeometry(0.08, 0.045, 0.14, 12, 1, true).translate(0, 0.04, 0.09), angle, 7.84, SCONCE_Y));
   }
   return mergeOwned(flatten(parts), () => new BoxGeometry(0.1, 0.1, 0.1));
}

function washGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (const angle of PAINT_ANGLES) parts.push(onWall(new PlaneGeometry(1.7, 1.5), angle, PAINT_R - 0.02, PAINT_Y + 0.12));
   for (const angle of SCONCE_ANGLES) parts.push(onWall(new PlaneGeometry(1.3, 2.4), angle, 7.83, SCONCE_Y + 0.1));
   return mergeOwned(parts, () => new PlaneGeometry(1, 1));
}

function postGeometry(): BufferGeometry {
   return mergeOwned(
      [
         new CylinderGeometry(0.11, 0.13, 0.05, 16).translate(0, 0.025, 0),
         new CylinderGeometry(BARRIER.postRadius, BARRIER.postRadius, BARRIER.post, 10).translate(0, BARRIER.post / 2, 0),
         new SphereGeometry(BARRIER.ball, 14, 10).translate(0, BARRIER.post + BARRIER.ball, 0),
      ],
      () => new SphereGeometry(0.05),
   );
}

function ropeGeometry(): BufferGeometry {
   const pts = barrierRope(12).map((p) => new Vector3(p.x, p.y, p.z));
   pts.pop();
   const curve = new CatmullRomCurve3(pts, true, "centripetal");
   return new TubeGeometry(curve, pts.length * 2, BARRIER.rope, 6, true);
}

function moteGeometry(): BufferGeometry {
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(motePositions(), 3));
   geo.setAttribute("color", new BufferAttribute(new Float32Array(MOTES * 3), 3));
   return geo;
}

function motePositions(): Float32Array {
   const data = new Float32Array(MOTES * 3);
   for (let i = 0; i < MOTES; i += 1) {
      const angle = (i / MOTES) * Math.PI * 2 + (i % 3) * 0.2;
      const radius = 2.2 + (i % 6) * 0.75;
      data[i * 3] = Math.sin(angle) * radius;
      data[i * 3 + 1] = 0.35 + (i % 8) * 0.28;
      data[i * 3 + 2] = Math.cos(angle) * radius;
   }
   return data;
}

function useRepeat(texture: CanvasTexture, repeat: number, offset: number) {
   useMemo(() => {
      texture.wrapS = RepeatWrapping;
      texture.repeat.set(repeat, 1);
      texture.offset.set(offset, 0);
      texture.needsUpdate = true;
   }, [texture, repeat, offset]);
}

// ---------- pieces ----------

function Pedestals() {
   const geometry = useOwnedGeometry(pedestalGeometry);
   return (
      <Instanced spots={PEDESTAL_SPOTS} name="pedestals">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.45} metalness={0.25} />
      </Instanced>
   );
}

function Vases() {
   const geometry = useOwnedGeometry(vaseGeometry);
   return (
      <Instanced spots={VASES} name="vases">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial color={COLORS.vase} metalness={0.6} roughness={0.35} emissive={COLORS.lampGlow} emissiveIntensity={0.08} />
      </Instanced>
   );
}

function Paintings() {
   const atlas = useCanvasTexture(ATLAS_W, ATLAS_H, drawPaintings);
   const geometry = useOwnedGeometry(paintingsGeometry);
   return (
      <mesh geometry={geometry} name="paintings">
         <meshStandardMaterial map={atlas} emissiveMap={atlas} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.5} metalness={0.15} />
      </mesh>
   );
}

function Lamps() {
   const glow = useCanvasTexture(128, 128, drawGlow);
   const fixtures = useOwnedGeometry(fixturesGeometry);
   const wash = useOwnedGeometry(washGeometry);
   return (
      <>
         <mesh geometry={fixtures} name="sconces">
            <meshBasicMaterial color={COLORS.sconce} toneMapped={false} />
         </mesh>
         <mesh geometry={wash} name="lamp-wash" renderOrder={1}>
            <meshBasicMaterial map={glow} color={COLORS.lampGlow} transparent opacity={0.42} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

function Barrier() {
   const post = useOwnedGeometry(postGeometry);
   const rope = useOwnedGeometry(ropeGeometry);
   return (
      <group name="barrier">
         <Instanced spots={POST_SPOTS} name="barrier-posts">
            <primitive object={post} attach="geometry" />
            <meshStandardMaterial color={COLORS.brass} metalness={0.85} roughness={0.28} emissive={COLORS.trimDark} emissiveIntensity={0.25} />
         </Instanced>
         <mesh geometry={rope} name="barrier-rope">
            <meshStandardMaterial color={COLORS.velvet} roughness={0.75} emissive={COLORS.velvet} emissiveIntensity={0.25} />
         </mesh>
      </group>
   );
}

/** Dust motes; the ones inside the live beam light up (no allocation per frame). */
function Motes({ yaw }: { yaw: { current: number } }) {
   const geometry = useOwnedGeometry(moteGeometry);
   const time = useGameTime();
   useFrame(() => {
      const pos = geometry.getAttribute("position");
      const col = geometry.getAttribute("color");
      const p = pos.array as Float32Array;
      const c = col.array as Float32Array;
      const t = time.now;
      const fx = Math.sin(yaw.current);
      const fz = Math.cos(yaw.current);
      for (let i = 0; i < MOTES; i += 1) {
         p[i * 3 + 1] = 0.4 + ((t * 0.12 + i * 0.17) % 2.4);
         const x = p[i * 3];
         const z = p[i * 3 + 2];
         const cos = (x * fx + z * fz) / Math.max(0.01, Math.hypot(x, z));
         const lit = Math.max(0, (cos - 0.93) / 0.07);
         c[i * 3] = 0.35 + 0.65 * lit;
         c[i * 3 + 1] = 0.3 + 0.65 * lit;
         c[i * 3 + 2] = 0.6 + 0.4 * lit;
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
   });
   return (
      <points geometry={geometry}>
         <pointsMaterial vertexColors size={0.05} transparent opacity={0.8} depthWrite={false} sizeAttenuation blending={AdditiveBlending} toneMapped={false} />
      </points>
   );
}

function DoorFallback() {
   return (
      <Instanced spots={DOOR_FALLBACK}>
         <boxGeometry args={[1.15, 2.1, 0.16]} />
         <meshStandardMaterial color={COLORS.door} roughness={0.55} metalness={0.15} />
      </Instanced>
   );
}

export default function Gallery({ yaw }: { yaw: { current: number } }) {
   const floor = useCanvasTexture(1024, 1024, drawFloor);
   const wall = useCanvasTexture(512, 512, drawWall);
   const ceiling = useCanvasTexture(512, 512, drawCeiling);
   useRepeat(wall, WALL_TILES, 0.5);
   const { tier } = useQuality();
   return (
      <group name="gallery">
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[8.1, 64]} />
            <meshStandardMaterial map={floor} emissiveMap={floor} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.22} metalness={0.35} />
         </mesh>
         <mesh position={[0, WALL_H / 2, 0]}>
            <cylinderGeometry args={[WALL_R, WALL_R, WALL_H, 64, 1, true]} />
            <meshStandardMaterial map={wall} emissiveMap={wall} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.85} side={BackSide} />
         </mesh>
         <mesh rotation-x={Math.PI / 2} position={[0, WALL_H, 0]}>
            <circleGeometry args={[WALL_R + 0.05, 64]} />
            <meshBasicMaterial map={ceiling} />
         </mesh>
         <Pedestals />
         <Paintings />
         <Lamps />
         <Vases />
         <Barrier />
         <InstancedModel asset={ASSETS.door} spots={DOOR_SPOTS} fallback={<DoorFallback />} />
         {tier !== "low" && (
            <Model asset={ASSETS.bench} position={[0, 0, -2.35]} rotation={[0, 0, 0]} fallback={<BenchFallback />} />
         )}
         {tier !== "low" && <Motes yaw={yaw} />}
      </group>
   );
}
