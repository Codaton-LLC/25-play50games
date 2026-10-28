// What to do next, for the beacons (Scene.tsx). Purely visual: it reads the run and never changes it.
// The right DOOR is never marked: reading the key card is the game. The desk and the elevator are.
import { DESK_POINT, PAD_POINT, type Run } from "./rules";

export interface Goal {
   /** 0 none (find the door on the card), 1 the reception desk (take the bag), 2 the elevator pad (a ride is due) */
   kind: 0 | 1 | 2;
   x: number;
   z: number;
}

/** The current goal. The elevator is only a goal while the carried bag is for another floor. */
export function nextGoal(run: Run, out: Goal): Goal {
   const bag = run.bags[run.next];
   out.kind = 0;
   if (run.over || !bag) return out;
   if (!run.carrying) {
      out.kind = 1;
      out.x = DESK_POINT.x;
      out.z = DESK_POINT.z;
   } else if (run.level.floors > 1 && run.floor !== bag.floor && run.hero.ride <= 0) {
      out.kind = 2;
      out.x = PAD_POINT.x;
      out.z = PAD_POINT.z;
   }
   return out;
}
