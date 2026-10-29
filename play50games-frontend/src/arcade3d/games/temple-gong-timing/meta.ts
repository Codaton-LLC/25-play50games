import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 36, World 3 "Wild Temples" (green; lead hero Kiro), the world's finale.
// Status "dev" (preview builds only) until the user signs it off. A points game: struck notes (Perfect /
// Good) times the combo, held drums and echo orbs (README "Scoring"). Each level row carries its own
// proven limits (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 72.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Slow Beat",
   2: "Alternating Gongs",
   3: "Moving Targets",
   4: "Fast Rhythm",
   5: "Perfect Timing",
};

const scoring = (id: LevelId): ScoringRules => {
   const l = PROPOSED_LEVEL_LIMITS[id];
   return {
      kind: "points",
      maxScore: l.maxScore,
      minDurationMs: l.minDurationMs,
      maxDurationMs: l.maxDurationMs,
      base: l.base,
      maxPointsPerSec: l.maxPointsPerSec,
      unitLabel: "pts",
      display: "int",
   };
};

export const templeGongTimingMeta: ArcadeGameMeta = {
   slug: "temple-gong-timing",
   title: "Temple Gong Timing",
   tagline: "Roll into the gongs on the beat. Bring the jungle back.",
   description:
      "A rhythm game in a ruined jungle temple: rings shrink onto the giant gongs, and your hero rolls into each one on the beat (Perfect within 45 ms, the same on touch and keyboard). Hold the ceremony drums, answer the lanterns' calls with no rings, lead the gongs as the stage turns, jump the off-beat shockwaves, and every Perfect grows the arena back green. Level 5 is the World 3 finale: free Coilstone, the Temple Serpent, with a duel on the drums and one last strike on the Great Gong.",
   order: 72,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "E, Enter or the Strike button on the beat (hold it on a drum); Space jumps; WASD or arrows move (camera-relative; at rest the hero rolls to the next gong); drag, Q / C turn and the wheel zooms the camera",
      touch: "Strike button on the beat (hold it on a drum), Jump button; the joystick is optional (at rest the hero rolls to the next gong); two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22c55e",
   owner: "claude",
};
