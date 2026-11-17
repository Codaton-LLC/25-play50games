import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 11, World 6 "Prism Fortress" (all colours: the hero tag-switch).
// Status "dev" (preview builds only) until the user signs it off. A time game: the finish time minus the
// flow bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 91.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Gate Street",
   2: "Market Lane",
   3: "Old Town",
   4: "Night Causeway",
   5: "Fortress Bridge",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const rollDashMeta: ArcadeGameMeta = {
   slug: "roll-dash",
   title: "Roll Dash",
   tagline: "Read the lock, tag the right hero, fire.",
   description:
      "Roll down Greytown's causeway to the Prism Fortress, three lanes wide, where every Prism Lock opens only to one hero's power: Riko's dash breaks the red barricades, Nami's double jump clears the blue barriers, Kiro's shield passes the green sprays, Zuno's magnet opens the gold vaults and Vexa phases through the ghost walls. Tag the right hero, fire, and the street repaints behind you. Dodge what you can't answer, chain the unlocks for speed, and beat the Echo Storm Hawk on the Fortress Bridge.",
   order: 91,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "A / D or Left / Right change lane, Space or Up jumps, S or Down tucks, 1-5 tag a hero, E or Enter fires the active hero's power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Swipe left / right to change lane, up to jump, down to tuck; the hero portraits tag, Power fires; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/roll-dash.webp",
   accent: "#ef4444",
   owner: "claude",
};
