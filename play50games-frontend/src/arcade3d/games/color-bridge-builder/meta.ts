import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { LEVELS, PROPOSED_LEVEL_LIMITS } from "./limits";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 39, World 6 Prism Fortress. Status "dev" (preview builds only).
// A time game: the finish time minus the orb and flow bonus is the score (README "Scoring").
// order 98 (90 crystal-cave-switch is the last before it).
const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const colorBridgeBuilderMeta: ArcadeGameMeta = {
   slug: "color-bridge-builder",
   title: "Color Bridge Builder",
   tagline: "Mix light beams into bridges across the canyon, and tag the hero who can walk each colour.",
   description:
      "Energy nodes shoot beams across a canyon; a beam that reaches an anchor becomes a bridge of light. Step on switches to colour the nodes, bump prisms to aim them, and cross the beams to mix new colours: red and blue make purple, blue and yellow green, red and yellow a flickering orange, all three white. Only the hero of a bridge's colour can walk it, so tag between Riko, Nami, Zuno, Vexa and Kiro mid-bridge, and finally light the Bridge Keeper's plate to open the canyon gate.",
   order: 98,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "joystick",
      keyboard: "Arrows / WASD step cell to cell, Space tags (to the hero the bridge ahead needs, else the next one), E or Enter for the hero power",
      touch: "Joystick steps, Tag button, Power button",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVELS[id].name, scoring: scoring(id) })),
   thumbnail: "/images/3d/color-bridge-builder.webp",
   accent: "#f8fafc",
   owner: "claude",
};
