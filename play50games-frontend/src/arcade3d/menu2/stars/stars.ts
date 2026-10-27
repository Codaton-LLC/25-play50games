// Menu 2 level stars (00-framework.md pillar 3): clear the level, collect every colour orb, and beat
// the level's goal (a target time, or a game-specific goal such as knock-offs or HP left). A no-hit
// run earns a badge on top. Pure: a game evaluates at the end of a win and hands the result to
// progress (menu2/progress) and the star screen (StarScreen.tsx).

/** The third star's goal. "time": at most targetMs. "atLeast" / "atMost": a game value (knock-offs, HP left, hits taken). */
export type StarGoal =
   | { kind: "time"; targetMs: number }
   | { kind: "atLeast"; target: number; label: string }
   | { kind: "atMost"; target: number; label: string };

export interface StarSpec {
   /** colour orbs on the level (0 = the orb star is given on a clear) */
   orbTotal: number;
   goal: StarGoal;
}

export interface LevelOutcome {
   cleared: boolean;
   orbs: number;
   /** the value the goal compares: the submitted time (ms) for "time", else the game's value */
   goalValue: number;
   /** hits taken (falls, damage): 0 = the no-hit badge */
   hits: number;
}

/** Star bits: clear 1, orbs 2, goal 4. */
export const STAR_BIT = { clear: 1, orbs: 2, goal: 4 } as const;
export const ALL_STARS = STAR_BIT.clear | STAR_BIT.orbs | STAR_BIT.goal;

export interface StarResult {
   clear: boolean;
   allOrbs: boolean;
   goal: boolean;
   noHit: boolean;
   /** STAR_BIT mask of this run */
   mask: number;
   /** 0..3 */
   stars: number;
}

export function goalMet(goal: StarGoal, value: number): boolean {
   if (!Number.isFinite(value)) return false;
   switch (goal.kind) {
      case "time":
         return value <= goal.targetMs;
      case "atLeast":
         return value >= goal.target;
      case "atMost":
         return value <= goal.target;
   }
}

/** The run's stars. Nothing counts without a clear (a lost run earns no star and no badge). */
export function evaluateStars(spec: StarSpec, outcome: LevelOutcome): StarResult {
   const clear = outcome.cleared;
   const allOrbs = clear && outcome.orbs >= spec.orbTotal;
   const goal = clear && goalMet(spec.goal, outcome.goalValue);
   const noHit = clear && outcome.hits === 0;
   const mask = (clear ? STAR_BIT.clear : 0) | (allOrbs ? STAR_BIT.orbs : 0) | (goal ? STAR_BIT.goal : 0);
   return { clear, allOrbs, goal, noHit, mask, stars: starCount(mask) };
}

export function starCount(mask: number): number {
   return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

/** Each star is its own goal: a level keeps every star ever earned (union). */
export function mergeStarMask(prev: number, next: number): number {
   return (prev | next) & ALL_STARS;
}

/** The stars this run earned for the first time. */
export function newStarMask(prev: number, next: number): number {
   return next & ~prev & ALL_STARS;
}

/** The short line under each star on the star screen. */
export function goalText(goal: StarGoal): string {
   if (goal.kind === "time") return `Finish in ${(goal.targetMs / 1000).toFixed(goal.targetMs % 1000 === 0 ? 0 : 1)} s`;
   return goal.kind === "atLeast" ? `${goal.label} ${goal.target}+` : `${goal.label} ${goal.target} or less`;
}

export function starLabels(spec: StarSpec): [string, string, string] {
   return ["Clear the level", spec.orbTotal > 0 ? `All ${spec.orbTotal} orbs` : "All orbs", goalText(spec.goal)];
}

export function starSpecProblems(spec: StarSpec): string[] {
   const out: string[] = [];
   if (!Number.isInteger(spec.orbTotal) || spec.orbTotal < 0) out.push("orbTotal must be a whole number >= 0");
   const g = spec.goal;
   if (g.kind === "time" && !(g.targetMs > 0)) out.push("time goal needs targetMs > 0");
   if (g.kind !== "time" && (!Number.isFinite(g.target) || !g.label)) out.push("goal needs a finite target and a label");
   return out;
}
