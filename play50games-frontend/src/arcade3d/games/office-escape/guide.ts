// What to do next, for the hint line and the pops (Guide.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { NO_OBSTACLE, OBSTACLE_TYPES, rowBack, type OfficeRun, type Row } from "./rules";

/** The game's hint line, written by Guide.tsx, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Only the first rows are coached: after that the player knows desks from chairs. */
export const COACHED_ROWS = 6;

/** The nearest row the runner has not left yet, or null. */
export function nextRow(run: OfficeRun): Row | null {
   let best: Row | null = null;
   for (const row of run.rows) {
      if (!row.alive || rowBack(row) <= run.distance) continue;
      if (!best || row.s < best.s) best = row;
   }
   return best;
}

/** 0 nothing to say, 1 jump the obstacle in this lane, 2 dodge it, 3 the opening line. */
export function hintCode(run: OfficeRun): number {
   if (run.over) return 0;
   const row = nextRow(run);
   if (!row || row.index >= COACHED_ROWS) return row === null && run.simMs < 1500 ? 3 : 0;
   const type = row.lanes[run.lane];
   if (type === NO_OBSTACLE) return 3;
   return OBSTACLE_TYPES[type].role === "jump" ? 1 : 2;
}

export function hintFor(code: number, run: OfficeRun): HintState {
   if (code === 1) return { text: "A low obstacle: jump it (Space or swipe up)", key: "jump", tone: "info" };
   if (code === 2) return { text: "Too tall to jump: change lane (Left / Right or swipe)", key: "dodge", tone: "warn" };
   if (code === 3) return { text: run.simMs < 1 ? "Swipe or press Left / Right to change lanes, Space to jump" : "Keep running: jump desks, dodge chairs", key: "run", tone: "info" };
   return { text: null };
}

/** The obstacle's name for the crash pop ("desk", "coffee cart"). */
export function obstacleName(type: number): string {
   if (type < 0 || type >= OBSTACLE_TYPES.length) return "obstacle";
   return OBSTACLE_TYPES[type].name.replace(/([A-Z])/g, " $1").toLowerCase();
}
