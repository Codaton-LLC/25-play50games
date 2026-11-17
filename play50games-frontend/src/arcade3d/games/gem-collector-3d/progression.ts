// Gem Collector 3D's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo): a gem's
// first pickup (a regrab after a cut never counts again), a bank (each consumes gems for good, so
// there are at most as many banks as gems), a lasso, a hit on the Glutton.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Flow points at x1 (the bonus is base x (multiplier - 1)): a first pickup, a bank, a lasso, a hit. */
export const COMBO_BASE = { gem: 4, bank: 30, lasso: 25, hit: 50 } as const;

/** Points: an orb, a hit on the Glutton, his defeat, each link over 10 in the final yawn bank. */
export const POINTS = { orb: 25, hit: 150, defeat: 600, yawnLink: 20 } as const;

/** The third star: the target score reached in time (level 5: the Glutton down in time). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, in each level's `secrets` order: the sticker in the back vault (Vexa phases through its
 * ghost wall), the shard in the sealed pocket (Riko's dash breaks its cracked crystal wall), the shard
 * on the high pedestal (Nami's double jump).
 */
const BASE: readonly SecretSpec[] = [
   { id: "vault-sticker", kind: "sticker", name: "Vault sticker", hero: "vexa" },
   { id: "pocket-shard", kind: "shard", name: "Pocket shard", hero: "riko" },
   { id: "pedestal-shard", kind: "shard", name: "Pedestal shard", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: BASE, 4: BASE, 5: BASE };

/**
 * The Gumdrop Glutton, the vault's frozen keeper (`m2GummyMonster` at 3x). 7 HP (the card):
 * - Chase (3 hits): he stomps after you and eats the links he touches, lunges, then squats, full:
 *   lasso him while he squats (a closed loop of your train round him) and bank before he wakes.
 * - Split (3 hits): he splits into three mini-gummies that nibble links; each window, lasso one.
 * - Yawn (1 hit): he swallows the last beacon; while he yawns, bank a train of 10 or more into his
 *   open mouth (links over 10 score extra).
 * Every hit comes from the train (a lasso or a bank), never from touching him.
 */
export const GLUTTON: BossConfig = {
   id: "gumdrop-glutton",
   name: "Gumdrop Glutton",
   maxHp: 7,
   introMs: 2500,
   transitionMs: 2000,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "chase", name: "Chase", endsAt: 4 / 7, attacks: [{ id: "lunge", telegraphMs: 3000, attackMs: 700, vulnerableMs: 9000 }] },
      { id: "split", name: "Split", endsAt: 1 / 7, attacks: [{ id: "nibble", telegraphMs: 2500, attackMs: 500, vulnerableMs: 8000 }] },
      { id: "yawn", name: "Yawn", endsAt: 0, attacks: [{ id: "slam", telegraphMs: 3500, attackMs: 600, vulnerableMs: 2500 }] },
   ],
};
