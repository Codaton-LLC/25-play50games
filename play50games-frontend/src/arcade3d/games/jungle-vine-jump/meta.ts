import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 8, World 3 "Wild Temples" (green; lead hero Kiro). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time minus the orb and
// combo bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 68.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Green Start",
   2: "Branch Climb",
   3: "Swinging Vines",
   4: "Ruins",
   5: "Canopy Peak",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const jungleVineJumpMeta: ArcadeGameMeta = {
   slug: "jungle-vine-jump",
   title: "Jungle Vine Jump",
   tagline: "Climb the swing. Trade speed for reach.",
   description:
      "Climb a giant jungle tree by swinging on vines. Slide your grip up and down mid-swing: a short grip swings fast, a long one reaches far. Pump in time with the swing, let go along its arc and catch the next vine, chain catches for a combo, and pick Riko, Nami, Kiro, Zuno or Vexa. Dry vines snap, monkeys throw fruit, and level 5 is a duel with the Howler King in the canopy.",
   order: 68,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "On a vine: Up / Down slides the grip, Left / Right pumps with the swing, Space lets go. On a branch: WASD or arrows move (camera-relative), Space jumps. E or Enter fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick (up / down slides the grip, left / right pumps), Jump to let go or jump, Power button; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#22c55e",
   owner: "claude",
};
