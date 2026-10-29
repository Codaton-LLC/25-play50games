// What to fix before touching down, as one line for the hint (Hud.tsx). Purely visual: it reads the
// flight stats the Scene already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";
import { CONTACT } from "./rules";

export interface Flight {
   /** pad-relative sideways speed, tenths of m/s */
   vx: number;
   /** vertical speed, tenths of m/s (negative = descending) */
   vy: number;
   /** tilt, degrees */
   tilt: number;
   /** fuel, percent */
   fuel: number;
   /** the shell's landing check (landingSafe) */
   safe: boolean;
   /** 0 flying, 1 landed, 2 crashed */
   hold: number;
}

export interface Gates {
   /** m/s down */
   vy: number;
   /** degrees */
   tilt: number;
}

export interface Hint {
   text: string | null;
   tone: HintTone;
}

/** The first thing wrong with the approach, else the all-clear. */
export function hintFor(f: Flight, g: Gates): Hint {
   if (f.hold !== 0) return { text: null, tone: "info" };
   if (f.fuel <= 0) return { text: "Out of fuel: glide down gently, level, onto the pad", tone: "warn" };
   if (f.vy < 0 && -f.vy / 10 >= g.vy) return { text: `Too fast: thrust to slow down (under ${g.vy} m/s)`, tone: "warn" };
   if (Math.abs(f.tilt) >= g.tilt) return { text: `Level the rocket: tilt under ${g.tilt}°`, tone: "warn" };
   if (Math.abs(f.vx) / 10 >= CONTACT.vx) return { text: `Drifting: line up over the pad, sideways under ${CONTACT.vx} m/s`, tone: "warn" };
   if (f.safe) return { text: "Good approach: keep it slow and level, touch the pad", tone: "ready" };
   return { text: "Land slow, level and over the pad", tone: "info" };
}
