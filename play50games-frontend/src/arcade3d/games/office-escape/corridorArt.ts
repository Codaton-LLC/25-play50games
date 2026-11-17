// Office Escape corridor art: the canvas painters for the floor, wall and end-window textures,
// one palette per department (decor.ts CorridorVariant). Pure functions, no three.js, so
// looks.test.ts can compare the palettes. The "openOffice" painters draw exactly what the live
// level 1 shipped; the other four dress the same corridor as the Meeting Floor, the Copy Room,
// the Executive Floor and the After-Hours Office (README "Level looks").
import { CORRIDOR, FLOOR_TILE, LANE_EDGE } from "./decor";
import type { CorridorVariant } from "./decor";

// ---------- palettes ----------

export interface FloorPalette {
   wood: string;
   woodSeam: string;
   tile: string;
   tileAlt: string;
}

export interface BackdropPalette {
   skyTop: string;
   skyBottom: string;
   tower: string;
   /** lit-window dots, or null for a daytime city */
   windows: string | null;
   /** a soft sun/moon disc, or null */
   orb: string | null;
}

export const FLOOR_PALETTES: Record<CorridorVariant, { palette: FloorPalette; edgeLine?: string }> = {
   openOffice: { palette: { wood: "#e8d3ad", woodSeam: "#c9ad80", tile: "#d5dde8", tileAlt: "#cbd5e1" } },
   meeting: { palette: { wood: "#cfa878", woodSeam: "#a9845a", tile: "#b6c2d4", tileAlt: "#a9b7cc" } },
   copyRoom: { palette: { wood: "#cdd5df", woodSeam: "#aab6c4", tile: "#e2e8f0", tileAlt: "#d6dee8" }, edgeLine: "#facc15" },
   executive: { palette: { wood: "#4a3626", woodSeam: "#33251a", tile: "#3a3542", tileAlt: "#322e3b" } },
   afterHours: { palette: { wood: "#5a5348", woodSeam: "#443e36", tile: "#4b5261", tileAlt: "#424959" } },
};

export const BACKDROP_PALETTES: Record<CorridorVariant, BackdropPalette> = {
   openOffice: { skyTop: "#f0f9ff", skyBottom: "#dbeafe", tower: "#c7dcf5", windows: null, orb: null },
   meeting: { skyTop: "#7cc4f0", skyBottom: "#cfe3f7", tower: "#8fb8dd", windows: null, orb: "#fef9c3" },
   copyRoom: { skyTop: "#e8eef5", skyBottom: "#c9d4e4", tower: "#b6c8dd", windows: null, orb: null },
   executive: { skyTop: "#0a1220", skyBottom: "#131f36", tower: "#22314d", windows: "#ffd166", orb: "#e8edf7" },
   afterHours: { skyTop: "#f4a63b", skyBottom: "#43304b", tower: "#2c2440", windows: "#ffe9a8", orb: "#fde68a" },
};

// ---------- floor ----------

/** One FLOOR_TILE (2 m) of track across the full corridor width; `edgeLine` paints a safety strip
 *  just outside each lane edge (the Copy Room). The openOffice palette draws the live floor. */
export function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, p: FloorPalette, edgeLine?: string) {
   // x: -halfWidth..halfWidth across the canvas, one FLOOR_TILE (2 m) of track down it
   const pxPerM = w / (CORRIDOR.halfWidth * 2);
   const u = (x: number) => (x + CORRIDOR.halfWidth) * pxPerM;
   ctx.fillStyle = p.wood;
   ctx.fillRect(0, 0, w, h);
   // wood planks outside the lanes
   ctx.fillStyle = p.woodSeam;
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
         ctx.fillStyle = odd ? p.tileAlt : p.tile;
         ctx.fillRect(u(lane), (r * h) / rows, pxPerM, h / rows);
      }
   }
   if (edgeLine) {
      // a safety line just outside each lane edge (stays out of the play area)
      ctx.fillStyle = edgeLine;
      ctx.fillRect(u(LANE_EDGE + 0.12), 0, pxPerM * 0.12, h);
      ctx.fillRect(u(-LANE_EDGE - 0.24), 0, pxPerM * 0.12, h);
   }
   ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
   for (let lane = -LANE_EDGE; lane <= LANE_EDGE + 1e-6; lane += 1) ctx.fillRect(u(lane) - 0.5, 0, 1, h);
   for (let r = 0; r < rows; r++) ctx.fillRect(u(-LANE_EDGE), (r * h) / rows, u(LANE_EDGE) - u(-LANE_EDGE), 1);
}

// ---------- wall ----------

interface WallKit {
   X: (m: number) => number;
   Y: (m: number) => number;
   rect: (x0: number, y0: number, x1: number, y1: number, color: string) => void;
}

function wallKit(ctx: CanvasRenderingContext2D, w: number, h: number): WallKit {
   // x: one 12 m treadmill period, y: floor (bottom) to the ceiling (top)
   const X = (m: number) => (m * w) / CORRIDOR.period;
   const Y = (m: number) => h - (m * h) / CORRIDOR.height;
   const rect = (x0: number, y0: number, x1: number, y1: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
   };
   return { X, Y, rect };
}

/** The live Open Office wall: glass office front, door, notice board, picture, two storeys. */
export function drawWallOpenOffice(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const { X, Y, rect } = wallKit(ctx, w, h);
   rect(0, 0, 12, CORRIDOR.height, "#f1f5f9");
   // ground floor: glass office front (4 panes), a door, a notice board and a picture
   const glass = ctx.createLinearGradient(0, Y(3.3), 0, Y(0.15));
   glass.addColorStop(0, "#93c5fd");
   glass.addColorStop(1, "#bfdbfe");
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
   for (const x of [0.8, 2.0, 3.2, 4.4, 5.6]) rect(x - 0.04, 0.15, x + 0.04, 3.3, "#ffffff");
   rect(0.8, 3.26, 5.6, 3.34, "#ffffff");
   rect(0.8, 1.05, 5.6, 1.1, "rgba(255, 255, 255, 0.8)");
   // door with a frame, a handle and a coloured sign
   rect(6.25, 0, 7.45, 2.45, "#cbd5e1");
   rect(6.33, 0, 7.37, 2.37, "#0f766e");
   rect(7.15, 1.05, 7.25, 1.2, "#e2e8f0");
   rect(6.6, 2.65, 7.1, 2.95, "#fbbf24");
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
   upperStorey(ctx, w, h, { band: "#e0f2fe", mullion: "#94a3b8", skyTop: "#7dd3fc", skyBottom: "#bfdbfe" });
}

/** The shared upper storey: office windows over a glass railing, a cove under the ceiling. */
function upperStorey(ctx: CanvasRenderingContext2D, w: number, h: number, p: { band: string; mullion: string; skyTop: string; skyBottom: string }) {
   const { rect } = wallKit(ctx, w, h);
   rect(0, 3.62, 12, 3.7, "#cbd5e1");
   rect(0, 4.0, 12, 4.14, "#fbbf24");
   rect(0, 4.4, 12, 5.0, "#e2e8f0");
   rect(0, 4.4, 12, 4.48, "#94a3b8");
   rect(0, 5.0, 12, 6.0, p.band);
   for (let x = 0.5; x < 12; x += 1.5) rect(x - 0.03, 5.0, x + 0.03, 6.0, p.mullion);
   rect(0, 5.97, 12, 6.05, "#64748b");
   const upper = ctx.createLinearGradient(0, wallKit(ctx, w, h).Y(8.8), 0, wallKit(ctx, w, h).Y(6.3));
   upper.addColorStop(0, p.skyTop);
   upper.addColorStop(1, p.skyBottom);
   ctx.fillStyle = upper;
   ctx.fillRect(wallKit(ctx, w, h).X(0), wallKit(ctx, w, h).Y(8.8), w, wallKit(ctx, w, h).Y(6.3) - wallKit(ctx, w, h).Y(8.8));
   for (let x = 0; x <= 12; x += 1.5) rect(x - 0.05, 6.3, x + 0.05, 8.8, "#ffffff");
   rect(0, 7.45, 12, 7.5, "#ffffff");
   rect(0, 8.8, 12, CORRIDOR.height, "#e2e8f0");
}

/** Level 2 wall: floor-to-ceiling glass meeting rooms with tables and chairs behind the panes. */
function drawWallMeeting(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const { X, Y, rect } = wallKit(ctx, w, h);
   rect(0, 0, 12, CORRIDOR.height, "#f5f1ea");
   rect(0, 0, 12, 0.15, "#475569");
   rect(0, 3.62, 12, 3.7, "#cbd5e1");
   rect(0, 4.0, 12, 4.14, "#0d9488");
   // meeting rooms behind glass: tables, chair backs and a whiteboard inside
   const glass = ctx.createLinearGradient(0, Y(3.4), 0, Y(0.1));
   glass.addColorStop(0, "#99e3d8");
   glass.addColorStop(1, "#d9f3ee");
   ctx.fillStyle = glass;
   ctx.fillRect(X(0.6), Y(3.4), X(7.4) - X(0.6), Y(0.1) - Y(3.4));
   ctx.fillStyle = "rgba(69, 85, 105, 0.55)";
   for (const x0 of [1.2, 4.0]) {
      // a meeting table with chairs either side
      rect(x0, 0.85, x0 + 2.0, 1.0, "rgba(120, 90, 60, 0.75)");
      rect(x0 + 0.2, 0.55, x0 + 0.6, 0.85, "rgba(69, 85, 105, 0.65)");
      rect(x0 + 1.4, 0.55, x0 + 1.8, 0.85, "rgba(69, 85, 105, 0.65)");
      rect(x0 + 0.7, 1.0, x0 + 1.3, 1.3, "rgba(69, 85, 105, 0.65)");
   }
   rect(6.2, 1.7, 7.6, 2.9, "rgba(255, 255, 255, 0.9)");
   ctx.strokeStyle = "rgba(13, 148, 136, 0.8)";
   ctx.lineWidth = Math.max(1, w / 1024);
   ctx.beginPath();
   ctx.moveTo(X(6.4), Y(2.0));
   ctx.lineTo(X(6.9), Y(2.4));
   ctx.lineTo(X(7.3), Y(2.1));
   ctx.stroke();
   for (const x of [0.6, 2.6, 4.6, 6.6]) rect(x - 0.05, 0.1, x + 0.05, 3.4, "#ffffff");
   rect(0.6, 3.36, 7.6, 3.44, "#ffffff");
   // a wooden door with a tall glass slit
   rect(8.2, 0, 9.4, 2.45, "#a16207");
   rect(8.45, 0.5, 9.15, 2.1, "#7dd3fc");
   rect(9.05, 1.05, 9.15, 1.2, "#e2e8f0");
   // framed KPI poster
   rect(10.0, 1.3, 11.4, 2.3, "#0d9488");
   rect(10.06, 1.36, 11.34, 2.24, "#f8fafc");
   ctx.fillStyle = "#0d9488";
   for (let i = 0; i < 4; i++) rect(10.3 + i * 0.25, 1.45, 10.42 + i * 0.25, 1.45 + 0.18 * (i + 1), "#0d9488");
   upperStorey(ctx, w, h, { band: "#fef3c7", mullion: "#94a3b8", skyTop: "#fcd34d", skyBottom: "#e0f2fe" });
}

/** Level 3 wall: a working copy room — copiers, stocked shelves, charts, safety yellow. */
function drawWallCopyRoom(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const { X, Y, rect } = wallKit(ctx, w, h);
   rect(0, 0, 12, CORRIDOR.height, "#e2e8f0");
   rect(0, 0, 12, 0.15, "#334155");
   rect(0, 0.45, 12, 0.55, "#facc15");
   // a wide copier with paper trays and a glowing control panel
   rect(0.8, 0, 2.9, 1.3, "#94a3b8");
   rect(0.9, 1.3, 2.8, 1.5, "#cbd5e1");
   rect(1.1, 0.55, 2.6, 0.75, "#64748b");
   rect(2.35, 0.95, 2.75, 1.25, "#0f172a");
   rect(2.4, 1.0, 2.7, 1.2, "#5eead4");
   // a stocked shelf: paper reams in muted box colours
   rect(3.8, 0, 7.4, 2.1, "#94a3b8");
   for (const y of [0.7, 1.4]) rect(3.86, y, 7.34, y + 0.06, "#64748b");
   const reams = ["#f8fafc", "#e0e7ef", "#fef9c3", "#dbe7f3", "#f8fafc", "#e2e8f0"];
   reams.forEach((c, i) => {
      const x = 4.0 + i * 0.55;
      rect(x, 0.06, x + 0.45, 0.68, c);
      rect(x + 0.1, 0.76, x + 0.5, 1.38, c);
      rect(x, 1.46, x + 0.42, 2.06, c);
   });
   // production charts on a bulletin board
   rect(8.2, 1.3, 9.9, 2.4, "#b45309");
   rect(8.26, 1.36, 9.84, 2.34, "#e7d7bd");
   ctx.strokeStyle = "#b91c1c";
   ctx.lineWidth = Math.max(1, w / 1024);
   ctx.beginPath();
   ctx.moveTo(X(8.4), Y(1.6));
   ctx.lineTo(X(8.8), Y(2.0));
   ctx.lineTo(X(9.2), Y(1.8));
   ctx.lineTo(X(9.6), Y(2.2));
   ctx.stroke();
   rect(8.5, 1.44, 8.9, 1.56, "#f8fafc");
   // a swing door with a porthole window
   rect(10.4, 0, 11.6, 2.45, "#cbd5e1");
   rect(10.48, 0, 11.52, 2.37, "#64748b");
   ctx.fillStyle = "#bfdbfe";
   ctx.beginPath();
   ctx.arc(X(11.0), Y(1.7), w * 0.012, 0, Math.PI * 2);
   ctx.fill();
   // plain industrial upper storey with vents
   rect(0, 3.62, 12, 3.7, "#cbd5e1");
   rect(0, 4.4, 12, 5.0, "#e2e8f0");
   rect(0, 4.4, 12, 4.48, "#94a3b8");
   rect(0, 5.0, 12, 6.0, "#dbe3ec");
   for (let x = 1.0; x < 12; x += 2.5) rect(x - 0.35, 5.3, x + 0.35, 5.7, "#b6c2d0");
   rect(0, 6.3, 12, 8.8, "#d3dce6");
   for (let x = 0; x <= 12; x += 1.5) rect(x - 0.03, 6.3, x + 0.03, 8.8, "#94a3b8");
   rect(0, 8.8, 12, CORRIDOR.height, "#e2e8f0");
}

/** Level 4 wall: the executive floor at night — walnut panels, library, portrait, uplights. */
function drawWallExecutive(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const { X, Y, rect } = wallKit(ctx, w, h);
   rect(0, 0, 12, CORRIDOR.height, "#3f2f23");
   // walnut panelling seams and a brass rail
   ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
   for (let x = 1.5; x < 12; x += 1.5) ctx.fillRect(X(x), Y(3.6), Math.max(1, w * 0.002), Y(0.15) - Y(3.6));
   rect(0, 0, 12, 0.15, "#1c1917");
   rect(0, 1.0, 12, 1.08, "#d4a53f");
   // the library: dark shelves with muted book spines
   rect(0.7, 0.15, 4.9, 3.5, "#292019");
   const spines = ["#7f1d1d", "#78350f", "#1e3a8a", "#14532d", "#713f12", "#3f3f46"];
   for (let shelf = 0; shelf < 3; shelf++) {
      const y0 = 0.35 + shelf * 1.05;
      rect(0.85, y0 + 0.82, 4.75, y0 + 0.9, "#171310");
      for (let i = 0; i < 14; i++) {
         const x = 0.9 + i * 0.28;
         rect(x, y0, x + 0.2, y0 + 0.8, spines[(i + shelf * 3) % spines.length]);
      }
   }
   // a gilt portrait with an amber abstract
   rect(5.7, 1.2, 7.3, 2.8, "#d4a53f");
   rect(5.78, 1.28, 7.22, 2.72, "#1c1917");
   ctx.fillStyle = "#b45309";
   ctx.beginPath();
   ctx.moveTo(X(5.9), Y(1.5));
   ctx.quadraticCurveTo(X(6.5), Y(2.6), X(7.1), Y(1.7));
   ctx.lineTo(X(7.1), Y(1.4));
   ctx.closePath();
   ctx.fill();
   // a dark executive door with a brass handle
   rect(8.1, 0, 9.5, 2.5, "#1c1917");
   rect(8.2, 0.1, 9.4, 2.4, "#292019");
   rect(9.05, 1.1, 9.2, 1.25, "#d4a53f");
   // uplight cones over the pedestals
   ctx.fillStyle = "rgba(255, 217, 138, 0.16)";
   for (const x of [10.6, 11.5]) {
      ctx.beginPath();
      ctx.moveTo(X(x - 0.35), Y(3.6));
      ctx.lineTo(X(x), Y(1.2));
      ctx.lineTo(X(x + 0.35), Y(3.6));
      ctx.closePath();
      ctx.fill();
   }
   // dark upper storey with warm downlights
   rect(0, 3.62, 12, 3.7, "#171310");
   rect(0, 4.0, 12, 4.14, "#d4a53f");
   rect(0, 4.4, 12, 5.0, "#241b14");
   ctx.fillStyle = "rgba(255, 217, 138, 0.12)";
   for (const x of [1.5, 4.5, 7.5, 10.5]) {
      ctx.beginPath();
      ctx.moveTo(X(x - 0.5), Y(5.0));
      ctx.lineTo(X(x), Y(8.8));
      ctx.lineTo(X(x + 0.5), Y(5.0));
      ctx.closePath();
      ctx.fill();
   }
   rect(0, 6.3, 12, 8.8, "#1c1611");
   for (let x = 0; x <= 12; x += 1.5) rect(x - 0.04, 6.3, x + 0.04, 8.8, "#3f2f23");
   rect(0, 8.8, 12, CORRIDOR.height, "#171310");
}

/** Level 5 wall: after hours — dark cubicle glow, an EXIT sign, city windows up top. */
function drawWallAfterHours(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const { Y, rect } = wallKit(ctx, w, h);
   rect(0, 0, 12, CORRIDOR.height, "#2b3444");
   rect(0, 0, 12, 0.15, "#0f172a");
   // cubicle row behind a low glass wall: desks and glowing monitors
   rect(0.7, 0.15, 7.4, 1.0, "#3b4657");
   const monitors = ["#5eead4", "#93c5fd", "#fde68a", "#5eead4", "#a5b4fc", "#93c5fd"];
   monitors.forEach((c, i) => {
      const x = 1.1 + i * 1.05;
      rect(x, 0.15, x + 0.55, 0.42, "#1f2937");
      rect(x + 0.06, 0.19, x + 0.49, 0.38, c);
   });
   const glass = ctx.createLinearGradient(0, Y(1.6), 0, Y(0.15));
   glass.addColorStop(0, "rgba(148, 163, 184, 0.5)");
   glass.addColorStop(1, "rgba(203, 213, 225, 0.25)");
   ctx.fillStyle = glass;
   ctx.fillRect(X(0.7), Y(1.6), X(7.4) - X(0.7), Y(0.15) - Y(1.6));
   rect(0.7, 1.56, 7.4, 1.6, "#94a3b8");
   // EXIT sign and a dark stairwell door
   rect(8.0, 2.5, 8.6, 2.85, "#052e16");
   rect(8.06, 2.56, 8.54, 2.79, "#4ade80");
   rect(8.9, 0, 10.1, 2.45, "#1f2937");
   rect(9.95, 1.05, 10.05, 1.2, "#64748b");
   // a dark vending corner with one lit strip
   rect(10.7, 0, 11.9, 2.2, "#111827");
   rect(10.8, 0.3, 11.8, 0.5, "#38bdf8");
   // dim upper storey: night windows with scattered lit panes
   rect(0, 3.62, 12, 3.7, "#1a2230");
   rect(0, 4.4, 12, 5.0, "#232c3c");
   rect(0, 6.3, 12, 8.8, "#0b1120");
   for (let x = 0; x <= 12; x += 1.5) rect(x - 0.05, 6.3, x + 0.05, 8.8, "#39424f");
   rect(0, 7.45, 12, 7.5, "#39424f");
   let lit = 0;
   for (let x = 0.2; x < 11.8; x += 0.4) {
      for (let y = 6.5; y < 8.6; y += 0.5) {
         if ((lit++ * 7) % 11 < 3) rect(x, y, x + 0.22, y + 0.3, "#ffd166");
      }
   }
   rect(0, 8.8, 12, CORRIDOR.height, "#151b26");
}

const WALL_PAINTERS: Record<CorridorVariant, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
   openOffice: drawWallOpenOffice,
   meeting: drawWallMeeting,
   copyRoom: drawWallCopyRoom,
   executive: drawWallExecutive,
   afterHours: drawWallAfterHours,
};

/** Paints one 12 m period of the given department's wall. */
export function drawWall(variant: CorridorVariant, ctx: CanvasRenderingContext2D, w: number, h: number) {
   WALL_PAINTERS[variant](ctx, w, h);
}

// ---------- backdrop (the end window; drawn through the fog) ----------

/** The city at the end of the corridor: daytime haze for 1-3, lit towers at night, sunset for 5. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, p: BackdropPalette) {
   const sky = ctx.createLinearGradient(0, 0, 0, h);
   sky.addColorStop(0, p.skyTop);
   sky.addColorStop(1, p.skyBottom);
   ctx.fillStyle = sky;
   ctx.fillRect(0, 0, w, h);
   if (p.orb) {
      ctx.fillStyle = p.orb;
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.26, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.fillStyle = p.tower;
   const towers = [0.05, 0.12, 0.2, 0.31, 0.38, 0.47, 0.58, 0.66, 0.74, 0.83, 0.9];
   towers.forEach((x, i) => {
      const top = h * (0.45 + ((i * 37) % 23) / 100);
      const tw = w * (0.05 + ((i * 13) % 5) / 100);
      ctx.fillRect(x * w, top, tw, h - top);
      if (p.windows) {
         ctx.fillStyle = p.windows;
         for (let wy = top + h * 0.03; wy < h * 0.94; wy += h * 0.055) {
            for (let wx = x * w + w * 0.008; wx < x * w + tw - w * 0.01; wx += w * 0.02) {
               if (((wx * 13 + wy * 7) | 0) % 3 === 0) ctx.fillRect(wx, wy, w * 0.01, h * 0.025);
            }
         }
         ctx.fillStyle = p.tower;
      }
   });
   ctx.fillStyle = "#ffffff";
   for (let x = 0; x <= w; x += w / 4) ctx.fillRect(x - 3, 0, 6, h);
   ctx.fillRect(0, h * 0.3, w, 5);
}
