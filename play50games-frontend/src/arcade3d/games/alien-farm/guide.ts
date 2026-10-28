// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { HARVEST, guidePlot, type RunState } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);
/** The tool is cooling after a wasted press (the Hud shows a pill), written by the Scene. */
export const COOLING = createHudSignal<boolean>(false);

export const basketFull = (run: RunState): boolean => run.cargoCount >= (run.level?.capacity ?? HARVEST.capacity);

/** The crop to walk to (index into run.plots), or -1: only while there is room in the basket. */
export function cropGoal(run: RunState): number {
   return basketFull(run) ? -1 : guidePlot(run);
}

/** The saucer's beam is the goal while anything is carried. */
export const beamGoal = (run: RunState): boolean => run.cargoCount > 0;

export const toolCooling = (run: RunState): boolean => run.time < run.cooldownUntil;

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: RunState, crop: number): number {
   if (run.time < run.stunUntil) return 1;
   if (run.farmer.inSpore) return 2;
   if (basketFull(run)) return 3;
   if (run.cargoCount > 0) return crop < 0 ? 4 : 4 + run.cargoCount;
   return crop >= 0 ? 10 : 0;
}

export function farmHint(run: RunState, code: number, touch: boolean): HintState {
   const press = touch ? "tap Pick" : "press E";
   if (code === 0) return { text: null };
   if (code === 1) return { text: "Dazed by the burst! Wait…", key: "daze", tone: "warn", sticky: true };
   if (code === 2) return { text: "Spores slow you down: step out", key: "spore", tone: "warn", sticky: true };
   if (code === 3) return { text: "Basket full! Walk into the saucer's beam (ring)", key: "full", tone: "ready" };
   if (code === 4) return { text: "Carry the crops into the saucer's beam (ring)", key: "carry", tone: "carry" };
   if (code < 10) return { text: `Carrying ${code - 4} / ${run.level?.capacity ?? HARVEST.capacity}: pick more or ride the beam`, key: `carry-${code - 4}`, tone: "carry" };
   return { text: `Go to the marked crop, ${press} when its ring is full (gold)`, key: "pick" };
}
