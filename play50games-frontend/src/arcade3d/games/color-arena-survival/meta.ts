import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 26, World 6 "Prism Fortress" (all colours; no lead hero). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts).
// order 95.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Slow Rounds",
   2: "Three Colors",
   3: "Five Colors",
   4: "Fast Rounds",
   5: "Survival Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorArenaSurvivalMeta: ArcadeGameMeta = {
   slug: "color-arena-survival",
   title: "Color Arena Survival",
   tagline: "Stand on the called colour. Lock in. Watch the rest fall.",
   description:
      "A floor of colour tiles hangs over a glowing pit. Each round a colour is called, and when the call runs out every other tile drops. Run to the colour, stand still to lock in and drop the floor at once, and survive round after round: three colours, then five, cracked tiles that leave holes, tiles that swap mid-call, a sweeping bar to jump, and the Prism Keeper, who cracks, shakes and repaints the floor until you strike it from its own beacon. Riko, Nami, Kiro, Zuno and Vexa each help in their own way.",
   order: 95,
   status: "live",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps, E or Enter fires the hero power; stand still on the called colour to lock in; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump and Power buttons; stand still on the called colour to lock in; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/color-arena-survival.webp",
   accent: "#f472b6",
   owner: "claude",
};
