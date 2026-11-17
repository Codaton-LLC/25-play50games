// The seven toy kinds' signs: a colour, a frame shape and a silhouette, all as SVG path data in a
// 64 x 64 box. The shelf signs and the carried-toy plate draw them on a canvas (Path2D); the game
// HUD draws the same data as SVG, so a sign, a plate and a legend chip always agree. Colour alone
// fails on the night levels: the shape and the silhouette carry the kind. Pure data, no three.js.
import type { Category } from "./levels";

export interface Glyph {
   color: string;
   /** the frame: a closed outline that fits 4..60 */
   shape: string;
   shapeName: string;
   /** the toy's silhouette, filled */
   icon: string;
   label: string;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const GLYPHS: Record<Category, Glyph> = {
   teddy: {
      color: "#f59e0b",
      shapeName: "circle",
      shape: circle(32, 32, 28),
      icon: `${circle(32, 24, 10)}${circle(23, 14, 5)}${circle(41, 14, 5)}${circle(32, 45, 12)}`,
      label: "Bears",
   },
   car: {
      color: "#ef4444",
      shapeName: "square",
      shape: "M5 5h54v54H5z",
      icon: `M9 36h46v12H9zM16 36l7-13h18l7 13z${circle(21, 49, 6)}${circle(43, 49, 6)}`,
      label: "Cars",
   },
   airplane: {
      color: "#38bdf8",
      shapeName: "triangle",
      shape: "M32 4L60 58H4z",
      icon: "M32 22l3 12 14 7v4l-14 -3 -1 7 5 4v3l-7 -2 -7 2v-3l5 -4 -1 -7 -14 3v-4l14 -7z",
      label: "Planes",
   },
   ball: {
      color: "#22c55e",
      shapeName: "diamond",
      shape: "M32 3L61 32L32 61L3 32z",
      icon: `${circle(32, 32, 14)}`,
      label: "Balls",
   },
   blocks: {
      color: "#a855f7",
      shapeName: "hexagon",
      shape: "M32 3L57 17.5V46.5L32 61L7 46.5V17.5z",
      icon: "M15 36h15v15H15zM34 36h15v15H34zM24.5 20h15v15h-15z",
      label: "Blocks",
   },
   train: {
      color: "#14b8a6",
      shapeName: "star",
      shape: "M32 3l8 18 20 2-15 13 5 20-18-10-18 10 5-20L4 23l20-2z",
      icon: `M13 30h20v14H13zM33 35h13v9H33zM16 22h7v8h-7z${circle(20, 47, 4)}${circle(40, 47, 4)}`,
      label: "Trains",
   },
   robot: {
      color: "#eab308",
      shapeName: "pentagon",
      shape: "M32 4L60 25L49 58H15L4 25z",
      icon: "M30 14h4v6h-4zM21 20h22v14H21zM17 37h30v14H17zM11 38h5v12h-5zM48 38h5v12h-5z",
      label: "Robots",
   },
};

export const SIGN_CELL = 128;
export const SIGN_ATLAS_W = SIGN_CELL * 8;

/** Draws the eight atlas cells: the seven signs, then a blank. Canvas only. */
export function drawSigns(ctx: CanvasRenderingContext2D, width: number, height: number, order: readonly Category[]): void {
   ctx.clearRect(0, 0, width, height);
   order.forEach((cat, i) => {
      const g = GLYPHS[cat];
      const x = i * SIGN_CELL;
      const s = SIGN_CELL / 64;
      ctx.save();
      ctx.translate(x, 0);
      ctx.fillStyle = g.color;
      const r = 14;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(SIGN_CELL, 0, SIGN_CELL, SIGN_CELL, r);
      ctx.arcTo(SIGN_CELL, SIGN_CELL, 0, SIGN_CELL, r);
      ctx.arcTo(0, SIGN_CELL, 0, 0, r);
      ctx.arcTo(0, 0, SIGN_CELL, 0, r);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill(new Path2D(g.shape), "nonzero");
      ctx.save();
      ctx.scale(s, s);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.lineJoin = "round";
      ctx.stroke(new Path2D(g.shape));
      ctx.restore();
      ctx.save();
      ctx.translate(SIGN_CELL * 0.17, SIGN_CELL * 0.17);
      ctx.scale(s * 0.66, s * 0.66);
      ctx.fillStyle = "#ffffff";
      ctx.fill(new Path2D(g.icon));
      ctx.restore();
      ctx.restore();
   });
}
