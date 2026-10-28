import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import type { ObstacleRun } from "./rules";

export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export function nextTarget(run: ObstacleRun) {
   const line = run.course.checkpoints[run.checkpoint + 1] ?? run.course.finish;
   const support = run.course.supports[line.support];
   return { x: 0, y: support.top, z: -line.line, hidden: run.ended !== null };
}
export function hintFor(run: ObstacleRun): HintState {
   if (run.ended) return { text: null };
   if (run.runner.state !== "run") return { text: "Back to your checkpoint | the clock keeps running", key: `recover-${run.respawns}`, tone: "warn", sticky: true };
   return { text: run.checkpoint === 0 ? "Move forward | Jump / Space over gaps and the bar" : `Checkpoint ${run.checkpoint}/3 | ${run.checkpoint === 3 ? "reach the finish arch" : "reach the next green gate"}`, key: `checkpoint-${run.checkpoint}`, sticky: true };
}
