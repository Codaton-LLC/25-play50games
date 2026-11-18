import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 50, World 6 Prism Fortress: the finale. Status "dev" until the user
// signs it off. A time game: the finish time minus the gem and flow bonus is the score (README
// "Score limits"). order 100 (the coordinator's slot for it).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Jump Trial",
   2: "Runner Trial",
   3: "Color Trial",
   4: "Mixed Trial",
   5: "Grand Hero Trial",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const ultimateColorTrialMeta: ArcadeGameMeta = {
   slug: "ultimate-color-trial",
   title: "Ultimate Color Trial",
   tagline: "One corridor, every mechanic: jump pads, trial rings, colour doors, laser runways, survival rounds, the energy core, and the Chroma Sentinel at the end.",
   description: "The finale of the Pangoroll Worlds: a trial corridor through the Prism Fortress made of sections, each one of the worlds' mechanics. Jump the pads over the void, pass the rings in order, charge a colour at a switch and take its door, hop the sweeping lasers, outlast the rolling orbs, carry the energy core to its receptor. A section's exit opens when it is done. On the summit the Chroma Sentinel turns those mechanics into his attacks.",
   order: 100,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows to move (camera-relative), Space to jump, E or Enter for the hero power. Camera: drag, wheel, Q / C turn, R / F tilt, V recenters",
      touch: "Joystick, Jump and Power buttons; two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/ultimate-color-trial.webp",
   accent: "#f472b6",
   owner: "claude",
};
