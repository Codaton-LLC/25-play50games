// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

/** Health (of 5 mitts) at or under this warns. */
export const LOW_HEALTH = 2;

export function hintFor(ammo: number, health: number): Hint {
   if (health <= LOW_HEALTH) return { text: `Only ${health} mitt${health === 1 ? "" : "s"} left: pack snowballs and tag a rival`, tone: "warn" };
   if (ammo <= 0) return { text: "Hold Scoop to pack a snowball, then tap a rival or press Space to throw", tone: "info" };
   return { text: `${ammo} snowball${ammo === 1 ? "" : "s"} ready: tap a rival (or press Space) to throw`, tone: "carry" };
}
