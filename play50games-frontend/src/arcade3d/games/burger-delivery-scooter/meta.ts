import { LEVEL_IDS, type ArcadeGameMeta, type ArcadeSlug, type ScoringRules } from "../../types";
import { LEVELS, TITLES } from "./levels";
export const LIMITS: ScoringRules[] = LEVEL_IDS.map((id) => ({
   kind: "points", maxScore: [820, 1040, 1250, 1340, 1670][id - 1],
   minDurationMs: 4000, maxDurationMs: LEVELS[id].durationMs,
   base: 140 * LEVELS[id].orders, maxPointsPerSec: [14, 13, 12, 9, 8][id - 1],
   unitLabel: "pts", display: "int",
}));
export const burgerDeliveryScooterMeta: ArcadeGameMeta = {
   slug: "burger-delivery-scooter" as ArcadeSlug, title: "Burger Delivery Scooter",
   tagline: "Fresh burgers. Smooth corners. Happy doors.",
   description: "Collect an order at the pink shop, hop barriers and stop at glowing doors. Keep every burger fresh.",
   order: 33, status: "dev", difficulty: 2, orientation: "any", collection: "skill",
   controls: { scheme: "steer", keyboard: "W / Up accelerate, S / Down brake or reverse, A / D steer, Space hop", touch: "Joystick to accelerate, brake and steer. Hop clears barriers." },
   scoring: LIMITS[0], levels: LEVEL_IDS.map((id) => ({ id, title: TITLES[id - 1], scoring: LIMITS[id - 1] })),
   thumbnail: null, accent: "#fb7185", owner: "codex",
};
