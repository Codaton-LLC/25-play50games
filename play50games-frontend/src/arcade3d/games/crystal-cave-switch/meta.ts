import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 44, World 5 "Neon Cosmos" (purple; lead hero Vexa). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time less the orb and flow
// bonus is the submitted time (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 90.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Two Crystals",
   2: "Three Sequence",
   3: "Hidden Crystal",
   4: "Timed Sequence",
   5: "Crystal Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const crystalCaveSwitchMeta: ArcadeGameMeta = {
   slug: "crystal-cave-switch",
   title: "Crystal Cave Switch",
   tagline: "Strike the crystals in the beacon's order. Open the cave.",
   description:
      "A crystal cave of linked rooms floats over a violet chasm. Each room's gate opens only when you strike its crystals in the order its beacon shows: ruby, sapphire, emerald, topaz, each with its own shape. Ride a moving slab to a crystal island, find crystals that glow only up close, beat the timers past the decoys, then crack the Hollow Prism by striking the colour codes it flashes. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 90,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps, E or Enter strikes the crystal you stand at (away from a crystal: the hero power); drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump and Strike buttons (Strike away from a crystal fires the hero power); two fingers turn the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/crystal-cave-switch.webp",
   accent: "#c084fc",
   owner: "claude",
};
