import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS, LEVELS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 23, World 4 Frost & Sweets. Status "dev" until the user signs it off.
// A points game: banked trains, orbs, the flow bonus and on level 5 the Glutton (README "Score limits").
// Levels 1-4 are cleared at the card's target score (clearScore); level 5 by beating the Glutton.
// order 81 (the coordinator's slot for it).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Vault Floor",
   2: "Shifting Tiles",
   3: "Slime Pen",
   4: "Chest Rush",
   5: "Gumdrop Glutton",
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

export const gemCollector3dMeta: ArcadeGameMeta = {
   slug: "gem-collector-3d",
   title: "Gem Collector 3D",
   tagline: "Every gem joins a glowing train behind you. Bank long trains, never cross your own tail.",
   description: "Roll through the Ornament Vault as a Scale Squad hero: every gem you grab joins a train that follows your exact path, and a long train banked at a score beacon is worth its length squared. Cross your own tail and it snaps; close a loop round a slime and it freezes to gold. Sinking tiles, frost sweepers, treasure chests and the Gumdrop Glutton, who eats your tail.",
   order: 81,
   status: "live",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to roll (camera-relative), Space to jump, E or Enter for the hero power. Camera: drag, wheel, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick, Jump and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({
      id,
      title: LEVEL_TITLES[id],
      scoring: scoring(id),
      ...(LEVELS[id].targetScore > 0 ? { clearScore: LEVELS[id].targetScore } : {}),
   })),
   thumbnail: "/images/3d/gem-collector-3d.webp",
   accent: "#facc15",
   owner: "claude",
};
