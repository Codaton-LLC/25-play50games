import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS, PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 game 48. A points game: blocks (more at the outermost zone), perfect waves, the flow bonus and
// on level 5 the Orb Mortar (README "Scoring and the proof"). Each level row carries its proven limits.
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

export const colorOrbDefenseMeta: ArcadeGameMeta = {
   slug: "color-orb-defense",
   title: "Color Orb Defense",
   tagline: "Stand on the right colour. Block every orb.",
   description:
      "Energy orbs fly from the portals round a floating castle arena toward its beacon. Run to the colour zone on each orb's lane that matches it and your shield blocks it; the outer zones score more. Waves grow, a drone sweeps the ring, orbs blink between colours and come in pairs. Pick any Pangoroll hero. Level 5 is the Orb Mortar, who lobs golden core orbs you send back.",
   order: 99,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "WASD or arrows to run, Space to jump (the drone), E or Enter for the hero power",
      touch: "Joystick to run, Jump and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: "/images/3d/color-orb-defense.webp",
   accent: "#38bdf8",
   owner: "claude",
};
