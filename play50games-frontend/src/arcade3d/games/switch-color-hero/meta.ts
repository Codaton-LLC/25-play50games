import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS, PROPOSED_LEVEL_LIMITS } from "./limits";

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const switchColorHeroMeta: ArcadeGameMeta = {
   slug: "switch-color-hero",
   title: "Switch Color Hero",
   tagline: "Switch your colour. Match the gate. Never slow down.",
   description:
      "Run a floating neon track and switch your hero's colour to pass the energy gates: full gates, split gates with a colour per lane, blinking gates that change as you arrive. Dodge energy blocks, jump walls and gaps, slide under beams. Three hearts. Pick any Pangoroll hero. Level 5 is Chroma, the golem that throws its core gates at you.",
   order: 93,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "runner",
      keyboard: "1-5 or a click switch your colour, A / D or Left / Right change lanes, Space or Up jumps, S or Down slides, E or Enter for the hero power",
      touch: "Tap to switch colour (or tap a swatch), swipe left / right for lanes, swipe up or Jump to jump, swipe down to slide, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: "/images/3d/switch-color-hero.webp",
   accent: "#a855f7",
   owner: "claude",
};
