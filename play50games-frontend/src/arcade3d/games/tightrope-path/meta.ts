import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 47, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time less the orb, coin and
// flow bonus is the submitted time (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 74.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Wide Beams",
   2: "Narrow Beams",
   3: "Moving Beams",
   4: "Rotating Path",
   5: "Balance Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const tightropePathMeta: ArcadeGameMeta = {
   slug: "tightrope-path",
   title: "Tightrope Path",
   tagline: "Lean, correct, breathe. Don't look down.",
   description:
      "Cross a misty jungle gorge on planks, narrow beams and sagging ropes with a long balance pole. Every step tips the needle: push against it, sprint where you dare, crouch under swinging sandbags, brace for the gusts and jump the gaps. Rotating beams in the night fog, then a rope joust against Umbra on level 5. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 74,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "W / Up walks (hold to sprint), A / D or the arrows push against the lean (camera-relative), Space jumps, hold E or Enter to crouch (its press fires the hero power); drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick walks and balances, Jump, hold Duck to crouch (its press fires the hero power); two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#4ade80",
   owner: "claude",
};
