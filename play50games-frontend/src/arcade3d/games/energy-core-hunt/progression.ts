// Energy Core Hunt's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each core of the order. */
export const COMBO_BASE_MS = { orb: 30, core: 90 } as const;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by course.ts): the shard inside a closed ring of crates (Vexa's phase walks
 * in) and the sticker high over a crate stack (Nyla's second jump).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ring", kind: "shard", name: "Crate-ring shard", hero: "vexa" },
      { id: "high", kind: "sticker", name: "Crate-top sticker", hero: "nami" },
   ],
   2: [{ id: "ring", kind: "shard", name: "Crate-ring shard", hero: "vexa" }],
   3: [{ id: "ring", kind: "shard", name: "Crate-ring shard", hero: "vexa" }],
   4: [
      { id: "ring", kind: "shard", name: "Crate-ring shard", hero: "vexa" },
      { id: "high", kind: "sticker", name: "Crate-top sticker", hero: "nami" },
   ],
   5: [{ id: "ring", kind: "shard", name: "Crate-ring shard", hero: "vexa" }],
};

/**
 * Level 5's boss, the Core Sprite (m2CoreSprite): it holds the order's last four cores. It hops round
 * the arena; on each attack it slams down and a shock ring rolls out across the floor (jump it); while it
 * is dazed after a slam, touch it to knock one core loose (a hit, and the core counts). A boss adds no
 * score: the proof only takes its least defeat time as a floor.
 */
export const CORE_SPRITE: BossConfig = {
   id: "core-sprite",
   name: "Core Sprite",
   maxHp: 4,
   introMs: 2000,
   transitionMs: 1600,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2000,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "hop", name: "Hopping", endsAt: 2 / 4, attacks: [{ id: "slam", telegraphMs: 1000, attackMs: 1400, vulnerableMs: 2800 }] },
      { id: "rush", name: "Rushing", endsAt: 1 / 4, attacks: [{ id: "slam", telegraphMs: 900, attackMs: 1200, vulnerableMs: 2400 }] },
      { id: "overcharge", name: "Overcharge", endsAt: 0, attacks: [{ id: "slam", telegraphMs: 800, attackMs: 1100, vulnerableMs: 2200 }] },
   ],
};
