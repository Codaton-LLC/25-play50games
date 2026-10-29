import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 10, World 5 "Neon Cosmos" (purple; lead hero Vexa). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time is the score (README
// "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts). order 84.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Dock",
   2: "Pod Line",
   3: "Satellite Field",
   4: "Zero-G Gap",
   5: "Orbital Peak",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const spacePodJumpMeta: ArcadeGameMeta = {
   slug: "space-pod-jump",
   title: "Space Pod Jump",
   tagline: "Fall into real orbits, slingshot past moons and launch for the dock.",
   description:
      "Leap between tiny planetoids and station pods as a Color Roll Heroes armadillo: down is wherever the nearest body is, so you walk round worlds, fall into true orbits and charge pod launches to cross the void, braking with retro jets and slingshotting past moving moons. Riko, Nami, Kiro, Zuno and Vexa each bend the rules of orbit their own way. Level 5: bring down the Orbit Warden.",
   order: 84,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / D or left / right to walk round the body (and aim a pod), Space to jump; on a pod hold Space to charge and let go to launch; in flight hold Space for the retro jets; E or Enter for the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick to walk and aim, Jump to jump (hold on a pod to charge, hold in flight for the jets), Power button; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: null,
   accent: "#a855f7",
   owner: "claude",
};
