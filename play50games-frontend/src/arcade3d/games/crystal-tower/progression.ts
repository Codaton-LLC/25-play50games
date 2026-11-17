// Crystal Tower's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo).
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";
import { showMs } from "./tower";

/** A link within 2.5 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/**
 * Ms off the submitted time at x2, each source once per thing: a correct crystal of a tier's
 * sequence, a tier's round, a beacon reached, a gem, a hit on Prism Shade. The boss's own picks
 * never link (their number is not fixed: a missed window brings a new sequence).
 */
export const COMBO_BASE_MS = { pick: 30, round: 60, beacon: 40, orb: 25, hit: 50 } as const;

/** The third star: the card's target times. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, in each level's `secrets` order: the sticker behind a void gate (Vexa phases through),
 * the shard behind a dark crystal wall (Riko's dash shatters it), the shard on the sky ledge (Nami's
 * second jump).
 */
const BASE: readonly SecretSpec[] = [
   { id: "void-sticker", kind: "sticker", name: "Void sticker", hero: "vexa" },
   { id: "wall-shard", kind: "shard", name: "Dark shard", hero: "riko" },
   { id: "sky-shard", kind: "shard", name: "Sky shard", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: BASE, 4: BASE, 5: BASE };

/** Level 5's boss sequences: Echo and Blackout show five colours, Mirror six (levels.ts bossSeqLen). */
export const BOSS_SEQ_LEN = LEVELS[5].bossSeqLen ?? [5, 5, 6];

/**
 * Prism Shade, a Shadow Plate of dark crystal on the summit of the Crystal Tower. 4 HP. Every
 * attack is a colour sequence: the telegraph IS the show (the boss flashes the colours, the
 * matching rim crystals pulse), the attack is a shockwave across the arena (jump it) with the
 * phase's trick, and the window is the time you have to touch the crystals in order; a full
 * sequence in the window is the hit.
 * - Echo (2 hits): the shockwave shuffles the five crystals round the rim: track where yours went.
 * - Blackout (1 hit): the shockwave puts the crystals' colours out: remember where each one stood.
 * - Mirror (1 hit): six colours, and the shockwave flips the order: touch them last to first.
 */
export const PRISM: BossConfig = {
   id: "prism-shade",
   name: "Prism Shade",
   maxHp: 4,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "echo", name: "Echo", endsAt: 2 / 4, attacks: [{ id: "shuffle", telegraphMs: showMs(BOSS_SEQ_LEN[0]), attackMs: 700, vulnerableMs: 16_000 }] },
      { id: "blackout", name: "Blackout", endsAt: 1 / 4, attacks: [{ id: "dim", telegraphMs: showMs(BOSS_SEQ_LEN[1]), attackMs: 700, vulnerableMs: 16_000 }] },
      { id: "mirror", name: "Mirror", endsAt: 0, attacks: [{ id: "flip", telegraphMs: showMs(BOSS_SEQ_LEN[2]), attackMs: 700, vulnerableMs: 18_000 }] },
   ],
};
