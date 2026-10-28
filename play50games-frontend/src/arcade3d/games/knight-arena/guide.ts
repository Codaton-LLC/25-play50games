import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { POSTS, SPIN, type RunState } from "./rules";

export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Read-only: show the earliest visible live cue, including tomatoes as warnings. */
export function nextTarget(run: RunState) {
   return run.map.cues.find((cue) => cue.status === "pending" && cue.spawnTimeMs <= run.timeMs && cue.expireTimeMs >= run.timeMs);
}
export function hintFor(run: RunState): HintState {
   if (run.finished) return { text: null };
   const cue = nextTarget(run);
   const combo = `Combo x${run.combo}`;
   if (cue?.kind === "tomato") return { text: `Avoid the tomato! | ${combo}`, key: `tomato-${cue.id}`, tone: "warn", sticky: true };
   if (run.spinMeter >= SPIN.MAX_METER) return { text: `Spin ready: Space / Spin | ${combo}`, key: "spin", tone: "ready", sticky: true };
   if (!cue) return { text: `Arrow keys / swipe toward dummies on the beat | ${combo}`, key: "intro" };
   const ready = Math.abs(run.timeMs - cue.beatTimeMs) <= run.onBeatWindowMs;
   return { text: `${ready ? "Strike" : "Wait for green"}: ${POSTS[cue.postIndex].direction}${cue.kind === "shield" ? " | shield takes two hits" : ""} | ${combo}`, key: `${cue.id}-${ready}-${run.combo}`, tone: ready ? "ready" : "info", sticky: true };
}
