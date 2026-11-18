import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 25, World 6 "Prism Fortress" (all colours; no lead hero). Status
// "dev" (preview builds only) until the user signs it off. A time game: the finish time is the submitted
// time (README "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in
// rules.ts). order 94.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "First Strokes",
   2: "Grey Blots",
   3: "Moving Tiles",
   4: "Time Attack",
   5: "80% Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const paintThePlatformsMeta: ArcadeGameMeta = {
   slug: "paint-the-platforms",
   title: "Paint the Platforms",
   tagline: "Run it, paint it, set it. Beat the clock.",
   description:
      "Shadow Plates drained the Prism Fortress's courtyard grey. Every tile you run over takes your hero's colour: paint the share each level asks for before the timer runs out. Whole rows set and stay; grey blots, a giant roller and the Paint Blob wipe the rest. Ride tile rafts between islands, splash paint blobs and splat the Blob on level 5. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 94,
   status: "live",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps, E or Enter fires the hero power (on level 5 it splats the open Blob); drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/paint-the-platforms.webp",
   accent: "#f472b6",
   owner: "claude",
};
