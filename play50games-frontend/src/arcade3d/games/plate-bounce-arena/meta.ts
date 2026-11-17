import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const plateBounceArenaMeta: ArcadeGameMeta = {
   slug: "plate-bounce-arena",
   title: "Plate Bounce Arena",
   tagline: "You are the pinball. Flip, bounce, sink the exit.",
   description:
      "Curl up into the ball on a toy pinball table: the flippers throw you into bumpers, up ramps and onto the mushroom orbit. Light the lanterns, knock down the penguins, then sink the exit hole before your three balls run out. Pick any Color Roll Hero. Level 5 is Rollo, the armadillo who steals your flippers.",
   order: 78,
   status: "dev",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "A / Left and D / Right hold the flippers (and nudge), W / S nudge, Space charges the plunger (both flippers in play), E or Enter for the hero power",
      touch: "Hold the left or right half of the screen for that flipper, Flip for both and the plunger, the stick nudges, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: null,
   accent: "#ff6b8b",
   owner: "claude",
};
