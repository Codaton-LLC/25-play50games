// Mirror Dash's look per level (World 5, Neon Cosmos): a hall of mirrors hung in violet space; each
// zone has its own wall (mirror = violet glass, merge = no wall, frosted = milky white, echo = a pulsing
// magenta). Pure data.
import type { LevelId } from "../../types";
import type { LightingPreset } from "../../core/types";
import type { Zone } from "./levels";

export interface MirrorLook {
   lighting: LightingPreset;
   background: string;
   fog: [string, number, number];
   floor: string;
   accent: string;
   sky: string;
   ambient: number;
}

export const LOOKS: Record<LevelId, MirrorLook> = {
   1: { lighting: "night", background: "#1a1033", fog: ["#1a1033", 40, 130], floor: "#2a1f4d", accent: "#a78bfa", sky: "#3b2a6b", ambient: 0.7 },
   2: { lighting: "night", background: "#120f2e", fog: ["#120f2e", 40, 125], floor: "#241c48", accent: "#818cf8", sky: "#2e2a6b", ambient: 0.66 },
   3: { lighting: "night", background: "#1b1d33", fog: ["#1b1d33", 36, 120], floor: "#2b2f4f", accent: "#c7d2fe", sky: "#3c4270", ambient: 0.7 },
   4: { lighting: "night", background: "#1f0d2b", fog: ["#1f0d2b", 36, 120], floor: "#2f1840", accent: "#e879f9", sky: "#4a1d5e", ambient: 0.64 },
   5: { lighting: "night", background: "#0d0a1f", fog: ["#0d0a1f", 34, 115], floor: "#1c1638", accent: "#c4b5fd", sky: "#251b4d", ambient: 0.6 },
};

export const lookFor = (id: LevelId | number): MirrorLook => LOOKS[(id >= 1 && id <= 5 ? id : 1) as LevelId];

/** the mirror wall's tone per zone */
export const ZONE_WALL: Record<Zone, { color: string; opacity: number; emissive: number }> = {
   mirror: { color: "#c4b5fd", opacity: 0.42, emissive: 0.35 },
   merge: { color: "#c4b5fd", opacity: 0, emissive: 0 },
   frost: { color: "#f1f5f9", opacity: 0.8, emissive: 0.2 },
   echo: { color: "#f0abfc", opacity: 0.5, emissive: 0.8 },
};

export const ZONE_LABEL: Record<Zone, string> = { mirror: "Mirror", merge: "Merge", frost: "Frosted: copy", echo: "Echo: 0.5 s late" };
