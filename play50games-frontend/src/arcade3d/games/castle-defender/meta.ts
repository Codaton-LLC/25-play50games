import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold", one proof per level; they equal
// rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and arcade-games.json levels (registry.sync.test.ts).
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 7130,
   minDurationMs: 39000,
   maxDurationMs: 140000,
   base: 480,
   maxPointsPerSec: 56,
   unitLabel: "pts",
   display: "int",
};

export const castleDefenderMeta: ArcadeGameMeta = {
   slug: "castle-defender",
   title: "Castle Defender",
   tagline: "Hold the wall.",
   description: "Hold the castle wall against waves of bumbling cartoon goblins: tap to fire the wall cannon, drop rocks on ladders and keep the gate standing.",
   order: 24,
   status: "dev",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Click the field to fire; arrows / WASD aim, Space fires; E / Enter drops a rock; 1 / 2 chooses an upgrade",
      touch: "Tap the field to fire, tap Rock to clear a ladder, tap an upgrade card to choose",
   },
   scoring: SCORING,
   // a level clears on a win (every wave survived); no clearScore
   levels: [
      { id: 1, title: "Outer Wall", scoring: SCORING },
      { id: 2, title: "Main Gate", scoring: { ...SCORING, maxScore: 7370, minDurationMs: 33000, maxDurationMs: 135000, base: 600, maxPointsPerSec: 61 } },
      { id: 3, title: "Twin Towers", scoring: { ...SCORING, maxScore: 9130, minDurationMs: 36000, maxDurationMs: 156000, base: 480, maxPointsPerSec: 65 } },
      { id: 4, title: "Night Siege", scoring: { ...SCORING, maxScore: 10710, minDurationMs: 35000, maxDurationMs: 178500, base: 480, maxPointsPerSec: 66 } },
      { id: 5, title: "Royal Defense", scoring: { ...SCORING, maxScore: 11570, minDurationMs: 30000, maxDurationMs: 200500, base: 480, maxPointsPerSec: 63 } },
   ],
   thumbnail: "/images/3d/castle-defender.webp",
   accent: "#94a3b8",
   owner: "codex",
};
