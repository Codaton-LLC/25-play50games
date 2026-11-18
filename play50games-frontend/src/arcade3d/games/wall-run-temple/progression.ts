// Wall Run Temple's Menu 2 structure: combo (the wall-kick chain), stars, secrets, the boss. Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/**
 * The combo is the wall-kick chain, x1 to x5 (the card): each catch after a kick, each whip after a
 * kick, each orb and each boss hit links it; 2.2 s without one breaks it, and so does a landing.
 */
export const COMBO: ComboConfig = { windowMs: 2200, gain: 1, cap: 5 };

/** Flow bases (ms off the submitted time at x1; the multiplier scales them). */
export const COMBO_BASE_MS = { kick: 3, whip: 5, orb: 4, boss: 20 } as const;

/** The third star: the card's targets, 60 s on level 1 to 150 s on level 5. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, the same three on every level (course.ts places 1 and 2; 0 is a way of running):
 * 0 "Never Touch the Floor": finish without a fall and without landing on a pad that is not a
 *   checkpoint (a sticker); 1 the shard in Vexa's ghost room; 2 the hidden lower wall tier's cave, reached
 *   only by letting the droop take you low on purpose.
 */
const SET: readonly SecretSpec[] = [
   { id: "floorless", kind: "sticker", name: "Never Touch the Floor" },
   { id: "ghost-shard", kind: "shard", name: "Ghost room shard", hero: "vexa" },
   { id: "cave", kind: "shard", name: "Lower tier cave" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: SET, 2: SET, 3: SET, 4: SET, 5: SET };

/**
 * Level 5's boss: Umbra (m2ShadowArmadillo), Shadow Plates' lieutenant, a dark rival hero in a tall
 * shaft, fought through menu2/boss.
 * P1 Mirror: he runs the opposite wall and throws shadow plates in 2 s volleys; when he runs level
 *   with you (his open window) kick into him: 2 hits.
 * P2 Cracks: he cracks the walls ahead and waits at a hall column; whip round his column in his window: 2 hits.
 * P3 Shaft: out-climb him up the shaft to the top glyph and slam it in his window: the capstone drops (1 hit).
 */
export const UMBRA: BossConfig = {
   id: "umbra",
   name: "Umbra",
   maxHp: 5,
   introMs: 1800,
   transitionMs: 1200,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "mirror", name: "Mirror", endsAt: 3 / 5, attacks: [{ id: "plates", telegraphMs: 600, attackMs: 700, vulnerableMs: 2400 }] },
      { id: "cracks", name: "Cracks", endsAt: 1 / 5, attacks: [{ id: "crack", telegraphMs: 600, attackMs: 600, vulnerableMs: 3200 }] },
      { id: "shaft", name: "Shaft", endsAt: 0, attacks: [{ id: "climb", telegraphMs: 500, attackMs: 500, vulnerableMs: 6000 }] },
   ],
};
