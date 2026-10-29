import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 13, World 1 Ember Heights (red). Status "dev" (preview builds only)
// until the user signs it off. A time game: the finish time minus the orb and flow bonus is the score
// (README "Scoring"); each level row carries its own proven limits (bound.ts, pinned in rules.ts). Order 65.
const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const robotFactoryRunMeta: ArcadeGameMeta = {
   slug: "robot-factory-run",
   title: "Robot Factory Run",
   tagline: "Rewire a live factory line: turn conveyor junctions, route the power cells, overload Overseer M-8.",
   description: "A grey, powered-down robot factory. Step on red switch plates to turn conveyor turntables, route the power cells riding the belts into the exit charger, and ride the belts yourself. Klaxon belts that run backwards, robot arms that lift cells (and you), laser gates wired to the plates, and Overseer M-8, Shadow Plates' foreman. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 65,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD / arrows move (belts carry you), Space jumps (Space again in the air roll-drops), E or Enter for the hero power; step on a red plate to turn its turntable",
      touch: "Joystick + Jump (again in the air: roll-drop) and Power buttons",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ef4444",
   owner: "codex",
};
