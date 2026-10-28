// Ring Jump Challenge's Menu 2 structure (menu2/stars, combo, secrets, boss, progress), after the
// sky-tower-jump / cloud-hopper reference adoptions. Plain data and tiny pure helpers; rules.ts uses the
// combo, the secrets and the boss, Scene.tsx the stars and progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 2.5 s, +0.25 per link, capped at x3 (rings come fast in a dive). */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 3 };

/**
 * Chain bases (points at x2). Only fixed, countable events feed the meter: each course ring threaded
 * once and each orb taken once. Cyclone Ray's wake rings never do (they are endless), they only charge.
 */
export const COMBO_BASE = { ring: 60, orb: 20 } as const;

/** The third star: land at or under the level's par time (README "Stars": a little slower than the honest bot, which dives where it is lined up). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].parMs } };
}

/**
 * Secrets per level (placed by canyon.ts): the gold ring hidden off the main line in a wall niche you
 * see through a gap (every level), the sticker at the bottom of Vexa's inner shaft, the sticker for a
 * bull's-eye landing on the target pad (the card), and on level 4 the shard behind Riko's cracked seal.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "gold", kind: "shard", name: "Gold ring" },
      { id: "bullseye", kind: "sticker", name: "Bull's-eye sticker" },
   ],
   2: [
      { id: "gold", kind: "shard", name: "Gold ring" },
      { id: "inner", kind: "sticker", name: "Inner shaft sticker", hero: "vexa" },
   ],
   3: [
      { id: "gold", kind: "shard", name: "Gold ring" },
      { id: "bullseye", kind: "sticker", name: "Bull's-eye sticker" },
   ],
   4: [
      { id: "gold", kind: "shard", name: "Gold ring" },
      { id: "seal", kind: "shard", name: "Seal shard", hero: "riko" },
   ],
   5: [
      { id: "gold", kind: "shard", name: "Gold ring" },
      { id: "inner", kind: "sticker", name: "Inner shaft sticker", hero: "vexa" },
      { id: "bullseye", kind: "sticker", name: "Tail pad sticker" },
   ],
};

/**
 * Level 5's boss, Cyclone Ray (a storm manta under Tempest), fought through menu2/boss.
 * Phase 1 "Spiral": it spirals down below you dropping wind rings; thread 5 in a row to charge a dive
 *   strike, then dive into its glowing back fin while it is open (3 damage; two strikes end the phase).
 * Phase 2 "Storm Wall": it circles and spits lightning lanes, telegraphed for 1 s; air-brake or steer
 *   out of them, then dive into it when it banks open in the middle (1 damage, three hits).
 * Phase 3 "Final Drop": the storm eye opens and you fall the last 200 m; land on its tail pad as it
 *   surfaces from the sea (the last hit, in slow-mo), then the Tide Bell rings on the column.
 * The fight adds score per hit (bounded by HP) and its least defeat time is a floor of the proof.
 */
export const CYCLONE_RAY: BossConfig = {
   id: "cyclone-ray",
   name: "Cyclone Ray",
   maxHp: 10,
   introMs: 2500,
   transitionMs: 1800,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "spiral", name: "Spiral", endsAt: 4 / 10, attacks: [{ id: "wake", telegraphMs: 1200, attackMs: 6500, vulnerableMs: 3000 }] },
      { id: "storm", name: "Storm Wall", endsAt: 1 / 10, attacks: [{ id: "lanes", telegraphMs: 1000, attackMs: 900, vulnerableMs: 2400 }] },
      { id: "drop", name: "Final Drop", endsAt: 0, attacks: [{ id: "surface", telegraphMs: 1500, attackMs: 800, vulnerableMs: 6000 }] },
   ],
};

/** Damage per hit in each phase (the dive strike, the ram, the tail-pad landing). */
export const BOSS_DAMAGE = [3, 1, 1] as const;
