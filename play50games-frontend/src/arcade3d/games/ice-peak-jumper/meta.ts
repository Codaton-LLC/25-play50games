import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 9, World 4 Frost & Sweets. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 75 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Base Camp",
   2: "Icicle Steps",
   3: "Yeti Ridge",
   4: "Lantern Night",
   5: "Summit Cairn",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const icePeakJumperMeta: ArcadeGameMeta = {
   slug: "ice-peak-jumper",
   title: "Ice Peak Jumper",
   tagline: "You can't stop on ice: build your slide, launch off the edge.",
   description: "Climb a frozen peak where the ice has no grip: build your slide, launch off the edge, and the run-up is your aim. Stop and re-aim on the snow patches, leave cracked ice before it shatters, dodge icicles, a snowball-throwing yeti and ice slimes on the lantern-lit night slopes, then out-climb the Frost Golem at the summit cairn. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 75,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows: slide (on ice) / walk (on snow), Space jump, S or Down held: brake, E or Enter the hero power",
      touch: "Joystick: slide and walk; Jump; Brake (hold); Power",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#38bdf8",
   owner: "claude",
};
