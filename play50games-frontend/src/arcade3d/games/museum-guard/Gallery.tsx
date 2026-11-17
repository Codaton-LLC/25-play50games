"use client";

// The round gallery at night: each of the five levels has its own wing architecture, wall/floor/
// ceiling canvas textures, framed wall art, pedestal palette, instanced GLB displays, and merged
// bevelled set pieces (obelisks, salon vitrines + chandelier, planetarium orrery + holo-pylons,
// midnight vault ribs + security laser grid). Level 1 is today's Main Hall unchanged.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BackSide,
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   CatmullRomCurve3,
   Color,
   ConeGeometry,
   CylinderGeometry,
   OctahedronGeometry,
   PlaneGeometry,
   RepeatWrapping,
   SphereGeometry,
   TorusGeometry,
   TubeGeometry,
   Vector3,
   type CanvasTexture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model, InstancedModel } from "@/arcade3d/core/assets";
import { PEDESTAL_TOP } from "@/arcade3d/core/kit";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render/useCanvasTexture";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";
import { LEVELS, type MuseumLevel, type WingPalette, type WingSetPiece, type WingTheme } from "./levels";
import { BARRIER, barrierPostAngle, barrierRope, COLORS } from "./looks";
import { BenchFallback, BustFallback } from "./Primitives";
import { EXITS, makePedestal, RING } from "./rules";
import { useMuseumLevel } from "./useMuseumLevel";

export const WALL_R = 7.9;
const WALL_H = 4.4;
const WALL_TILES = 16;

const PAINT_ANGLES = [0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
/** Sconces sit on the wall behind each pedestal (between the paintings and the doors). */
const SCONCE_ANGLES = Array.from({ length: RING.count }, (_, i) => ((i + 0.5) * Math.PI) / 4);
const PAINT_W = 1.05;
const PAINT_H = 0.8;
const PAINT_Y = 1.78;
const PAINT_R = 7.78;
const SCONCE_Y = 2.55;

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

// ---------- canvas textures (per-wing module-level functions, drawn once per level) ----------

function drawWallFor(pal: WingPalette, wing: WingTheme): CanvasDraw {
   return (ctx, w, h) => {
      const m = h / WALL_H;
      const y = (metres: number) => h - metres * m;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, pal.wallTop);
      grad.addColorStop(0.35, pal.wallMid);
      grad.addColorStop(0.75, pal.wallMid);
      grad.addColorStop(1, pal.wallLow);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = pal.wallPanel;
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.12, y(3.75), w * 0.76, (3.75 - 1.15) * m);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.15, y(3.65), w * 0.7, (3.65 - 1.25) * m);
      ctx.strokeStyle = pal.wallPanel;
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.12, y(0.9), w * 0.76, (0.9 - 0.24) * m);

      if (wing === "ancient-wing") {
         // Hieroglyphic frieze band & stepped sandstone blocks
         ctx.strokeStyle = "rgba(229, 184, 92, 0.22)";
         ctx.lineWidth = 2;
         for (let k = 0; k < 6; k += 1) {
            const x0 = w * (0.16 + k * 0.11);
            ctx.strokeRect(x0, y(3.98), w * 0.08, 0.16 * m);
         }
      } else if (wing === "art-wing") {
         // Damask diamond lattice inside the upper panel
         ctx.strokeStyle = "rgba(253, 224, 171, 0.09)";
         ctx.lineWidth = 1.5;
         for (let k = 0; k < 4; k += 1) {
            const cy = y(1.6 + k * 0.55);
            ctx.beginPath();
            ctx.moveTo(w * 0.5, cy - 18);
            ctx.lineTo(w * 0.62, cy);
            ctx.lineTo(w * 0.5, cy + 18);
            ctx.lineTo(w * 0.38, cy);
            ctx.closePath();
            ctx.stroke();
         }
      } else if (wing === "science-wing") {
         // Glowing cyan telemetry grid lines
         ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
         ctx.lineWidth = 1.5;
         for (let k = 1; k <= 4; k += 1) {
            const yy = y(1.2 + k * 0.5);
            ctx.beginPath();
            ctx.moveTo(w * 0.15, yy);
            ctx.lineTo(w * 0.85, yy);
            ctx.stroke();
         }
      } else if (wing === "full-night") {
         // Vault security chevron stripe along the cornice and dado
         ctx.strokeStyle = "rgba(244, 63, 94, 0.28)";
         ctx.lineWidth = 2;
         ctx.strokeRect(w * 0.1, y(3.82), w * 0.8, (3.82 - 1.1) * m);
      }

      ctx.fillStyle = "rgba(4, 3, 12, 0.28)";
      ctx.fillRect(0, y(1.0), w, 1.0 * m);
      const gold = (top: number, thick: number) => {
         const g = ctx.createLinearGradient(0, y(top), 0, y(top - thick));
         g.addColorStop(0, "#ffffff");
         g.addColorStop(0.35, pal.trim);
         g.addColorStop(1, pal.trimDark);
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
   };
}

function drawFloorFor(pal: WingPalette, wing: WingTheme): CanvasDraw {
   return (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      base.addColorStop(0, pal.floorCore);
      base.addColorStop(0.45, pal.floorMid);
      base.addColorStop(1, pal.floorEdge);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = wing === "science-wing" ? "rgba(56, 189, 248, 0.14)" : "rgba(220, 200, 170, 0.08)";
      ctx.lineWidth = 2;
      for (let k = 1; k <= 7; k += 1) {
         ctx.beginPath();
         ctx.arc(cx, cy, (w * 0.5 * k) / 7.5, 0, Math.PI * 2);
         ctx.stroke();
      }
      const spokes = wing === "science-wing" ? 48 : wing === "ancient-wing" ? 24 : 32;
      for (let k = 0; k < spokes; k += 1) {
         const a = (k / spokes) * Math.PI * 2;
         const r0 = w * 0.5 * (k % 2 === 0 ? 0.14 : 0.28);
         ctx.beginPath();
         ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
         ctx.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.5);
         ctx.stroke();
      }

      const sheen = ctx.createRadialGradient(cx, cy, w * 0.18, cx, cy, w * 0.48);
      sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
      sheen.addColorStop(0.55, "rgba(255, 255, 255, 0.08)");
      sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      const px = w / 2 / 8.1;
      const ring = (r: number, width: number, color: string) => {
         ctx.strokeStyle = color;
         ctx.lineWidth = width;
         ctx.beginPath();
         ctx.arc(cx, cy, r, 0, Math.PI * 2);
         ctx.stroke();
      };
      const accentRgba =
         wing === "science-wing"
            ? "rgba(56, 189, 248, 0.42)"
            : wing === "art-wing"
               ? "rgba(245, 208, 118, 0.42)"
               : wing === "full-night"
                  ? "rgba(251, 191, 36, 0.48)"
                  : "rgba(212, 166, 74, 0.38)";
      ring(5.2 * px, 4, accentRgba);
      ring(6.75 * px, 3, accentRgba);
      ring(1.3 * px, 5, accentRgba);
      ring(1.45 * px, 2, accentRgba);

      if (wing === "ancient-wing") {
         // North cordon sandstone floor arc + 16-ray solar scarab medallion
         ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
         ctx.lineWidth = 6;
         ctx.beginPath();
         ctx.arc(cx, cy, 5.42 * px, -Math.PI * 0.85, -Math.PI * 0.15);
         ctx.stroke();
      } else if (wing === "full-night") {
         // Vault security sector arcs
         ctx.strokeStyle = "rgba(244, 63, 94, 0.35)";
         ctx.lineWidth = 5;
         ctx.beginPath();
         ctx.arc(cx, cy, 5.2 * px, -0.35, 0.35);
         ctx.stroke();
         ctx.beginPath();
         ctx.arc(cx, cy, 5.2 * px, Math.PI - 0.35, Math.PI + 0.35);
         ctx.stroke();
      }

      const rays = wing === "ancient-wing" || wing === "full-night" ? 16 : wing === "art-wing" ? 12 : 8;
      ctx.fillStyle = accentRgba;
      for (let k = 0; k < rays; k += 1) {
         const a = (k / rays) * Math.PI * 2;
         const len = (k % 2 === 0 ? 1.2 : 0.75) * px;
         ctx.beginPath();
         ctx.moveTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
         ctx.lineTo(cx + Math.cos(a + 0.22) * 0.22 * px, cy + Math.sin(a + 0.22) * 0.22 * px);
         ctx.lineTo(cx + Math.cos(a - 0.22) * 0.22 * px, cy + Math.sin(a - 0.22) * 0.22 * px);
         ctx.closePath();
         ctx.fill();
      }
   };
}

function drawCeilingFor(pal: WingPalette, wing: WingTheme): CanvasDraw {
   return (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      base.addColorStop(0, pal.wallMid);
      base.addColorStop(0.35, pal.wallTop);
      base.addColorStop(1, pal.ceiling);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = wing === "science-wing" ? "rgba(56, 189, 248, 0.25)" : "rgba(212, 166, 74, 0.18)";
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
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.19);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(0.45, pal.skylight);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.skylight;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.15, 0, Math.PI * 2);
      ctx.stroke();
   };
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

// Painting atlas: 3 x 2 cells of 320 x 240 plus a trim strip at x 960..1024 for the frame boxes.
const CELL_W = 320;
const CELL_H = 240;
const ATLAS_W = 1024;
const ATLAS_H = 512;
const GOLD_U = 992 / ATLAS_W;
const GOLD_V = 0.5;

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, i: number) => void;

const MAIN_HALL_PAINTERS: Painter[] = [
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
      ctx.fillStyle = "#0b1a2e";
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.6, h * 0.78);
      ctx.quadraticCurveTo(w * 0.85, h * 0.62, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.fill();
   },
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
      ["#b4567a", "#7b3a6b", "#3f2253"].forEach((c, i) => {
         ctx.fillStyle = c;
         ctx.beginPath();
         ctx.moveTo(0, h);
         const base = h * (0.6 + i * 0.12);
         for (let k = 0; k <= 6; k += 1) ctx.lineTo((k / 6) * w, base - ((k + i) % 2 === 0 ? h * 0.14 : 0));
         ctx.lineTo(w, h);
         ctx.fill();
      });
   },
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
   },
   (ctx, w, h) => {
      ctx.fillStyle = "#9ad1d4";
      ctx.fillRect(0, 0, w, h * 0.55);
      ctx.fillStyle = "#1f7a8c";
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(w * 0.42, h * 0.56, w * 0.2, h * 0.05);
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.18);
      ctx.lineTo(w * 0.52, h * 0.54);
      ctx.lineTo(w * 0.36, h * 0.54);
      ctx.fill();
   },
   (ctx, w, h) => {
      ctx.fillStyle = "#3b2314";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2f3e66";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 1.05, w * 0.32, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c39e";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.42, w * 0.11, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
   },
   (ctx, w, h) => {
      ctx.fillStyle = "#283618";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#606c38";
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
      ctx.fillStyle = "#4361ee";
      ctx.beginPath();
      ctx.ellipse(w * 0.36, h * 0.5, w * 0.11, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
   },
];

function drawThemedCell(wing: WingTheme, ctx: CanvasRenderingContext2D, w: number, h: number, i: number) {
   if (wing === "main-hall") {
      MAIN_HALL_PAINTERS[i % MAIN_HALL_PAINTERS.length](ctx, w, h, i);
      return;
   }
   if (wing === "ancient-wing") {
      // Egyptian sandstone & lapis murals: pyramids, solar discs, scarabs, lotus columns
      ctx.fillStyle = i % 2 === 0 ? "#1e3a5f" : "#3b2311";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.74);
      ctx.lineTo(w * 0.42, h * 0.28);
      ctx.lineTo(w * 0.66, h * 0.74);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(w * (0.28 + (i % 3) * 0.22), h * 0.24, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      return;
   }
   if (wing === "art-wing") {
      // Renaissance crimson & gold salon canvases
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, i % 2 === 0 ? "#881337" : "#31102f");
      bg.addColorStop(1, "#fda4af");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.48, w * (0.14 + (i % 3) * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff1f2";
      ctx.lineWidth = 4;
      ctx.strokeRect(w * 0.14, h * 0.16, w * 0.72, h * 0.68);
      return;
   }
   if (wing === "science-wing") {
      // Backlit cyan observatory & DNA/orbital schematics
      ctx.fillStyle = "#041326";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 3;
      for (let r = 1; r <= 3; r += 1) {
         ctx.beginPath();
         ctx.ellipse(w * 0.5, h * 0.5, w * 0.11 * r, h * 0.09 * r, (i + r) * 0.4, 0, Math.PI * 2);
         ctx.stroke();
      }
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 10, 0, Math.PI * 2);
      ctx.fill();
      return;
   }
   // full-night: royal gold & crimson crown treasury tapestries
   ctx.fillStyle = "#0f0a24";
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "#fbbf24";
   ctx.lineWidth = 4;
   ctx.strokeRect(w * 0.1, h * 0.12, w * 0.8, h * 0.76);
   ctx.fillStyle = "#f43f5e";
   ctx.beginPath();
   ctx.moveTo(w * 0.5, h * 0.18);
   ctx.lineTo(w * 0.72, h * 0.5);
   ctx.lineTo(w * 0.5, h * 0.82);
   ctx.lineTo(w * 0.28, h * 0.5);
   ctx.closePath();
   ctx.fill();
   ctx.fillStyle = "#fde047";
   ctx.beginPath();
   ctx.arc(w * 0.5, h * 0.5, w * 0.09, 0, Math.PI * 2);
   ctx.fill();
}

function drawPaintingsFor(pal: WingPalette, wing: WingTheme): CanvasDraw {
   return (ctx, w, h) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i += 1) {
         const x0 = (i % 3) * CELL_W;
         const y0 = Math.floor(i / 3) * CELL_H;
         ctx.save();
         ctx.translate(x0, y0);
         const gold = ctx.createLinearGradient(0, 0, CELL_W, CELL_H);
         gold.addColorStop(0, "#ffffff");
         gold.addColorStop(0.4, pal.trim);
         gold.addColorStop(1, pal.trimDark);
         ctx.fillStyle = gold;
         ctx.fillRect(0, 0, CELL_W, CELL_H);
         ctx.strokeStyle = "rgba(20, 14, 6, 0.65)";
         ctx.lineWidth = 3;
         ctx.strokeRect(12, 12, CELL_W - 24, CELL_H - 24);
         ctx.fillStyle = "#0c0a09";
         ctx.fillRect(20, 20, CELL_W - 40, CELL_H - 40);
         ctx.translate(24, 24);
         ctx.beginPath();
         ctx.rect(0, 0, CELL_W - 48, CELL_H - 48);
         ctx.clip();
         drawThemedCell(wing, ctx, CELL_W - 48, CELL_H - 48, i);
         ctx.restore();
      }
      ctx.fillStyle = pal.trim;
      ctx.fillRect(960, 0, w - 960, h);
   };
}

// ---------- level 1 (the main hall): main's own canvas art, drawn exactly as before levels ----------
// Only wings 2-5 use the themed painters above; the main hall keeps main's wall (the gold rail), floor,
// ceiling (the moonlit skylight) and its six paintings (stars, tree, waves, fruit...).

function mainHallWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

function mainHallFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

function mainHallCeiling(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

type MainHallPainter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const MAIN_HALL_ART: MainHallPainter[] = [
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

function mainHallPaintings(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, w, h);
   MAIN_HALL_ART.forEach((painter, i) => {
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

const WALL_DRAWERS: Record<WingTheme, CanvasDraw> = {
   "main-hall": mainHallWall,
   "ancient-wing": drawWallFor(LEVELS[2].palette, "ancient-wing"),
   "art-wing": drawWallFor(LEVELS[3].palette, "art-wing"),
   "science-wing": drawWallFor(LEVELS[4].palette, "science-wing"),
   "full-night": drawWallFor(LEVELS[5].palette, "full-night"),
};

const FLOOR_DRAWERS: Record<WingTheme, CanvasDraw> = {
   "main-hall": mainHallFloor,
   "ancient-wing": drawFloorFor(LEVELS[2].palette, "ancient-wing"),
   "art-wing": drawFloorFor(LEVELS[3].palette, "art-wing"),
   "science-wing": drawFloorFor(LEVELS[4].palette, "science-wing"),
   "full-night": drawFloorFor(LEVELS[5].palette, "full-night"),
};

const CEILING_DRAWERS: Record<WingTheme, CanvasDraw> = {
   "main-hall": mainHallCeiling,
   "ancient-wing": drawCeilingFor(LEVELS[2].palette, "ancient-wing"),
   "art-wing": drawCeilingFor(LEVELS[3].palette, "art-wing"),
   "science-wing": drawCeilingFor(LEVELS[4].palette, "science-wing"),
   "full-night": drawCeilingFor(LEVELS[5].palette, "full-night"),
};

const PAINTING_DRAWERS: Record<WingTheme, CanvasDraw> = {
   "main-hall": mainHallPaintings,
   "ancient-wing": drawPaintingsFor(LEVELS[2].palette, "ancient-wing"),
   "art-wing": drawPaintingsFor(LEVELS[3].palette, "art-wing"),
   "science-wing": drawPaintingsFor(LEVELS[4].palette, "science-wing"),
   "full-night": drawPaintingsFor(LEVELS[5].palette, "full-night"),
};

// ---------- static geometry builders ----------

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
   const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
   const color = new Color(hex);
   const count = nonIndexed.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   nonIndexed.setAttribute("color", new BufferAttribute(colors, 3));
   return nonIndexed;
}

function pedestalGeometry(pal: WingPalette): BufferGeometry {
   const top = PEDESTAL_TOP(RING.pedestalTop);
   const base = paint(new BoxGeometry(0.92, 0.1, 0.92).translate(0, 0.05, 0), pal.plinth);
   const column = paint(new BoxGeometry(0.52, top - 0.22, 0.52).translate(0, 0.1 + (top - 0.22) / 2, 0), pal.column);
   const band = paint(new BoxGeometry(0.56, 0.03, 0.56).translate(0, 0.16, 0), pal.trim);
   const cap = paint(new BoxGeometry(0.8, 0.12, 0.8).translate(0, top - 0.06, 0), pal.cap);
   return mergeGeometries([base, column, band, cap]) ?? cap;
}

function bustPlinthGeometry(pal: WingPalette): BufferGeometry {
   const base = paint(new BoxGeometry(0.46, 0.1, 0.46).translate(0, 0.05, 0), pal.plinth);
   const shaft = paint(new CylinderGeometry(0.17, 0.2, 0.66, 12).translate(0, 0.43, 0), pal.column);
   const cap = paint(new BoxGeometry(0.42, 0.08, 0.42).translate(0, 0.8, 0), pal.cap);
   return mergeGeometries([base, shaft, cap]) ?? cap;
}

function vaseGeometry(): BufferGeometry {
   return (
      mergeGeometries([
         new CylinderGeometry(0.1, 0.13, 0.08, 10).translate(0, 0.04, 0),
         new SphereGeometry(0.16, 12, 10).translate(0, 0.26, 0),
         new CylinderGeometry(0.05, 0.08, 0.14, 8).translate(0, 0.46, 0),
      ]) ?? new SphereGeometry(0.16, 10, 8)
   );
}

/** Place a geometry built facing +z on the wall/ring at `angle`, facing the room centre. */
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
   return mergeGeometries(parts.map((g) => g.toNonIndexed())) ?? new PlaneGeometry(1, 1);
}

function fixturesGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (const angle of PAINT_ANGLES) {
      parts.push(onWall(new BoxGeometry(0.46, 0.035, 0.05).translate(0, 0, 0.1), angle, PAINT_R, PAINT_Y + PAINT_H / 2 + 0.12));
   }
   for (const angle of SCONCE_ANGLES) {
      parts.push(onWall(new BoxGeometry(0.1, 0.22, 0.02).translate(0, 0, 0.01), angle, 7.84, SCONCE_Y));
      parts.push(onWall(new CylinderGeometry(0.08, 0.045, 0.14, 12, 1, true).translate(0, 0.04, 0.09), angle, 7.84, SCONCE_Y));
   }
   return mergeGeometries(parts.map((g) => g.toNonIndexed())) ?? new BoxGeometry(0.1, 0.1, 0.1);
}

function washGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (const angle of PAINT_ANGLES) parts.push(onWall(new PlaneGeometry(1.7, 1.5), angle, PAINT_R - 0.02, PAINT_Y + 0.12));
   for (const angle of SCONCE_ANGLES) parts.push(onWall(new PlaneGeometry(1.3, 2.4), angle, 7.83, SCONCE_Y + 0.1));
   return mergeGeometries(parts) ?? new PlaneGeometry(1, 1);
}

function postGeometry(): BufferGeometry {
   return (
      mergeGeometries([
         new CylinderGeometry(0.11, 0.13, 0.05, 16).translate(0, 0.025, 0),
         new CylinderGeometry(BARRIER.postRadius, BARRIER.postRadius, BARRIER.post, 10).translate(0, BARRIER.post / 2, 0),
         new SphereGeometry(BARRIER.ball, 14, 10).translate(0, BARRIER.post + BARRIER.ball, 0),
      ]) ?? new SphereGeometry(0.05)
   );
}

function ropeGeometry(): BufferGeometry {
   const pts = barrierRope(12).map((p) => new Vector3(p.x, p.y, p.z));
   pts.pop();
   const curve = new CatmullRomCurve3(pts, true, "centripetal");
   return new TubeGeometry(curve, pts.length * 2, BARRIER.rope, 6, true);
}

/** Per-level code-built architectural set pieces, merged into a single vertex-coloured mesh. */
function wingSetPieceGeometry(setPiece: WingSetPiece, angles: readonly number[], pal: WingPalette): BufferGeometry | null {
   if (setPiece === "rotunda") return null;
   const parts: BufferGeometry[] = [];

   if (setPiece === "obelisks") {
      // Ancient Wing: 4 carved sandstone obelisks with gold-leaf pyramidions + north portal lintel
      for (const a of angles) {
         const r = 7.32;
         parts.push(onWall(paint(new BoxGeometry(0.58, 0.22, 0.58), pal.plinth), a, r, 0.11));
         parts.push(onWall(paint(new CylinderGeometry(0.16, 0.25, 2.35, 4).rotateY(Math.PI / 4), pal.column), a, r, 1.39));
         parts.push(onWall(paint(new ConeGeometry(0.22, 0.42, 4).rotateY(Math.PI / 4), pal.cap), a, r, 2.78));
      }
      // North sandstone cordon arch framing the detoured north lane (outside playRadius at r = 7.15)
      parts.push(onWall(paint(new BoxGeometry(1.75, 0.22, 0.34), pal.cap), 0, 7.28, 2.95));
   } else if (setPiece === "vitrines") {
      // Art Wing: 4 brass-and-crimson sculpture vitrines + overhead Venetian crystal chandelier
      for (const a of angles) {
         const r = 7.08;
         parts.push(onWall(paint(new BoxGeometry(0.56, 0.72, 0.56), pal.plinth), a, r, 0.36));
         parts.push(onWall(paint(new BoxGeometry(0.6, 0.06, 0.6), pal.cap), a, r, 0.75));
         parts.push(onWall(paint(new OctahedronGeometry(0.22, 0), pal.sconce), a, r, 1.12));
         parts.push(onWall(paint(new BoxGeometry(0.5, 0.05, 0.5), pal.cap), a, r, 1.52));
      }
      // Overhead chandelier at y = 3.65..4.35 m
      parts.push(paint(new CylinderGeometry(0.04, 0.04, 0.65, 8).translate(0, 4.02, 0), pal.cap));
      parts.push(paint(new TorusGeometry(0.95, 0.045, 8, 24).rotateX(Math.PI / 2).translate(0, 3.72, 0), pal.cap));
      parts.push(paint(new TorusGeometry(0.52, 0.035, 8, 18).rotateX(Math.PI / 2).translate(0, 3.55, 0), pal.sconce));
   } else if (setPiece === "orrery") {
      // Science Wing: 4 Tesla-coil holo-pylons + overhead planetarium brass & cyan orrery
      for (const a of angles) {
         const r = 7.22;
         parts.push(onWall(paint(new CylinderGeometry(0.24, 0.28, 0.32, 12), pal.plinth), a, r, 0.16));
         parts.push(onWall(paint(new CylinderGeometry(0.1, 0.14, 1.45, 12), pal.column), a, r, 1.04));
         for (const ringY of [0.85, 1.25, 1.65]) {
            parts.push(onWall(paint(new TorusGeometry(0.22, 0.025, 8, 16).rotateX(Math.PI / 2), pal.cap), a, r, ringY));
         }
         parts.push(onWall(paint(new SphereGeometry(0.16, 12, 10), pal.sconce), a, r, 1.92));
      }
      // Overhead Planetarium Orrery at y = 3.55..4.15 m
      parts.push(paint(new SphereGeometry(0.32, 16, 12).translate(0, 3.78, 0), "#fde047"));
      parts.push(paint(new TorusGeometry(1.35, 0.03, 8, 32).rotateX(Math.PI / 2 + 0.18).translate(0, 3.78, 0), pal.cap));
      parts.push(paint(new TorusGeometry(2.15, 0.025, 8, 36).rotateX(Math.PI / 2 - 0.14).translate(0, 3.82, 0), pal.sconce));
   } else if (setPiece === "vault-lasers") {
      // Full Museum Night: 6 obsidian-and-gold vault ribs + overhead crimson security laser grid + door alarm beacons
      for (const a of angles) {
         const r = 7.58;
         parts.push(onWall(paint(new BoxGeometry(0.36, 3.8, 0.28), pal.plinth), a, r, 1.9));
         parts.push(onWall(paint(new BoxGeometry(0.42, 0.14, 0.34), pal.cap), a, r, 1.05));
         parts.push(onWall(paint(new BoxGeometry(0.42, 0.14, 0.34), pal.cap), a, r, 2.85));
      }
      // Overhead crimson laser grid rings at y = 3.48 m
      parts.push(paint(new TorusGeometry(2.8, 0.025, 8, 36).rotateX(Math.PI / 2).translate(0, 3.48, 0), "#f43f5e"));
      parts.push(paint(new TorusGeometry(4.8, 0.025, 8, 44).rotateX(Math.PI / 2).translate(0, 3.58, 0), "#fbbf24"));
      // Security alarm beacons above the two exit doors
      for (const doorAngle of [EXITS.pos, EXITS.neg]) {
         parts.push(onWall(paint(new SphereGeometry(0.16, 12, 10), "#f43f5e"), doorAngle, 7.32, 2.42));
      }
   }

   return parts.length > 0 ? mergeGeometries(parts) : null;
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

function Pedestals({ spots, pal }: { spots: readonly InstanceSpot[]; pal: WingPalette }) {
   const geometry = useMemo(() => pedestalGeometry(pal), [pal]);
   return (
      <Instanced spots={spots} name="pedestals">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.45} metalness={0.25} />
      </Instanced>
   );
}

function BustDisplays({ spots, pal }: { spots: readonly InstanceSpot[]; pal: WingPalette }) {
   const plinthGeo = useMemo(() => bustPlinthGeometry(pal), [pal]);
   const plinthSpots = useMemo(() => spots.map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY })), [spots]);
   if (spots.length === 0) return null;
   return (
      <group name="bust-displays">
         <Instanced spots={plinthSpots} name="bust-plinths">
            <primitive object={plinthGeo} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.45} metalness={0.2} />
         </Instanced>
         <InstancedModel asset={ASSETS.bust} spots={spots} fallback={<BustFallback />} />
      </group>
   );
}

function Vases({ spots, pal }: { spots: readonly InstanceSpot[]; pal: WingPalette }) {
   const geometry = useMemo(vaseGeometry, []);
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots} name="vases">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial color={pal.vase} metalness={0.6} roughness={0.35} emissive={pal.lampGlow} emissiveIntensity={0.08} />
      </Instanced>
   );
}

function Paintings({ wing }: { wing: WingTheme }) {
   const atlas = useCanvasTexture(ATLAS_W, ATLAS_H, PAINTING_DRAWERS[wing]);
   const geometry = useMemo(paintingsGeometry, []);
   return (
      <mesh geometry={geometry} name="paintings">
         <meshStandardMaterial map={atlas} emissiveMap={atlas} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.5} metalness={0.15} />
      </mesh>
   );
}

function Lamps({ pal }: { pal: WingPalette }) {
   const glow = useCanvasTexture(128, 128, drawGlow);
   const fixtures = useMemo(fixturesGeometry, []);
   const wash = useMemo(washGeometry, []);
   return (
      <>
         <mesh geometry={fixtures} name="sconces">
            <meshBasicMaterial color={pal.sconce} toneMapped={false} />
         </mesh>
         <mesh geometry={wash} name="lamp-wash" renderOrder={1}>
            <meshBasicMaterial map={glow} color={pal.lampGlow} transparent opacity={0.42} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

function Barrier({ pal }: { pal: WingPalette }) {
   const post = useMemo(postGeometry, []);
   const rope = useMemo(ropeGeometry, []);
   return (
      <group name="barrier">
         <Instanced spots={POST_SPOTS} name="barrier-posts">
            <primitive object={post} attach="geometry" />
            <meshStandardMaterial color={pal.brass} metalness={0.85} roughness={0.28} emissive={pal.trimDark} emissiveIntensity={0.25} />
         </Instanced>
         <mesh geometry={rope} name="barrier-rope">
            <meshStandardMaterial color={pal.velvet} roughness={0.75} emissive={pal.velvet} emissiveIntensity={0.25} />
         </mesh>
      </group>
   );
}

function WingArchitecture({ level }: { level: MuseumLevel }) {
   const geometry = useMemo(
      () => wingSetPieceGeometry(level.decor.setPiece, level.decor.setPieceAngles, level.palette),
      [level]
   );
   if (!geometry) return null;
   return (
      <mesh geometry={geometry} name={`setpiece-${level.decor.setPiece}`}>
         <meshStandardMaterial vertexColors roughness={0.38} metalness={0.35} emissive={level.palette.lampGlow} emissiveIntensity={0.12} />
      </mesh>
   );
}

/** Dust motes; the ones inside the live beam light up (no allocation per frame). */
function Motes({ yaw }: { yaw: { current: number } }) {
   const geometry = useMemo(() => {
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(motePositions(), 3));
      geo.setAttribute("color", new BufferAttribute(new Float32Array(MOTES * 3), 3));
      return geo;
   }, []);
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

export default function Gallery({ yaw, pedestals }: { yaw: { current: number }; pedestals?: readonly { x: number; z: number; angle: number }[] }) {
   const { config } = useMuseumLevel();
   const wing = config.wing;
   const pal = config.palette;
   const decor = config.decor;
   const floor = useCanvasTexture(1024, 1024, FLOOR_DRAWERS[wing]);
   const wall = useCanvasTexture(512, 512, WALL_DRAWERS[wing]);
   const ceiling = useCanvasTexture(512, 512, CEILING_DRAWERS[wing]);
   useRepeat(wall, WALL_TILES, 0.5);
   const { tier } = useQuality();
   const pedestalSpots = useMemo<InstanceSpot[]>(
      () =>
         (pedestals ?? Array.from({ length: RING.count }, (_, i) => makePedestal(i))).map((ped) => ({
            x: ped.x,
            y: 0,
            z: ped.z,
            rotY: ped.angle,
         })),
      [pedestals]
   );

   return (
      <group name={`gallery-${wing}`}>
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
         <Pedestals spots={pedestalSpots} pal={pal} />
         <Paintings wing={wing} />
         <Lamps pal={pal} />
         <Vases spots={decor.vaseSpots} pal={pal} />
         <Barrier pal={pal} />
         <WingArchitecture level={config} />
         <InstancedModel asset={ASSETS.door} spots={DOOR_SPOTS} fallback={<DoorFallback />} />
         {decor.sarcophagusSpots.length > 0 && (
            <InstancedModel asset={ASSETS.sarcophagus} spots={decor.sarcophagusSpots} fallback={null} />
         )}
         {decor.bustSpots.length > 0 && <BustDisplays spots={decor.bustSpots} pal={pal} />}
         {decor.chestSpots.length > 0 && <InstancedModel asset={ASSETS.chest} spots={decor.chestSpots} fallback={null} />}
         {decor.rocketSpots.length > 0 && <InstancedModel asset={ASSETS.rocket} spots={decor.rocketSpots} fallback={null} />}
         {decor.glowPodSpots.length > 0 && <InstancedModel asset={ASSETS.glowPod} spots={decor.glowPodSpots} fallback={null} />}
         {decor.cannonSpots.length > 0 && <InstancedModel asset={ASSETS.cannon} spots={decor.cannonSpots} fallback={null} />}
         {tier !== "low" &&
            decor.benchSpots.map((spot, idx) => (
               <Model
                  key={`bench-${idx}`}
                  asset={ASSETS.bench}
                  position={[spot.x, spot.y ?? 0, spot.z]}
                  rotation={[0, spot.rotY ?? 0, 0]}
                  fallback={<BenchFallback />}
               />
            ))}
         {tier !== "low" && <Motes yaw={yaw} />}
      </group>
   );
}
