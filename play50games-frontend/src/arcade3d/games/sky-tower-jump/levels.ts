// Sky Tower Jump's five levels: pure data (no React, no three.js). core/README.md "Levels".
// Level 1 "Training Sky" is the vertical slice and fully built. Levels 2-5 are PLACEHOLDERS for the
// sign-off: the same course (rules.ts COURSE) with harder constants only (faster and longer moving
// platforms, narrower landings, a shorter clock). Their own layouts, hazards and looks come after the
// user signs the slice off (README "Levels").
import type { LevelId } from "@/arcade3d/types";

export interface SkyLevel {
   id: LevelId;
   /** the plan's level name (meta.ts titles) */
   name: string;
   /** run clock cap (ms): reaching it ends the run "timeup" (unranked). The plan's timer. */
   durationMs: number;
   /** moving platforms: travel x this, period x this (smaller = faster) */
   travelScale: number;
   periodScale: number;
   /** landing size of every platform but the start, the checkpoints and the goal (x this) */
   platformScale: number;
   /** placeholder level (same course as level 1, harder constants) */
   placeholder: boolean;
}

export const LEVELS: Record<LevelId, SkyLevel> = {
   1: { id: 1, name: "Training Sky", durationMs: 90_000, travelScale: 1, periodScale: 1, platformScale: 1, placeholder: false },
   2: { id: 2, name: "Cloud Steps", durationMs: 90_000, travelScale: 1.2, periodScale: 0.9, platformScale: 0.95, placeholder: true },
   3: { id: 3, name: "Moving Platforms", durationMs: 90_000, travelScale: 1.35, periodScale: 0.8, platformScale: 0.9, placeholder: true },
   4: { id: 4, name: "Storm Heights", durationMs: 90_000, travelScale: 1.4, periodScale: 0.75, platformScale: 0.85, placeholder: true },
   5: { id: 5, name: "Infinite Tower", durationMs: 90_000, travelScale: 1.4, periodScale: 0.72, platformScale: 0.8, placeholder: true },
};
