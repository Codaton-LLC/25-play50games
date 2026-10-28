// What is coming and what to do about it, for the beacon and the hint line (Scene.tsx, Hud.tsx).
// Purely visual: it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { LANE_X, obstacleEnd, type Obstacle, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** An obstacle is announced from this far ahead (m). */
export const WARN_AHEAD = 24;

export interface Cue {
   /** 0 nothing near, else the obstacle */
   obstacle: Obstacle | null;
   /** the safe lane (pillar, lava, bridge) or -1 (jump, slide) */
   lane: number;
   /** "go" = a lane to take (pick beacon), "jump" / "slide" = an action (danger beacon) */
   action: "go" | "jump" | "slide" | null;
   x: number;
   z: number;
}

/** The first obstacle not yet passed, from the runner's section on. */
export function nextObstacle(run: Run): { obstacle: Obstacle; clearLane: number } | null {
   for (let s = run.currentSection; s < run.sections.length; s++) {
      const sec = run.sections[s];
      let best: Obstacle | null = null;
      for (const o of sec.obstacles) {
         if (obstacleEnd(o) < run.z - 0.3) continue;
         if (!best || o.z < best.z) best = o;
      }
      if (best) return { obstacle: best, clearLane: sec.clearLane };
   }
   return null;
}

/** The cue for the obstacle ahead: where the beacon stands and which action it asks for. */
export function nextCue(run: Run, out: Cue): Cue {
   const next = nextObstacle(run);
   out.obstacle = null;
   out.lane = -1;
   out.action = null;
   if (!next || next.obstacle.z - run.z > WARN_AHEAD) return out;
   const o = next.obstacle;
   out.obstacle = o;
   switch (o.kind) {
      case "pillar":
      case "lava":
         out.action = "go";
         out.lane = next.clearLane;
         out.x = LANE_X[out.lane];
         out.z = o.z - 1.2;
         break;
      case "bridge":
         out.action = "go";
         out.lane = o.plankLane;
         out.x = LANE_X[out.lane];
         out.z = o.z + 0.6;
         break;
      case "gap":
         out.action = "jump";
         out.x = LANE_X[run.lane];
         out.z = o.z + o.length / 2;
         break;
      case "log":
         out.action = "jump";
         out.x = LANE_X[run.lane];
         out.z = o.z;
         break;
      case "vine":
         out.action = "slide";
         out.x = LANE_X[run.lane];
         out.z = o.z;
         break;
   }
   return out;
}

/** A number per distinct hint (kind x "on the safe lane"), so the Scene rebuilds it only on a change. */
export function cueCode(run: Run, cue: Cue): number {
   if (!cue.obstacle) return 0;
   const kinds = ["gap", "vine", "log", "bridge", "pillar", "lava"];
   const onLane = cue.lane >= 0 && run.lane === cue.lane ? 1 : 0;
   return 10 + kinds.indexOf(cue.obstacle.kind) * 2 + onLane;
}

export function cueHint(code: number, touch: boolean): HintState {
   const jump = touch ? "swipe up" : "Space";
   const slide = touch ? "swipe down" : "S";
   const side = touch ? "swipe" : "A / D";
   switch (code) {
      case 10:
      case 11:
         return { text: `Gap ahead: jump! (${jump})`, key: "gap", tone: "warn" };
      case 12:
      case 13:
         return { text: `Vine ahead: slide under it (${slide})`, key: "vine", tone: "warn" };
      case 14:
      case 15:
         return { text: `Rolling log: jump it (${jump}) or dodge`, key: "log", tone: "warn" };
      case 16:
         return { text: `Rope bridge: ${side} onto the planked lane (arrow)`, key: "bridge", tone: "warn" };
      case 17:
         return { text: "On the planks: stay in this lane", key: "bridge-ok", tone: "ready" };
      case 18:
         return { text: `Pillar ahead: ${side} to the arrow's lane`, key: "pillar", tone: "warn" };
      case 19:
         return { text: "Clear lane: keep running", key: "pillar-ok", tone: "ready" };
      case 20:
         return { text: `Lava vent: ${side} to the arrow's lane`, key: "lava", tone: "warn" };
      case 21:
         return { text: "Clear lane: keep running", key: "lava-ok", tone: "ready" };
      default:
         return { text: "Run! Grab the gems", key: "run" };
   }
}

/** The fail pop's text for what hit the runner. */
export function hitText(kind: Obstacle["kind"] | null, lifeLeft: boolean): string {
   const tail = lifeLeft ? " -1 life" : "";
   if (kind === "gap" || kind === "bridge") return `Fell!${tail}`;
   if (kind === "lava") return `Burned!${tail}`;
   if (kind === "vine") return `Slide next time!${tail}`;
   return `Crash!${tail}`;
}
