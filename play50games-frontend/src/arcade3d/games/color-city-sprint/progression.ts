// Color City Sprint's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo).
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 2.8 s, +1/3 per link, capped at ×2. Red-lane chains are the card's meter. */
export const COMBO: ComboConfig = { windowMs: 2800, gain: 1 / 3, cap: 2 };

/** Ms off the submitted time at ×2. Each source is once per thing, never a repeatable action. */
export const COMBO_BASE_MS = { beacon: 48, lane: 28, orb: 36, hit: 24 } as const;

/** The third star: the submitted time at or under this (about 1.5× a clean run). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets (no score). The rooftop sticker is the rail, the shard is the ghost shop, and level 4's
 * third is the perfect-loop token (it only becomes reachable once the red ring is closed).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "rail-sticker", kind: "sticker", name: "Rooftop sticker", hero: "nami" },
      { id: "shop-shard", kind: "shard", name: "Shop shard", hero: "vexa" },
      { id: "hoarding-shard", kind: "shard", name: "Hoarding shard", hero: "riko" },
   ],
   2: [
      { id: "rail-sticker", kind: "sticker", name: "Rail sticker", hero: "nami" },
      { id: "shop-shard", kind: "shard", name: "Shop shard", hero: "vexa" },
      { id: "hoarding-shard", kind: "shard", name: "Hoarding shard", hero: "riko" },
   ],
   3: [
      { id: "rail-sticker", kind: "sticker", name: "Rail sticker", hero: "nami" },
      { id: "shop-shard", kind: "shard", name: "Shop shard", hero: "vexa" },
      { id: "hoarding-shard", kind: "shard", name: "Hoarding shard", hero: "riko" },
   ],
   4: [
      { id: "rail-sticker", kind: "sticker", name: "Rail sticker", hero: "nami" },
      { id: "shop-shard", kind: "shard", name: "Shop shard", hero: "vexa" },
      { id: "perfect-loop", kind: "sticker", name: "Perfect loop" },
   ],
   5: [
      { id: "rail-sticker", kind: "sticker", name: "Rail sticker", hero: "nami" },
      { id: "shop-shard", kind: "shard", name: "Shop shard", hero: "vexa" },
      { id: "hoarding-shard", kind: "shard", name: "Hoarding shard", hero: "riko" },
   ],
};

/**
 * Greyout, the Street Sweeper (Shadow Plates' lieutenant). 7 HP, three phases:
 * brushes 3 hits (ends at 4/7), valves 2 (ends at 2/7), ram 2 (ends at 0).
 * A hit lands only in the vulnerable window. The fight adds no score; the proof uses the
 * least time to land every hit on the first instant of its window (rules.ts bossMinMs).
 */
export const GREYOUT: BossConfig = {
   id: "greyout",
   name: "Greyout",
   maxHp: 7,
   introMs: 1600,
   transitionMs: 900,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "brushes", name: "Brushes", endsAt: 4 / 7, attacks: [{ id: "sweep", telegraphMs: 700, attackMs: 600, vulnerableMs: 2200 }] },
      { id: "valves", name: "Valves", endsAt: 2 / 7, attacks: [{ id: "spray", telegraphMs: 700, attackMs: 500, vulnerableMs: 2000 }] },
      { id: "ram", name: "Ram", endsAt: 0, attacks: [{ id: "ram", telegraphMs: 800, attackMs: 400, vulnerableMs: 2400 }] },
   ],
};
