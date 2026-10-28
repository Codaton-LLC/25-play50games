import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 6, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time minus the orb and
// flow bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 67.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Temple Gate",
   2: "Lantern Hall",
   3: "Balcony Climb",
   4: "Night Temple",
   5: "Golden Roof",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const templeLanternJumpMeta: ArcadeGameMeta = {
   slug: "temple-lantern-jump",
   title: "Temple Lantern Jump",
   tagline: "Carry the flame. Make the darkness hold you.",
   description:
      "Climb a pitch-dark jungle-temple shaft by bouncing on stone cage lanterns. Each lantern throws you high, refills your fading ember and lights the gold sun-glyph ledges around it; in the dark those ledges fade and drop you. Throw the ember down to relight a lantern, light the galleries' braziers, and pick Riko, Nami, Kiro, Zuno or Vexa. Level 5 is a boss fight against the Soot Bat Queen.",
   order: 67,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps, E or Enter throws the ember in the air or fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump and Ember buttons; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22c55e",
   owner: "claude",
};
