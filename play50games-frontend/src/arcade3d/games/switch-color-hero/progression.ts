// Switch Color Hero's Menu 2 structure: combo, stars, secrets, the boss. Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The combo: true gates and pickups chain within 3 s, x1 to x5; a wrong gate or a hit breaks it. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 1, cap: 5 };

/** Flow bases (ms off the submitted time at x1; the multiplier scales them). */
export const COMBO_BASE_MS = { gate: 5, pickup: 3, boss: 15 } as const;

/** The third star: the card's timer, 60 s on level 1 to 120 s on level 5. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, the same three on every level: 0 the high prism over a gap (Nami's double jump); 1 the colour
 * streak sticker (8 true gates in a row); 2 the ghost lane shard behind an energy block (Vexa's phase,
 * or Riko's dash).
 */
const SET: readonly SecretSpec[] = [
   { id: "high-prism", kind: "shard", name: "High prism", hero: "nami" },
   { id: "streak", kind: "sticker", name: "Colour streak" },
   { id: "ghost-lane", kind: "shard", name: "Ghost lane shard", hero: "vexa" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: SET, 2: SET, 3: SET, 4: SET, 5: SET };

/** The streak the sticker needs. */
export const STREAK_SECRET = 8;

/**
 * Level 5's boss: Chroma, a crystal golem (the FrostGolem GLB recoloured at runtime) that runs ahead of
 * you down the endless arena and throws its core gates; a core gate passed in the right colour in his
 * window shatters back into him.
 * P1 Mimic: full core gates in his own colour (2 hits).
 * P2 Shatter: split core gates, one colour per lane (2 hits).
 * P3 Overdrive: blinking core gates and prism sweepers (2 hits).
 */
export const CHROMA: BossConfig = {
   id: "chroma",
   name: "Chroma",
   maxHp: 6,
   introMs: 2000,
   transitionMs: 1500,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "mimic", name: "Mimic", endsAt: 4 / 6, attacks: [{ id: "throw", telegraphMs: 900, attackMs: 900, vulnerableMs: 2800 }] },
      { id: "shatter", name: "Shatter", endsAt: 2 / 6, attacks: [{ id: "split", telegraphMs: 800, attackMs: 900, vulnerableMs: 2800 }] },
      { id: "overdrive", name: "Overdrive", endsAt: 0, attacks: [{ id: "blink", telegraphMs: 700, attackMs: 900, vulnerableMs: 2800 }] },
   ],
};
