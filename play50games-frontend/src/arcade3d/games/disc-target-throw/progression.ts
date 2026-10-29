// Disc Target Throw's Menu 2 structure (menu2/stars, combo, secrets, boss, progress). Plain data and
// tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
// README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: hits and clean catches within 4 s chain (a throw and its catch take ~2.5 s); +0.25 a link, capped at x2.5. */
export const COMBO: ComboConfig = { windowMs: 4000, gain: 0.25, cap: 2.5 };

/** The third star: clear the target set at or under the card's target time (levels.ts parMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].parMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: "Trick Shot" (one throw with 3 banks and 3
 * hits: a sticker) on every level, Vexa's hidden target in the shrine behind the ghost walls (a shard),
 * and on level 1 the four score marker posts hit with no disc dropped (the gold disc skin, a sticker).
 * Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "trick-shot", kind: "sticker", name: "Trick Shot" },
      { id: "shrine", kind: "shard", name: "Shrine shard", hero: "vexa" },
      { id: "gold-disc", kind: "sticker", name: "Gold disc" },
   ],
   2: [
      { id: "trick-shot", kind: "sticker", name: "Trick Shot" },
      { id: "shrine", kind: "shard", name: "Shrine shard", hero: "vexa" },
   ],
   3: [
      { id: "trick-shot", kind: "sticker", name: "Trick Shot" },
      { id: "shrine", kind: "shard", name: "Shrine shard", hero: "vexa" },
   ],
   4: [
      { id: "trick-shot", kind: "sticker", name: "Trick Shot" },
      { id: "shrine", kind: "shard", name: "Shrine shard", hero: "vexa" },
   ],
   5: [
      { id: "trick-shot", kind: "sticker", name: "Trick Shot" },
      { id: "shrine", kind: "shard", name: "Shrine shard", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, Mother Snapper (m2SnapperPlant at 5x with dark plates on her stalk), rooted in the
 * courtyard centre, fought through menu2/boss. Nine hits, three per phase, one per open window:
 * P1 "Open mouth" (hp 9 -> 6): her mouth opens for 1.2 s every 4 s: throw the disc into it. Her closed
 *    mouth is plated and kicks the disc away.
 * P2 "Seed pods" (hp 6 -> 3): she grows seed pods on four vines behind her; a bank throw that pops a
 *    pod while she is open is the hit (the pod stuns her open).
 * P3 "Plated crown" (hp 3 -> 0): she spits thorn volleys at you (shield or step aside); only her
 *    crown is weak, reachable by a disc that has banked twice. The last hit: slow-mo and a bloom.
 */
export const SNAPPER: BossConfig = {
   id: "mother-snapper",
   name: "Mother Snapper",
   maxHp: 9,
   introMs: 2200,
   transitionMs: 1800,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "mouth", name: "Throw into her open mouth", endsAt: 6 / 9, attacks: [{ id: "snap", telegraphMs: 1400, attackMs: 1400, vulnerableMs: 1200 }] },
      { id: "pods", name: "Bank into a seed pod", endsAt: 3 / 9, attacks: [{ id: "grow", telegraphMs: 1200, attackMs: 1000, vulnerableMs: 3200 }] },
      { id: "crown", name: "Two banks into her crown", endsAt: 0, attacks: [{ id: "volley", telegraphMs: 1100, attackMs: 700, vulnerableMs: 3600 }] },
   ],
};
