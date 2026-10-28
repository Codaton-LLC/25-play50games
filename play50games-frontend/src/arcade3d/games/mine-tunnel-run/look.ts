// Mine Tunnel Run's look per level: one palette each (pure data, no three.js).
//   L1 Dry Tunnel        warm amber soil, dusty lantern light
//   L2 Pipe Zone         sooty iron-brown, cold blue rail light
//   L3 Water Gaps        damp clay and teal water glints
//   L4 Fast Tunnel       red-brown dust, the rockfall's grey haze
//   L5 Deep Mine Sprint  dark basalt, the ore veins glowing red
// W1's drained world: red shows only where the player touches or restores things (ore, lanterns).
import type { LevelId } from "../../types";
import type { LightingPreset } from "../../core/types";

export interface MineLook {
   lighting: LightingPreset;
   background: string;
   fog: [string, number, number];
   /** the surface sky (top to horizon) */
   sky: { top: string; horizon: string };
   soil: { soft: string; softDark: string; packed: string; packedDark: string };
   rock: { base: string; dark: string; line: string };
   back: string;
   ore: string;
   water: string;
   /** the hero's torch and the lanterns */
   torch: string;
   lantern: string;
   ambient: number;
   dust: string;
}

export const LOOKS: Record<LevelId, MineLook> = {
   1: {
      lighting: "day",
      background: "#1a120c",
      fog: ["#1a120c", 22, 70],
      sky: { top: "#6aa6d8", horizon: "#f2d6a6" },
      soil: { soft: "#9a6a3f", softDark: "#6e4626", packed: "#6b4a30", packedDark: "#4a3220" },
      rock: { base: "#6e6a66", dark: "#4a4744", line: "#8c8782" },
      back: "#2a1c12",
      ore: "#ff3b1f",
      water: "#2aa6c4",
      torch: "#ffd8a0",
      lantern: "#ffb347",
      ambient: 0.32,
      dust: "#c49a6c",
   },
   2: {
      lighting: "day",
      background: "#14110f",
      fog: ["#14110f", 22, 68],
      sky: { top: "#5f8fc0", horizon: "#e6c9a0" },
      soil: { soft: "#8a6446", softDark: "#5e4230", packed: "#5c4636", packedDark: "#3e2f25" },
      rock: { base: "#5f6266", dark: "#3d4044", line: "#868a8f" },
      back: "#1f1913",
      ore: "#ff4a26",
      water: "#2a9fc0",
      torch: "#ffe0b0",
      lantern: "#ffbe5c",
      ambient: 0.3,
      dust: "#a88768",
   },
   3: {
      lighting: "day",
      background: "#0e1414",
      fog: ["#0e1414", 20, 64],
      sky: { top: "#5d97c4", horizon: "#d9dcc4" },
      soil: { soft: "#80684c", softDark: "#56442f", packed: "#5a4b3a", packedDark: "#3b3126" },
      rock: { base: "#596366", dark: "#394244", line: "#7e8a8d" },
      back: "#18201e",
      ore: "#ff4d2e",
      water: "#33c3d8",
      torch: "#ffe6c0",
      lantern: "#ffc266",
      ambient: 0.3,
      dust: "#9a8a72",
   },
   4: {
      lighting: "sunset",
      background: "#1c0f0b",
      fog: ["#21130e", 18, 60],
      sky: { top: "#7a5a8c", horizon: "#f0a46a" },
      soil: { soft: "#a0603a", softDark: "#6e3e24", packed: "#6e4330", packedDark: "#4a2a1d" },
      rock: { base: "#6a5f5a", dark: "#463d39", line: "#8d817a" },
      back: "#2a160e",
      ore: "#ff3a1a",
      water: "#2aa6c4",
      torch: "#ffd2a0",
      lantern: "#ffaa44",
      ambient: 0.3,
      dust: "#b07a56",
   },
   5: {
      lighting: "night",
      background: "#0d0808",
      fog: ["#120a09", 18, 58],
      sky: { top: "#2a2240", horizon: "#7a3b2e" },
      soil: { soft: "#6e4a36", softDark: "#4a2f22", packed: "#4e3a30", packedDark: "#33251e" },
      rock: { base: "#4c4747", dark: "#2e2a2a", line: "#6e6767" },
      back: "#170e0c",
      ore: "#ff2a12",
      water: "#2a9fc0",
      torch: "#ffcf9a",
      lantern: "#ff8a3d",
      ambient: 0.26,
      dust: "#8f6a56",
   },
};

export const lookFor = (id: LevelId | number): MineLook => LOOKS[(id >= 1 && id <= 5 ? id : 1) as LevelId];
