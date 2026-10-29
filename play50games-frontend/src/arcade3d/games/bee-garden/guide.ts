// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { TUNING, type RunState } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Switch to another flower only when it is this much closer than the current one. */
export const SWITCH_SHARE = 0.6;

const away = (run: RunState, i: number) => Math.hypot(run.flowers[i].x - run.bee.x, run.flowers[i].z - run.bee.z);

/**
 * The flower to fly to (index into run.flowers), or -1 when none holds nectar. Keeps `current` while
 * it still holds nectar unless another is clearly closer (no flicker between two near blooms).
 */
export function nextFlower(run: RunState, current: number): number {
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < run.flowers.length; i++) {
      if (!run.flowers[i].hasNectar) continue;
      const d = away(run, i);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   const keep = run.flowers[current];
   if (keep && keep.hasNectar && best !== current && bestD > away(run, current) * SWITCH_SHARE) return current;
   return best;
}

/** The hive beacon shows while there is something to bank. */
export const hiveGoal = (run: RunState): boolean => run.carried.length > 0;
/** The flower beacon shows while there is room to carry and nectar left. */
export const flowerGoal = (run: RunState, flower: number): boolean => flower >= 0 && run.carried.length < TUNING.carryCap && !run.over;

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: RunState, flower: number): number {
   if (run.over) return 0;
   if (run.stunTimer > 0) return 1;
   const n = run.carried.length;
   if (n >= TUNING.carryCap || (n > 0 && flower < 0)) return 2;
   if (n > 0) return 3 + n;
   return flower >= 0 ? 10 : 0;
}

export function beeHint(run: RunState, code: number, touch: boolean): HintState {
   const boost = touch ? "hold Boost" : "hold Space";
   if (code === 0) return { text: null };
   if (code === 1) return { text: "Stuck in a web! The nectar fell back", key: "web", tone: "warn", sticky: true };
   if (code === 2) return { text: `${run.carried.length === TUNING.carryCap ? "Full load! " : ""}Fly over the hive (arrow) to bank it`, key: "bank", tone: "ready" };
   if (code > 3 && code < 10) return { text: `Carrying ${code - 3} / ${TUNING.carryCap}: grab more or bank at the hive`, key: `carry-${code - 3}`, tone: "carry" };
   return { text: `Fly into the glowing nectar (arrow) · ${boost} to fly faster`, key: "pick" };
}
