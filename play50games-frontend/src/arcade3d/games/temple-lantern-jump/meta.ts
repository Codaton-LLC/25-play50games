import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";
export const scoringFor = (id: LevelId): ScoringRules => ({ ...PROPOSED_LEVEL_LIMITS[id], base: 0, maxPointsPerSec: 0, unitLabel: "time", display: "time" });
export const templeLanternJumpMeta: ArcadeGameMeta = {
   slug: "temple-lantern-jump", title: "Temple Lantern Jump", order: 67, status: "dev", owner: "claude",
   collection: "rollheroes", tagline: "Carry the flame. Make the darkness hold you.",
   description: "Ignite a chain of stone cage lanterns through a lost jungle temple. Your fading ember makes sun-glyph ledges solid. Share light with friends and defeat the Soot Bat Queen.",
   difficulty: 3, orientation: "any", accent: "#56d689", thumbnail: null,
   controls: { scheme: "platformer", keyboard: "WASD / arrows move, Space jump, E / Enter throw ember and use power; drag to orbit", touch: "Joystick, Jump, Ember; two fingers orbit and pinch zoom" },
   scoring: scoringFor(1), levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoringFor(id) })),
};
