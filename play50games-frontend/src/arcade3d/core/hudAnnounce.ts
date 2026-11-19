// What the HUD's polite status line reads out during a run (ShellOverlays HudAnnouncer). Only the
// moments that matter, never every tick: a life lost, 30 and 10 seconds left on a timed run, and
// progress on an objective stat that has a target ("Batteries 3 of 5"). The score itself is not
// read: it changes too often to follow by ear; the result screen reads the final one.
import type { GameDefinition } from "./types";

export interface HudSnapshot {
   /** whole seconds: left when `timed`, played otherwise */
   time: number;
   timed: boolean;
   lives: number | null;
   stats: Record<string, number>;
}

export interface HudNews {
   text: string;
   /** objective progress may be dropped when it comes too fast; lives and time never are */
   minor: boolean;
}

const TIME_MARKS = [30, 10];

export function hudAnnouncement(prev: HudSnapshot, next: HudSnapshot, hudStats?: GameDefinition["hudStats"]): HudNews | null {
   if (prev.lives !== null && next.lives !== null && next.lives < prev.lives) {
      return { text: next.lives === 1 ? "1 life left" : `${next.lives} lives left`, minor: false };
   }
   if (next.timed && prev.timed) {
      const mark = TIME_MARKS.find((value) => prev.time > value && next.time <= value && next.time > 0);
      if (mark !== undefined) return { text: `${mark} seconds left`, minor: false };
   }
   for (const stat of hudStats ?? []) {
      if (stat.max === undefined) continue;
      const before = prev.stats[stat.key] ?? 0;
      const after = next.stats[stat.key] ?? 0;
      if (after > before) {
         return { text: `${stat.label} ${Math.min(after, stat.max)} of ${stat.max}`, minor: after < stat.max };
      }
   }
   return null;
}
