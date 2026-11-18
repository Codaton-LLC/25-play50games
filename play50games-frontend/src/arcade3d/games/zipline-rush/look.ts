// Zipline Rush's look per level: one palette each, pure data (no three.js), read by World, the
// stations and index.tsx (the shell's background, fog and lighting preset).
//   L1 Training Line   fresh morning over pine headlands
//   L2 Twin Lines      golden late afternoon
//   L3 Moving Landing  bright open sea between bare rock stacks
//   L4 Lighthouse Night  moonlit night, lighthouse beams sweep the cables
//   L5 Zipline Master  storm night, violet sky, lightning, the Volt Eel's cyan glow
import type { LevelId } from "../../types";
import type { LightingPreset } from "../../core/types";

export interface ZipLook {
   lighting: LightingPreset;
   background: string;
   fog: [string, number, number];
   sky: { top: string; mid: string; horizon: string };
   /** the sun or the moon: direction (unit-ish, towards it), disc colour, glow strength */
   sun: { dir: [number, number, number]; color: string; size: number; glow: number };
   sea: { shallow: string; deep: string; foam: string; glitter: number };
   /** an extra key light on top of the shell's preset (colour, intensity) */
   key: { color: string; intensity: number };
   rim: { color: string; intensity: number };
   rock: { top: string; mid: string; base: string; cap: string };
   cable: { color: string; glow: string };
   clouds: { tint: string; opacity: number; count: number };
   stars: number;
   /** lantern / emissive accents on the stations */
   lantern: string;
   lightning: boolean;
   rain: boolean;
}

export const LOOKS: Record<LevelId, ZipLook> = {
   1: {
      lighting: "day",
      background: "#cfe6f1",
      fog: ["#cfe6f1", 90, 340],
      sky: { top: "#3f8fdc", mid: "#9ccff0", horizon: "#f4ead6" },
      sun: { dir: [-0.45, 0.42, -0.78], color: "#fff4d6", size: 0.035, glow: 0.55 },
      sea: { shallow: "#2fb6c8", deep: "#0b5b86", foam: "#effcff", glitter: 0.8 },
      key: { color: "#fff1d2", intensity: 0.35 },
      rim: { color: "#bfe6ff", intensity: 0.25 },
      rock: { top: "#c8a477", mid: "#9c7b58", base: "#5f4b3c", cap: "#6fae4c" },
      cable: { color: "#8a99a6", glow: "#38bdf8" },
      clouds: { tint: "#ffffff", opacity: 0.95, count: 26 },
      stars: 0,
      lantern: "#fde68a",
      lightning: false,
      rain: false,
   },
   2: {
      lighting: "sunset",
      background: "#f3cf9f",
      fog: ["#f0c999", 80, 320],
      sky: { top: "#3b78c4", mid: "#f2b77e", horizon: "#ffd9a3" },
      sun: { dir: [0.62, 0.16, -0.77], color: "#ffd08a", size: 0.05, glow: 0.9 },
      sea: { shallow: "#2b8fa8", deep: "#123f63", foam: "#fff3df", glitter: 1.5 },
      key: { color: "#ffc58a", intensity: 0.45 },
      rim: { color: "#ffd9b0", intensity: 0.35 },
      rock: { top: "#d6a36e", mid: "#a8724a", base: "#5a3d2f", cap: "#7c9a3e" },
      cable: { color: "#9a8a7a", glow: "#fbbf24" },
      clouds: { tint: "#ffe2c4", opacity: 0.9, count: 22 },
      stars: 0,
      lantern: "#fdba74",
      lightning: false,
      rain: false,
   },
   3: {
      lighting: "day",
      background: "#c6e7f6",
      fog: ["#c6e7f6", 85, 330],
      sky: { top: "#2a7fd6", mid: "#8bc9f2", horizon: "#e7f6fd" },
      sun: { dir: [0.3, 0.7, -0.64], color: "#ffffff", size: 0.03, glow: 0.45 },
      sea: { shallow: "#19b8c9", deep: "#05527f", foam: "#ffffff", glitter: 1.1 },
      key: { color: "#ffffff", intensity: 0.3 },
      rim: { color: "#d9f3ff", intensity: 0.3 },
      rock: { top: "#e7e3d8", mid: "#8b8f93", base: "#3f4a52", cap: "#f4f1e8" },
      cable: { color: "#94a3b8", glow: "#22d3ee" },
      clouds: { tint: "#ffffff", opacity: 0.9, count: 20 },
      stars: 0,
      lantern: "#fef08a",
      lightning: false,
      rain: false,
   },
   4: {
      lighting: "night",
      background: "#0c1a36",
      fog: ["#0e1f40", 55, 230],
      sky: { top: "#030816", mid: "#0b1a3a", horizon: "#1d3b68" },
      sun: { dir: [-0.35, 0.38, -0.86], color: "#e8f1ff", size: 0.03, glow: 0.4 },
      sea: { shallow: "#103a5e", deep: "#020a1a", foam: "#a9c9e8", glitter: 1.4 },
      key: { color: "#9fc0ff", intensity: 0.7 },
      rim: { color: "#5eead4", intensity: 0.3 },
      rock: { top: "#7d8aa6", mid: "#56627f", base: "#283246", cap: "#8a96b2" },
      cable: { color: "#1e3354", glow: "#a5f3fc" },
      clouds: { tint: "#3b4f75", opacity: 0.7, count: 16 },
      stars: 1100,
      lantern: "#fde047",
      lightning: false,
      rain: false,
   },
   5: {
      lighting: "night",
      background: "#1a1236",
      fog: ["#1c1538", 50, 210],
      sky: { top: "#07051a", mid: "#26184e", horizon: "#4a2f73" },
      sun: { dir: [0.4, 0.3, -0.86], color: "#c4b5fd", size: 0.025, glow: 0.35 },
      sea: { shallow: "#16324a", deep: "#03070f", foam: "#93c5fd", glitter: 0.9 },
      key: { color: "#a5b4fc", intensity: 0.7 },
      rim: { color: "#22d3ee", intensity: 0.45 },
      rock: { top: "#857c9e", mid: "#5a5276", base: "#29253c", cap: "#9187b0" },
      cable: { color: "#2c2a48", glow: "#67e8f9" },
      clouds: { tint: "#4c3f74", opacity: 0.85, count: 24 },
      stars: 500,
      lantern: "#67e8f9",
      lightning: true,
      rain: true,
   },
};

export const lookFor = (id: LevelId | number): ZipLook => LOOKS[(id >= 1 && id <= 5 ? id : 1) as LevelId];

/**
 * A storm flash 0..1 on L5: a double flicker every few seconds, every third cycle quiet. Visual only.
 */
export function lightningFlash(timeS: number): number {
   if (!(timeS > 0)) return 0;
   const period = 5.3;
   const n = Math.floor(timeS / period);
   if (n % 3 === 1) return 0;
   const t = timeS - n * period;
   const spike = (at: number, half: number) => {
      const d = Math.abs(t - at);
      return d >= half ? 0 : (1 - d / half) ** 2;
   };
   return Math.min(1, spike(0.1, 0.08) + 0.6 * spike(0.3, 0.06));
}
