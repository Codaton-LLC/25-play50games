// Train Station Rush level configs (docs/menu1-new/specs-41-50.md §44). Each level is its own
// station theme (looks.ts palette + apron + solids layout); platforms / tasks / passengers /
// parallel / timetable / crowd / clock still ramp. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

/** Visual identity: palette, apron scenery and concourse prop layout (looks.ts / rules.solidsFor). */
export type StationTheme = "local" | "quad" | "central" | "rush" | "mega";

export interface StationLevel {
   /** platforms (each with its own track), in back-to-back pairs */
   platforms: number;
   tasks: number;
   /** 0..1 of the tasks that are passengers (walked, not carried) */
   passengerShare: number;
   /** tasks open at the entrance at once */
   parallel: number;
   /** a task's train arrives this long after the task opens (s) */
   arriveS: number;
   /** and waits this long (s): its leave time is the task's deadline */
   dwellS: number;
   /** wandering travellers on the concourse (solid) */
   crowd: number;
   durationMs: number;
   lighting: "day" | "indoor" | "sunset" | "night";
   background: string;
   /** looks.ts LOOKS + Scene apron; rules.ts solidsFor layout */
   theme: StationTheme;
}

export const LEVELS: Record<LevelId, StationLevel> = {
   // 2 Platforms: today's compact branch station (bright day).
   1: { platforms: 2, tasks: 4, passengerShare: 0, parallel: 1, arriveS: 4, dwellS: 22, crowd: 0, durationMs: 120_000, lighting: "day", background: "#bae6fd", theme: "local" },
   // 4 Platforms: wider yard, cool day wash, passengers to walk.
   2: { platforms: 4, tasks: 6, passengerShare: 0.34, parallel: 1, arriveS: 4, dwellS: 22, crowd: 0, durationMs: 150_000, lighting: "day", background: "#7dd3fc", theme: "quad" },
   // Central Station: indoor ticket-hall look, crowd on the concourse.
   3: { platforms: 4, tasks: 8, passengerShare: 0.4, parallel: 1, arriveS: 3, dwellS: 20, crowd: 6, durationMs: 180_000, lighting: "indoor", background: "#475569", theme: "central" },
   // Rush Hour: sunset platforms, two tasks open at once.
   4: { platforms: 4, tasks: 10, passengerShare: 0.4, parallel: 2, arriveS: 3, dwellS: 24, crowd: 8, durationMs: 180_000, lighting: "sunset", background: "#fdba74", theme: "rush" },
   // Mega Station: night city terminal, six platforms.
   5: { platforms: 6, tasks: 12, passengerShare: 0.5, parallel: 2, arriveS: 3, dwellS: 24, crowd: 10, durationMs: 210_000, lighting: "night", background: "#0f172a", theme: "mega" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "2 Platforms",
   2: "4 Platforms",
   3: "Central Station",
   4: "Rush Hour",
   5: "Mega Station",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Four bags, two trains at a time.",
   2: "Some travellers need walking to the train.",
   3: "A crowd on the concourse.",
   4: "Two tasks open at once.",
   5: "Six platforms, twelve departures.",
};

/** How many of a level's tasks are passengers. */
export const passengerCount = (level: StationLevel) => Math.round(level.tasks * level.passengerShare);
