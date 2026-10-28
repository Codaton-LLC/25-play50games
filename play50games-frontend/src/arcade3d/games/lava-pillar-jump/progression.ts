// Lava Pillar Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), adopted the
// way sky-tower-jump does it. Plain data and tiny pure helpers; rules.ts uses the combo, secret and boss
// numbers, Scene.tsx the stars and progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";

/** The flow meter: a link within 2 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter, so the
 * proof can bound them: each ember once, and the first landing on each pillar (the start excluded).
 */
export const COMBO_BASE_MS = { ember: 40, pillar: 20 } as const;

/** The third star: the submitted time (finish minus ember and flow bonus) at or under this (about 1.5x the honest bot). */
export const STAR_TARGET_MS: Record<LevelId, number> = {
   1: 17_000,
   2: 15_000,
   3: 21_000,
   4: 35_000,
   5: 56_000,
};

export function starSpecFor(level: LevelId, emberTotal: number): StarSpec {
   return { orbTotal: emberTotal, goal: { kind: "time", targetMs: STAR_TARGET_MS[level] } };
}

/**
 * Secrets per level (placed by rules.ts secretSpots). Each hero has its own gate:
 * - chimney (Riko): a cracked basalt cap in the middle of a pillar's top, smashed only by a dash through it;
 * - ghost (Vexa): a shard inside a ghost obsidian wall at a pillar's edge, taken only while phasing;
 * - spray (Kiro): a shard in a vent's spray column, taken only while shielded;
 * - trail (Zuno): an ember-shard low over the lava beside a pillar, in the magnet's reach from the edge only;
 * - overhang (Nami): a sticker over a gap, caught only in a double jump's flight;
 * - vent3 (level 3): a shard over the vent that fires on every third beat, at its launch's height;
 * - core (level 5): a sticker over Kalder's head, on a slam geyser's line.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "chimney", kind: "shard", name: "Chimney shard", hero: "riko" },
      { id: "trail", kind: "shard", name: "Lava shard", hero: "zuno" },
      { id: "overhang", kind: "sticker", name: "Overhang sticker", hero: "nami" },
   ],
   2: [
      { id: "ghost", kind: "shard", name: "Obsidian shard", hero: "vexa" },
      { id: "spray", kind: "shard", name: "Spray shard", hero: "kiro" },
   ],
   3: [
      { id: "vent3", kind: "shard", name: "Third-beat shard" },
      { id: "chimney", kind: "shard", name: "Chimney shard", hero: "riko" },
      { id: "trail", kind: "shard", name: "Lava shard", hero: "zuno" },
   ],
   4: [
      { id: "ghost", kind: "shard", name: "Obsidian shard", hero: "vexa" },
      { id: "spray", kind: "shard", name: "Spray shard", hero: "kiro" },
      { id: "overhang", kind: "sticker", name: "Overhang sticker", hero: "nami" },
   ],
   5: [
      { id: "spray", kind: "shard", name: "Spray shard", hero: "kiro" },
      { id: "ghost", kind: "shard", name: "Obsidian shard", hero: "vexa" },
      { id: "core", kind: "sticker", name: "Core sticker" },
   ],
};

/**
 * Level 5's boss: Kalder the Magma Golem (m2MagmaGolemBoss), World 1's guardian, fought for real in
 * rules.ts. Six crust hits in three phases:
 * - P1 Heartbeat slams (3 hits): each slam is a surge and fires the ring's vents; ride one onto his
 *   shoulders (the crust plates) while he is open.
 * - P2 Pillar tear (2 hits): the vents go quiet, he tears a ring pillar down on each swing and the lava
 *   stands high (no ebb); jump onto the cracks of his hunched back.
 * - P3 Heart surge (1 hit): the biggest surge; ride a vent up and drop into the exposed heart.
 * A hit throws the hero back onto a ring vent. The boss adds no score: its least fight time is part of
 * the level's least finish (rules.ts bossMinMs).
 */
export const KALDER: BossConfig = {
   id: "kalder",
   name: "Kalder, the Magma Golem",
   maxHp: 6,
   introMs: 2400,
   transitionMs: 1800,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      {
         id: "slams",
         name: "Heartbeat slams",
         endsAt: 0.5,
         attacks: [{ id: "fist-slam", telegraphMs: 1000, attackMs: 600, vulnerableMs: 2200 }],
      },
      {
         id: "tear",
         name: "Pillar tear",
         endsAt: 1 / 6,
         attacks: [{ id: "pillar-tear", telegraphMs: 900, attackMs: 700, vulnerableMs: 2400 }],
      },
      {
         id: "heart",
         name: "Heart surge",
         endsAt: 0,
         attacks: [{ id: "heart-surge", telegraphMs: 1200, attackMs: 700, vulnerableMs: 2400 }],
      },
   ],
};
