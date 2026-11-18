import { LEVEL_IDS, type ArcadeGameMeta, type LevelId, type ScoringRules } from "../../types";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json (registry.sync.test.ts).
// Menu 2 (Color Roll Heroes) game 24, World 5 "Neon Cosmos" (purple; lead hero Vexa). Status "dev"
// (preview builds only) until the user signs it off. A time game: the finish time minus the orb and
// flow bonus is the score (README "Scoring"). Each level row carries its own proven limits
// (PROPOSED_LEVEL_LIMITS in rules.ts, bound.ts). order 86.
const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Two Portals",
   2: "Two Pairs",
   3: "Moving Portals",
   4: "Cargo",
   5: "Portal Master",
};

const scoring = (id: LevelId): ScoringRules => ({
   ...PROPOSED_LEVEL_LIMITS[id],
   base: 0,
   maxPointsPerSec: 0,
   unitLabel: "time",
   display: "time",
});

export const portalHopMeta: ArcadeGameMeta = {
   slug: "portal-hop",
   title: "Portal Hop",
   tagline: "Choose where the exit opens. Keep every bit of speed.",
   description:
      "Cross floating void ruins through portal pairs. Each entry is fixed, but you choose which anchor obelisk its exit opens at, and whatever speed you carry in, you carry out: fall into a floor portal and fling yourself across a gap. Chain two pairs so the speed stacks, time portals that ride round their tower, push void crystals through to press switches and build steps, then turn your own portals against the Portal Wyrm. Riko, Nami, Kiro, Zuno and Vexa each open their own routes.",
   order: 86,
   status: "live",
   collection: "rollheroes",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "platformer",
      keyboard: "WASD or arrows move (camera-relative), Space jumps, 1-4 opens the nearest portal's exit on that anchor, click an obelisk to open the exit there, E or Enter fires the hero power; drag, Q / C turn and the wheel zooms the camera",
      touch: "Joystick, Jump and Power buttons; tap an obelisk (or the Exit button) to move a portal's exit; two fingers rotate the camera, pinch zooms",
   },
   scoring: scoring(1),
   levels: LEVEL_IDS.map((id) => ({ id, title: LEVEL_TITLES[id], scoring: scoring(id) })),
   thumbnail: "/images/3d/portal-hop.webp",
   accent: "#8b5cf6",
   owner: "claude",
};
