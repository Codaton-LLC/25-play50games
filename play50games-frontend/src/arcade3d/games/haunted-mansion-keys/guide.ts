// What to do next, for the beacon and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it. Key i opens door i (wing i -> i+1), the last locked door is the exit.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { ACTION_RANGE, KEY_SHAPES, type Run } from "./rules";

export const KEY_NAMES = ["amber", "green", "blue", "red", "purple"] as const;
export const SHAPE_GLYPHS = { circle: "●", square: "■", triangle: "▲", diamond: "◆", star: "★" } as const;

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export interface Objective {
   kind: "key" | "door" | "exit";
   /** key index (key / door), -1 for the exit */
   index: number;
   x: number;
   y: number;
   z: number;
}

/** A key's name for the hint: "red ◆ key". */
export function keyName(i: number): string {
   return `${KEY_NAMES[i] ?? "next"} ${SHAPE_GLYPHS[KEY_SHAPES[i]] ?? ""} key`;
}

/** The next step: the exit once its door is open, else the first key whose door is shut (its door once held). */
export function nextObjective(run: Run, out: Objective): Objective {
   const exitRoom = run.rooms[run.rooms.length - 1];
   const exitDoor = run.doors.find((d) => d.isExit);
   const toExit = () => {
      out.kind = "exit";
      out.index = -1;
      out.x = exitRoom.cx;
      out.y = 0.2;
      out.z = exitRoom.cz;
      return out;
   };
   if (run.exitDoorOpen || !exitDoor) return toExit();
   const toDoor = (i: number) => {
      const door = run.doors.find((d) => d.kind === "locked" && d.keyIndex === i);
      if (!door) return toExit();
      out.kind = "door";
      out.index = i;
      out.x = door.x;
      out.y = 1.4;
      out.z = door.z;
      return out;
   };
   if (run.heldKeys[exitDoor.keyIndex]) return toDoor(exitDoor.keyIndex);
   for (let i = 0; i < run.keys.length; i++) {
      const door = run.doors.find((d) => d.kind === "locked" && d.keyIndex === i);
      if (door?.open) continue;
      if (run.heldKeys[i]) return toDoor(i);
      const key = run.keys[i];
      out.kind = "key";
      out.index = i;
      out.x = key.x;
      out.y = key.y + 0.3;
      out.z = key.z;
      return out;
   }
   return toExit();
}

/** The hint for that step (what to do, what is carried, ready). */
export function objectiveHint(run: Run, o: Objective, touch: boolean): HintState {
   const use = touch ? "hold Use" : "hold E";
   const near = Math.hypot(o.x - run.hero.x, o.z - run.hero.z) <= ACTION_RANGE;
   if (o.kind === "exit") return { text: "Exit open! Run into the glowing ring", key: "exit", tone: "ready" };
   if (o.kind === "door") {
      return near
         ? { text: `Got the ${keyName(o.index)}: ${use} to unlock`, key: `door-${o.index}-near`, tone: "carry" }
         : { text: `Got the ${keyName(o.index)}: go to its door`, key: `door-${o.index}`, tone: "carry" };
   }
   return near
      ? { text: `${use} to take the ${keyName(o.index)}`, key: `key-${o.index}-near` }
      : { text: `Find the ${keyName(o.index)} (follow the arrow)`, key: `key-${o.index}` };
}

/** A locked door within reach whose key is not held (a Use there does nothing): its key index, or -1. */
export function lockedDoorInReach(run: Run): number {
   for (const door of run.doors) {
      if (door.open || door.kind !== "locked" || door.keyIndex < 0 || run.heldKeys[door.keyIndex]) continue;
      if (Math.hypot(door.x - run.hero.x, door.z - run.hero.z) <= ACTION_RANGE) return door.keyIndex;
   }
   return -1;
}
