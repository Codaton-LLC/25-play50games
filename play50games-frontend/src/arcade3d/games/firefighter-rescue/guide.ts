// What to do next, for the beacon and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { EXIT, EXIT_AT, SPRAY_RANGE, doorClosed, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Breath under this (0..1) while in smoke: the hint warns. */
export const LOW_BREATH = 0.35;

export interface Target {
   /** 0 none, 1 fire, 2 neighbour, 3 the exit (a neighbour is following) */
   kind: 0 | 1 | 2 | 3;
   index: number;
   x: number;
   z: number;
}

/** The firefighter stands in a smoke disc (rules.ts inSmoke, which is not exported). */
export function heroInSmoke(run: Run): boolean {
   for (const disc of run.smoke) {
      const dx = run.hero.x - disc.x;
      const dz = run.hero.z - disc.z;
      if (dx * dx + dz * dz <= disc.r * disc.r) return true;
   }
   return false;
}

function open(run: Run, room: number): boolean {
   return room < 0 || !doorClosed(run, room);
}

function stillWanted(run: Run, t: Target): boolean {
   if (t.kind === 1) return !!run.fires[t.index] && !run.fires[t.index].out;
   if (t.kind === 2) {
      const civ = run.civilians[t.index];
      return !!civ && !civ.saved && !civ.following && run.follower < 0;
   }
   return false;
}

/**
 * The current target: the exit while a neighbour follows; else the one already chosen until it is
 * done (no flicker between two near fires); else the nearest fire or neighbour that can be reached now
 * (a lock fire stands in the hall, a room's fire or neighbour only once its door is open).
 */
export function nextTarget(run: Run, t: Target): Target {
   if (run.follower >= 0) {
      t.kind = 3;
      t.index = run.follower;
      t.x = EXIT_AT.x;
      t.z = (EXIT.minZ + EXIT.maxZ) / 2;
      return t;
   }
   if ((t.kind === 1 || t.kind === 2) && stillWanted(run, t)) {
      if (t.kind === 2) {
         t.x = run.civilians[t.index].x;
         t.z = run.civilians[t.index].z;
      }
      return t;
   }
   let best = Infinity;
   t.kind = 0;
   t.index = -1;
   for (let i = 0; i < run.fires.length; i++) {
      const fire = run.fires[i];
      if (fire.out || (!fire.door && !open(run, fire.room))) continue;
      const d = Math.hypot(fire.x - run.hero.x, fire.z - run.hero.z);
      if (d < best) {
         best = d;
         t.kind = 1;
         t.index = i;
         t.x = fire.x;
         t.z = fire.z;
      }
   }
   for (let i = 0; i < run.civilians.length; i++) {
      const civ = run.civilians[i];
      if (civ.saved || !open(run, civ.room)) continue;
      const d = Math.hypot(civ.x - run.hero.x, civ.z - run.hero.z);
      if (d < best) {
         best = d;
         t.kind = 2;
         t.index = i;
         t.x = civ.x;
         t.z = civ.z;
      }
   }
   return t;
}

/** A number per distinct hint, so the Scene rebuilds the hint only when it changes. */
export function hintCode(run: Run, t: Target, inSmoke: boolean): number {
   if (inSmoke && run.hero.breath < LOW_BREATH) return 1;
   const near = t.kind !== 0 && Math.hypot(t.x - run.hero.x, t.z - run.hero.z) <= SPRAY_RANGE ? 1 : 0;
   return 10 + t.kind * 2 + near;
}

export function targetHint(code: number, touch: boolean): HintState {
   const spray = touch ? "hold Spray" : "hold E";
   switch (code) {
      case 1:
         return { text: "Low breath! Get out of the smoke", key: "breath", tone: "warn", sticky: true };
      case 12:
         return { text: "Go to the fire (arrow)", key: "fire" };
      case 13:
         return { text: `${spray} until the fire is out`, key: "fire-near" };
      case 14:
         return { text: "A neighbour needs help: go to them", key: "civ" };
      case 15:
         return { text: `${spray} to talk: they follow you`, key: "civ-near" };
      case 16:
      case 17:
         return { text: "Neighbour following: lead them to the green EXIT", key: "exit", tone: "carry" };
      default:
         return { text: "All clear! Well done", key: "done", tone: "ready" };
   }
}
