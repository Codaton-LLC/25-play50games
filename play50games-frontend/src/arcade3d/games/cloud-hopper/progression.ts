// Cloud Hopper's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), after the
// sky-tower-jump reference adoption. Plain data and tiny pure helpers; rules.ts uses the combo, the
// secrets and the boss, Scene.tsx the stars and progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 2 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each
 * orb once, the first landing on each cloud (the start excluded) and the first pass through each ring.
 */
export const COMBO_BASE_MS = { orb: 40, cloud: 20, ring: 30 } as const;

/** The no-hit badge of this game (the card): a run of this many centre landings in a row. */
export const STREAK_BADGE = 20;

/** The third star: beat the sunset (the card's targets: 60 / 80 / 95 / 110 / 150 s). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by sea.ts): the dawn shard on a hidden cloud under a glide gap (a deep,
 * slow glide), the sticker on Vexa's night path, the shard on Riko's storm shelf, the shard over the
 * secret lift ring of level 3 and the shard in a level 4 thunderhead (Kiro's shield).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "dawn", kind: "shard", name: "Dawn shard" },
      { id: "night", kind: "sticker", name: "Night sticker", hero: "vexa" },
   ],
   2: [
      { id: "dawn", kind: "shard", name: "Dawn shard" },
      { id: "storm", kind: "shard", name: "Storm shard", hero: "riko" },
   ],
   3: [
      { id: "lift", kind: "shard", name: "Updraft shard" },
      { id: "night", kind: "sticker", name: "Night sticker", hero: "vexa" },
   ],
   4: [
      { id: "dawn", kind: "shard", name: "Dawn shard" },
      { id: "thunder", kind: "shard", name: "Thunder shard", hero: "kiro" },
   ],
   5: [
      { id: "dawn", kind: "shard", name: "Dawn shard" },
      { id: "storm", kind: "shard", name: "Storm shard", hero: "riko" },
      { id: "night", kind: "sticker", name: "Night sticker", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, Gloom Nimbus (a storm-cloud creature under Tempest), fought through menu2/boss.
 * Phase 1 "Chase": it rolls after you, swallowing clouds; glide past its lightning rods to charge a
 * shock, spent the moment it opens (3 hits). Phase 2 "Eyes": it rises in front and rains hail where
 * you stood; glide through each eye as it opens (3 hits). Phase 3 "Burst": its core opens once more;
 * glide through it, then ring the Tide Bell on the rainbow bridge (the bell rings only once it is down).
 * A boss adds no score: the proof only takes its least defeat time as a floor (rules.ts bossMinMs).
 */
export const GLOOM_NIMBUS: BossConfig = {
   id: "gloom-nimbus",
   name: "Gloom Nimbus",
   maxHp: 7,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "chase", name: "Chase", endsAt: 4 / 7, attacks: [{ id: "swallow", telegraphMs: 900, attackMs: 900, vulnerableMs: 1400 }] },
      { id: "eyes", name: "Eyes", endsAt: 1 / 7, attacks: [{ id: "hail", telegraphMs: 900, attackMs: 800, vulnerableMs: 1800 }] },
      { id: "burst", name: "Burst", endsAt: 0, attacks: [{ id: "burst", telegraphMs: 800, attackMs: 900, vulnerableMs: 2400 }] },
   ],
};
