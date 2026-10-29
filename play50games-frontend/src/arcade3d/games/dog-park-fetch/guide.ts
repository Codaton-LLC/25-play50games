// What the dog should do now, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual:
// it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import type { Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** A toy left on the grass this many seconds before the owner fetches it: the hint warns. */
export const HURRY_S = 4;

export interface Goal {
   /** 0 none, 1 the toy to pick up, 2 the blanket (carrying), 3 where a toy in the air lands */
   kind: 0 | 1 | 2 | 3;
   x: number;
   z: number;
}

/** The current goal. Pure: nothing is written to the run. */
export function nextGoal(run: Run, out: Goal): Goal {
   const th = run.active;
   out.kind = 0;
   if (run.over || !th) return out;
   if (th.state === "carried") {
      out.kind = 2;
      out.x = run.blanket.x;
      out.z = run.blanket.z;
   } else {
      out.kind = th.state === "flying" ? 3 : 1;
      out.x = th.lx;
      out.z = th.lz;
   }
   return out;
}

/** Seconds until the owner fetches the toy on the grass (Infinity with no patience / no toy on the grass). */
export function patienceLeft(run: Run): number {
   const th = run.active;
   if (!th || th.state !== "ground" || run.level.patienceS <= 0) return Infinity;
   return Math.max(0, run.level.patienceS - (run.time - th.landedAt));
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   const th = run.active;
   if (run.over || !th) return 0;
   if (run.dog.stun > 0) return 1;
   if (th.state === "carried") return 300 + th.index;
   if (th.state === "flying") return 100 + th.index * 2 + (th.kind === "frisbee" ? 1 : 0);
   return patienceLeft(run) <= HURRY_S ? 2 : 200 + th.index;
}

export function dogHint(run: Run, code: number, touch: boolean): HintState {
   const jump = touch ? "tap Jump" : "press Space";
   if (code === 0) return { text: null };
   if (code === 1) return { text: "Knocked down by the mower! Wait…", key: "stun", tone: "warn", sticky: true };
   if (code === 2) return { text: "Hurry! The owner is about to fetch it", key: "hurry", tone: "warn", sticky: true };
   if (code >= 300) return { text: "Got it! Run back to the blanket (arrow)", key: `carry-${code}`, tone: "carry" };
   if (code >= 200) return { text: "Run to the toy (arrow) to pick it up", key: `toy-${code}` };
   if (code % 2 === 1) return { text: `Frisbee! Run under it, then ${jump} to catch it`, key: `fly-${code}` };
   return { text: "Watch the toy: it lands in the ring", key: `fly-${code}` };
}
