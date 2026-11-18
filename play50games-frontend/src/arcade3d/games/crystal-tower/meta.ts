import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 28, World 5 Neon Cosmos. Status "dev" until the user signs it off.
// A time game: the finish time minus the gem and flow bonus is the score (README "Score limits").
// order 87 (the coordinator's slot for it).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "3-Color Sequence",
   2: "4 Colors",
   3: "5 Colors",
   4: "Moving Crystals",
   5: "Memory Tower",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const crystalTowerMeta: ArcadeGameMeta = {
   slug: "crystal-tower",
   title: "Crystal Tower",
   tagline: "Watch the beacon flash its colours, then climb the crystal spire and touch them in that order.",
   description: "A memory climb up a neon crystal tower in the Neon Cosmos. Each tier's beacon shows a colour sequence; remember it, climb the pads and touch the tier's crystals in that order to arm the next beacon. Sliding bridges, glass and crumbling pads, shard storms and spark drones get in the way, the crystals start bobbing out of reach, and on the summit Prism Shade turns the sequences into his attacks: shuffled, blacked out, mirrored.",
   order: 87,
   status: "live",
   collection: "rollheroes",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move (camera-relative), Space to jump, E or Enter for the hero power. Camera: drag, wheel, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick, Jump and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/crystal-tower.webp",
   accent: "#a855f7",
   owner: "claude",
};
