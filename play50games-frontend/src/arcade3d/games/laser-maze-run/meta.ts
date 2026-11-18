import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 38, World 5 Neon Cosmos. Status "dev" (preview builds only) until the
// user signs it off. A time game: the finish time minus the orb and flow bonus is the score (README
// "Scoring"). Each level row carries its own proven limits (PROPOSED_LEVEL_LIMITS in rules.ts).
// order 89 (the coordinator's slot).
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Static Lasers",
   2: "Moving Lasers",
   3: "Cross Grid",
   4: "Fast Maze",
   5: "Laser Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const laserMazeRunMeta: ArcadeGameMeta = {
   slug: "laser-maze-run",
   title: "Laser Maze Run",
   tagline: "Thread a vault of lasers: time the pulses, jump the beams, flip the switches.",
   description: "A precision maze through a vault of lasers, room by room. Jump the low beams, find the gap in a wall of light, wait for a pulsing wall to go dark, jump the beams that slide along the floor, press a switch to drop a gate (and learn which switch opens the next one), and slip past the moving barriers. Touch a laser and you are back on the room's checkpoint pad. Then overload the Vault Core from its pylons. Pick Riko, Nami, Kiro, Zuno or Vexa.",
   order: 89,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move, Space jumps, E or Enter presses a switch (or uses the hero power)",
      touch: "The stick moves; Jump; Action presses a switch (or uses the power)",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/laser-maze-run.webp",
   accent: "#ff2d55",
   owner: "claude",
};
