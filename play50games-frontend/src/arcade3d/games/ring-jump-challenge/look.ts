"use client";

// Ring Jump Challenge's look: World 2's airy sea canyon (sandstone strata warm at the rim, cool teal
// towards the sea, cerulean sky above, soft depth fog), one palette per level mood (bright day for
// 1-3, a gold late afternoon for 4, Cyclone Ray's storm for 5), and the canvas textures (rock strata,
// soft glow, the water's sparkle). Textures are drawn once per mount and disposed with their component.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#8fc9ef",
   fog: "#a9d6ee",
   skyTop: "#5aa9e6",
   skyBottom: "#d9f1ff",
   rockTop: "#e7c79a",
   rockMid: "#c9a27a",
   rockLow: "#6f8f94",
   rockDeep: "#3f6b78",
   pocket: "#3b2f2a",
   sea: "#1aa3b8",
   seaDeep: "#0b5d74",
   foam: "#f0fbff",
   ring: "#f2f8ff",
   ringCentre: "#fff3b0",
   ringNext: "#7ef9ff",
   speed: "#ff9a3c",
   gold: "#ffd34d",
   bonus: "#c4b5fd",
   orb: "#ffe27a",
   updraft: "#e0fbff",
   storm: "#a78bfa",
   ghost: "#c4b5fd",
   seal: "#d6b98c",
   lightning: "#e9d5ff",
   pad: "#fef3c7",
   bull: "#f97316",
   pool: "#7dd3fc",
} as const;

export interface LevelLook {
   background: string;
   fog: [string, number, number];
   lighting: "day" | "sunset" | "night";
   /** the strata tints (rim, middle, low, deep) */
   rock: [string, string, string, string];
   sea: string;
   skyTop: string;
   skyBottom: string;
}

const DAY: LevelLook = {
   background: COLORS.background,
   fog: [COLORS.fog, 60, 260],
   lighting: "day",
   rock: [COLORS.rockTop, COLORS.rockMid, COLORS.rockLow, COLORS.rockDeep],
   sea: COLORS.sea,
   skyTop: COLORS.skyTop,
   skyBottom: COLORS.skyBottom,
};

export const LOOKS: Record<LevelId, LevelLook> = {
   1: DAY,
   2: { ...DAY, fog: ["#a3d3ee", 60, 250] },
   3: { ...DAY, fog: ["#b2e0ef", 55, 240], sea: "#20b3b8" },
   4: {
      background: "#f2c48f",
      fog: ["#efc79c", 50, 220],
      lighting: "sunset",
      rock: ["#f0b77a", "#c98a5c", "#7d6f7a", "#3e4f6b"],
      sea: "#2a8fae",
      skyTop: "#f59e6b",
      skyBottom: "#ffe7c2",
   },
   5: {
      background: "#5b5a93",
      fog: ["#6f6aa8", 45, 200],
      lighting: "sunset",
      rock: ["#a99ac2", "#7d6f9f", "#4b5c7d", "#28385a"],
      sea: "#2c5d8a",
      skyTop: "#3b3779",
      skyBottom: "#a99ad6",
   },
};

/** The level's environment for the shell (background, fog, lighting preset). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = LOOKS[id];
   return { background: l.background, fog: l.fog, lighting: l.lighting };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
   const c = document.createElement("canvas");
   c.width = w;
   c.height = h;
   return [c, c.getContext("2d")!];
}

function finish(c: HTMLCanvasElement, srgb = true, repeat = false): CanvasTexture {
   const t = new CanvasTexture(c);
   if (srgb) t.colorSpace = SRGBColorSpace;
   if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
   t.needsUpdate = true;
   return t;
}

/**
 * Sandstone strata: horizontal bands of light and dark grain with cracks and weathered streaks,
 * grey-white so the vertex colours tint it. Tiles in both directions.
 */
export function rockTexture(): CanvasTexture {
   const [c, g] = canvas(256, 256);
   let s = 90210;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   g.fillStyle = "#d8d4ce";
   g.fillRect(0, 0, 256, 256);
   // the strata
   let y = 0;
   while (y < 256) {
      const h = 6 + rnd() * 22;
      const v = 175 + Math.floor(rnd() * 70);
      g.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      g.fillRect(0, y, 256, h);
      g.fillStyle = "rgba(60,45,35,0.25)";
      g.fillRect(0, y + h - 1.5, 256, 1.5);
      y += h;
   }
   // grain
   for (let i = 0; i < 1600; i++) {
      const v = Math.floor(rnd() * 255);
      g.fillStyle = `rgba(${v},${v},${v},${0.06 + rnd() * 0.08})`;
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 2);
   }
   // vertical weather streaks and cracks
   for (let i = 0; i < 26; i++) {
      const x = rnd() * 256;
      const top = rnd() * 256;
      const len = 30 + rnd() * 120;
      g.strokeStyle = `rgba(70,55,45,${0.12 + rnd() * 0.22})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      g.moveTo(x, top);
      let cx = x;
      for (let k = 0; k < 6; k++) {
         cx += (rnd() - 0.5) * 8;
         g.lineTo(cx, top + ((k + 1) * len) / 6);
      }
      g.stroke();
   }
   // tile the top edge into the bottom
   const fade = g.getImageData(0, 0, 256, 12);
   g.putImageData(fade, 0, 244);
   return finish(c, true, true);
}

/** A round soft glow (white; tinted by the material). */
export function glowTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
   grad.addColorStop(0, "rgba(255,255,255,1)");
   grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
   grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(0, 0, 128, 128);
   return finish(c, false);
}

/** A soft ring (the guide outline and the pad's target rings): white on transparent. */
export function ringTexture(): CanvasTexture {
   const [c, g] = canvas(256, 256);
   for (let k = 0; k < 3; k++) {
      g.strokeStyle = `rgba(255,255,255,${k === 1 ? 1 : 0.35})`;
      g.lineWidth = k === 1 ? 10 : 22;
      g.beginPath();
      g.arc(128, 128, 110, 0, Math.PI * 2);
      g.stroke();
   }
   return finish(c, false);
}

/** The target pad's face: rings round a bull's-eye (sRGB, tinted by nothing). */
export function targetTexture(): CanvasTexture {
   const [c, g] = canvas(256, 256);
   const bands = ["#fef3c7", "#38bdf8", "#fef3c7", "#38bdf8", "#fef3c7", "#f97316"];
   for (let k = 0; k < bands.length; k++) {
      g.fillStyle = bands[k];
      g.beginPath();
      g.arc(128, 128, 126 - k * 22, 0, Math.PI * 2);
      g.fill();
   }
   g.strokeStyle = "rgba(30,41,59,0.55)";
   g.lineWidth = 3;
   for (let k = 0; k < bands.length; k++) {
      g.beginPath();
      g.arc(128, 128, 126 - k * 22, 0, Math.PI * 2);
      g.stroke();
   }
   return finish(c, true);
}

/** Sea sparkle: soft caustic cells (white on transparent, repeats). */
export function waterTexture(): CanvasTexture {
   const [c, g] = canvas(256, 256);
   let s = 4242;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   g.clearRect(0, 0, 256, 256);
   for (let i = 0; i < 90; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 3 + rnd() * 9;
      g.strokeStyle = `rgba(255,255,255,${0.08 + rnd() * 0.2})`;
      g.lineWidth = 0.8 + rnd() * 1.2;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.4 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
      g.stroke();
   }
   return finish(c, false, true);
}

/** A vertical streak (updraft and wind lines): white fading at both ends. */
export function streakTexture(): CanvasTexture {
   const [c, g] = canvas(16, 128);
   const grad = g.createLinearGradient(0, 0, 0, 128);
   grad.addColorStop(0, "rgba(255,255,255,0)");
   grad.addColorStop(0.5, "rgba(255,255,255,0.9)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(4, 0, 8, 128);
   return finish(c, false);
}
