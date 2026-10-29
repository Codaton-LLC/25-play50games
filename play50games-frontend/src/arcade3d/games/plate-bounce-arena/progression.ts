// Plate Bounce Arena's Menu 2 structure: combo, stars, secrets, the boss. Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The combo: bumper, ramp, lantern, target, orb and boss hits chain within 2.5 s, x1 to x5 (the chase lights). */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 1, cap: 5 };

/** Flow bases (ms off the submitted time at x1; the multiplier scales them). */
export const COMBO_BASE_MS = { bumper: 2, ramp: 6, lantern: 4, target: 4, orb: 3, boss: 15 } as const;

/** The third star: the card's targets, 90 s on level 1 to 180 s on level 5. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, the same three on every table: 0 the skill shot (a plunger launch with the gauge in the gold
 * band); 1 the toy penguin sticker behind the lone penguin target; 2 the shard in Vexa's attic.
 */
const SET: readonly SecretSpec[] = [
   { id: "skill-shot", kind: "sticker", name: "Skill shot" },
   { id: "penguin", kind: "sticker", name: "Penguin sticker" },
   { id: "attic", kind: "shard", name: "Attic shard", hero: "vexa" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: SET, 2: SET, 3: SET, 4: SET, 5: SET };

/**
 * Level 5's boss: Rollo (m2ShadowArmadillo), a dark armadillo curled up and rolling round the table.
 * P1 Clash: hit him at 9 m/s or faster while his pockets are lit: 3 hits.
 * P2 Armour: only a golden ball cracks him (a ramp shot makes you golden for 10 s): 2 hits.
 * P3 Flipper thief: he jams one flipper, the other every 8 s; the jackpot ramp in his window launches
 *   you onto him for the slow-mo finish (1 hit).
 */
export const ROLLO: BossConfig = {
   id: "rollo",
   name: "Rollo",
   maxHp: 6,
   introMs: 2000,
   transitionMs: 1500,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "clash", name: "Clash", endsAt: 3 / 6, attacks: [{ id: "charge", telegraphMs: 700, attackMs: 1300, vulnerableMs: 5000 }] },
      { id: "armour", name: "Armour", endsAt: 1 / 6, attacks: [{ id: "spin", telegraphMs: 700, attackMs: 1300, vulnerableMs: 6500 }] },
      { id: "thief", name: "Flipper thief", endsAt: 0, attacks: [{ id: "jam", telegraphMs: 600, attackMs: 1000, vulnerableMs: 9000 }] },
   ],
};
