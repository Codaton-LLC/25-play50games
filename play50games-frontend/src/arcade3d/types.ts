// Server-safe contracts for the 3D Arcade.
// Do NOT import three, @react-three/*, React components or "use client" files here.

/** All 10 games in rollout order. */
export const ARCADE_SLUGS = [
   "robot-collector",
   "food-catcher",
   "office-escape",
   "pigeon-crossing",
   "penalty-hero",
   "warehouse-rush",
   "tower-climb",
   "clean-city",
   "escape-room",
   "obstacle-race",
] as const;

export type ArcadeSlug = (typeof ARCADE_SLUGS)[number];

export function isArcadeSlug(value: string): value is ArcadeSlug {
   return (ARCADE_SLUGS as readonly string[]).includes(value);
}

export type AgentOwner = "claude" | "cursor" | "codex";

export type ScoreKind = "points" | "time";

/**
 * Scoring limits. Must match play50games-backend/play50games/includes/arcade-games.json
 * (checked by registry.sync.test.ts). Higher score is always better.
 */
export interface ScoringRules {
   kind: ScoreKind;
   maxScore: number;
   minDurationMs: number;
   maxDurationMs: number;
   /** points games: server rejects score > base + maxPointsPerSec * duration_s */
   base: number;
   maxPointsPerSec: number;
   /** time games: score = max(0, floor((timeBaseMs - durationMs) / 10)); the server recomputes it */
   timeBaseMs?: number;
   /** e.g. "pts", "goals" – shown next to the score */
   unitLabel: string;
   /** "int" shows the score, "time" shows the best duration */
   display: "int" | "time";
}

export type ControlScheme =
   | "joystick"
   | "lanes"
   | "runner"
   | "hop"
   | "tap-target"
   | "platformer"
   | "point-and-move";

export interface ArcadeGameMeta {
   slug: ArcadeSlug;
   title: string;
   tagline: string;
   description: string;
   /** 1-based position in the arcade grid (rollout order) */
   order: number;
   status: "live" | "soon";
   difficulty: 1 | 2 | 3;
   orientation: "any" | "landscape" | "portrait";
   controls: { scheme: ControlScheme; keyboard: string; touch: string };
   scoring: ScoringRules;
   /** /images/3d/<slug>.webp once it exists */
   thumbnail: string | null;
   /** card accent colour */
   accent: string;
   owner: AgentOwner;
}
