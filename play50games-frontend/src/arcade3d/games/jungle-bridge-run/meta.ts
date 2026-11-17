import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "@/arcade3d/types";
import { LEVEL_TITLES } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Numbers match rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

const SCORING: ScoringRules = PROPOSED_LEVEL_LIMITS[1];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: LEVEL_TITLES[1], scoring: PROPOSED_LEVEL_LIMITS[1] },
   { id: 2, title: LEVEL_TITLES[2], scoring: PROPOSED_LEVEL_LIMITS[2] },
   { id: 3, title: LEVEL_TITLES[3], scoring: PROPOSED_LEVEL_LIMITS[3] },
   { id: 4, title: LEVEL_TITLES[4], scoring: PROPOSED_LEVEL_LIMITS[4] },
   { id: 5, title: LEVEL_TITLES[5], scoring: PROPOSED_LEVEL_LIMITS[5] },
];

export const jungleBridgeRunMeta: ArcadeGameMeta = {
   slug: "jungle-bridge-run",
   title: "Jungle Bridge Run",
   tagline: "Jump the gaps. Cross the bridges.",
   description: "Race an explorer through the jungle over rope bridges, logs and gaps, collecting gems on the way to the finish.",
   order: 46,
   status: "dev",
   collection: "adventure",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or arrows to switch lanes, Space or W to jump, S to slide",
      touch: "Swipe to switch lanes, jump and slide",
   },
   scoring: SCORING,
   levels: LEVELS,
   thumbnail: "/images/3d/jungle-bridge-run.webp",
   accent: "#22c55e",
   owner: "antigravity",
};
