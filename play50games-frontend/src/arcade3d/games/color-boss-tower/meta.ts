import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 30, World 6 Prism Spire: the tag-switch world (all five heroes,
// menu2/heroTag). Status "dev" until the user signs it off. A time game: the finish time minus the
// orb and flow bonus is the score (README "Score limits"). order 97 (the coordinator's slot for it).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Training Guardian",
   2: "Two Colors",
   3: "Three Colors",
   4: "Fast Switch Boss",
   5: "Grand Color Guardian",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorBossTowerMeta: ArcadeGameMeta = {
   slug: "color-boss-tower",
   title: "Color Boss Tower",
   tagline: "Climb the guardian's tower and turn it into your weapon: charge the colour claws with the right hero and fire the prism cannons.",
   description: "A boss fight that is a climb. The Stone Guardian waits in the shaft of a hollow tower; you never hit him yourself. Run the spiral of ledges, tag in the hero whose colour matches each claw to charge its prism cannon, and the cannon fires when his weak plate opens. Jump his sweeping arm, dodge the hazard orbs, chain charges on the fast levels, and finish the Grand Color Guardian with all five heroes in turn.",
   order: 97,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / D or arrows to run round the tower (camera-relative), Space to jump, E or Enter for the hero power, 1-5 to tag a hero in (T for the next). Camera: drag, wheel, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick, Jump and Power buttons; tap a portrait to tag that hero in; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/color-boss-tower.webp",
   accent: "#c084fc",
   owner: "claude",
};
