// Temple Coin Rush's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress): plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, the Scene the stars and
// progress. README "Stars, combo, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The coin combo (the card): the next coin within 0.4 s, +0.1 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 400, gain: 0.1, cap: 2 };

/** A coin's combo base (points): 2 per coin it counts for (a jackpot coin counts 2). */
export const COMBO_BASE_PER_COIN = 2;

/** The third star: finish with at least the level's bank target (the card: L1 20 banked coins). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "atLeast", target: LEVELS[level].bankTarget, label: "Bank" } };
}

/**
 * Secrets per level (placed by temples.ts): Vexa's ghost-gate shard on every level, the card's
 * "Pauper's Run" sticker (finish without paying a single toll) on every level, and level 3's
 * jackpot room (the 50-coin gate).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ghost", kind: "shard", name: "Ghost-gate shard", hero: "vexa" },
      { id: "pauper", kind: "sticker", name: "Pauper's Run" },
   ],
   2: [
      { id: "ghost", kind: "shard", name: "Ghost-gate shard", hero: "vexa" },
      { id: "pauper", kind: "sticker", name: "Pauper's Run" },
   ],
   3: [
      { id: "ghost", kind: "shard", name: "Ghost-gate shard", hero: "vexa" },
      { id: "jackpot", kind: "shard", name: "Jackpot room" },
      { id: "pauper", kind: "sticker", name: "Pauper's Run" },
   ],
   4: [
      { id: "ghost", kind: "shard", name: "Ghost-gate shard", hero: "vexa" },
      { id: "pauper", kind: "sticker", name: "Pauper's Run" },
   ],
   5: [
      { id: "ghost", kind: "shard", name: "Ghost-gate shard", hero: "vexa" },
      { id: "pauper", kind: "sticker", name: "Pauper's Run" },
   ],
};

/**
 * Level 5's boss, Coilstone the Temple Serpent (World 3's guardian, its head wrapped in Shadow
 * Plates' dark plates), through menu2/boss. It replaces the boulder: its head chases in the corridor.
 * Phase 1 "Lunge": it hisses (dust in the lane it aims at) and lunges 1 s later; leave that lane.
 * Pay a bell gate (20 coins): a stone bell drops on its head while it recoils (2 hits). Phase 2
 * "Coils": its body coils across the lanes ahead (jump the low coil, roll under the high one); the
 * bells cost 30 (2 hits). Phase 3 "Grand Gate": a straight sprint past the offering bowls; every 10
 * coins paid cracks a plate (5 cracks). Slow-mo as the plates shatter; the serpent turns green and
 * escapes. Hits land only while it is open (rules.ts queues a paid bell until then).
 */
export const COILSTONE: BossConfig = {
   id: "coilstone",
   name: "Coilstone, the Temple Serpent",
   maxHp: 9,
   introMs: 2500,
   transitionMs: 1800,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2800,
   slowMo: { scale: 0.25, durationMs: 2000 },
   phases: [
      { id: "lunge", name: "Lunge", endsAt: 7 / 9, attacks: [{ id: "lunge", telegraphMs: 1000, attackMs: 600, vulnerableMs: 6400 }] },
      { id: "coils", name: "Coils", endsAt: 5 / 9, attacks: [{ id: "coil", telegraphMs: 900, attackMs: 1500, vulnerableMs: 5000 }] },
      { id: "gate", name: "Grand Gate", endsAt: 0, attacks: [{ id: "crack", telegraphMs: 300, attackMs: 300, vulnerableMs: 1200 }] },
   ],
};
