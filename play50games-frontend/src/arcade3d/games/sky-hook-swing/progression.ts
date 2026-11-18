// Sky Hook Swing's Menu 2 structure (stars, combo, secrets, boss). Plain data. rules.ts uses the combo,
// the secrets and the boss; Scene.tsx records the stars.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/**
 * The flow meter fills on a chain of 4 (the card: four releases into hooks without touching ground).
 * chain 4 = 1 + gain * 3 = 2.
 */
export const COMBO: ComboConfig = { windowMs: 3200, gain: 1 / 3, cap: 2 };

/** Chain bases (ms off the submitted time at x2). Each anchor and each orb counts once. */
export const COMBO_BASE_MS = { hook: 36, orb: 24 } as const;

/** The third star: the card's targets, 45 / 70 / 90 / 100 / 150 s. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets (placed by course.ts). The compass shard sits on a ring past a normal release: a peak
 * release with the rope reeled in. The sticker is on Vexa's inner deck. Level 3's third is the
 * shard on the airship's return loop.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "compass", kind: "shard", name: "Compass shard" },
      { id: "deck", kind: "sticker", name: "Inner deck sticker", hero: "vexa" },
   ],
   2: [
      { id: "compass", kind: "shard", name: "Compass shard" },
      { id: "deck", kind: "sticker", name: "Inner deck sticker", hero: "vexa" },
   ],
   3: [
      { id: "loop", kind: "shard", name: "Loop shard" },
      { id: "deck", kind: "sticker", name: "Inner deck sticker", hero: "vexa" },
   ],
   4: [
      { id: "compass", kind: "shard", name: "Compass shard" },
      { id: "spark", kind: "shard", name: "Cable shard", hero: "kiro" },
   ],
   5: [
      { id: "compass", kind: "shard", name: "Compass shard" },
      { id: "deck", kind: "sticker", name: "Inner deck sticker", hero: "vexa" },
      { id: "loop", kind: "shard", name: "Loop shard" },
   ],
};

/**
 * Level 5's boss, the Gust Galleon (an airship of Tempest's fleet), fought through menu2/boss.
 * Phase 1 "Cannons": three turrets. A peak release into a turret knocks it off (3 hits).
 * Phase 2 "Drones": hook a drone and swing it into the mast (1 hit).
 * Phase 3 "Escape": the hull rings fall. Swing up them and ring the Tide Bell (1 hit).
 * A boss adds no score. The proof takes the least time to land those hits as a floor.
 */
export const GUST_GALLEON: BossConfig = {
   id: "gust-galleon",
   name: "The Gust Galleon",
   maxHp: 5,
   introMs: 1600,
   transitionMs: 1100,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2000,
   slowMo: { scale: 0.25, durationMs: 1400 },
   phases: [
      { id: "cannons", name: "Cannons", endsAt: 2 / 5, attacks: [{ id: "salvo", telegraphMs: 700, attackMs: 800, vulnerableMs: 2600 }] },
      { id: "drones", name: "Drones", endsAt: 1 / 5, attacks: [{ id: "cut", telegraphMs: 600, attackMs: 700, vulnerableMs: 2800 }] },
      { id: "escape", name: "Escape", endsAt: 0, attacks: [{ id: "fall", telegraphMs: 500, attackMs: 600, vulnerableMs: 4200 }] },
   ],
};
