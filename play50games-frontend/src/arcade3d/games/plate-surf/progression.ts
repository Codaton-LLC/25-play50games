// Plate Surf's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), after the
// cloud-hopper reference adoption. Plain data and tiny pure helpers; rules.ts uses the combo, the
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
 * Chain bases (ms off the submitted time at x2). Only countable events feed the meter: each orb once,
 * each lip gate's first pass, and a landed trick, but only the first TRICK_LINKS tricks of a run (a
 * trick is repeatable, so its count is capped: the bound stays finite).
 */
export const COMBO_BASE_MS = { orb: 40, gate: 30, trick: 30 } as const;
export const TRICK_LINKS = 24;

/** The third star: the card's target times (50 / 65 / 75 / 85 / 120 s). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by waves.ts): the pearl shard in a hidden tube section (only at top
 * speed), Vexa's sticker in the calm inner lane, the reef shard in Riko's lagoon, and on level 4 the
 * cliff-cave shard only Nami's double air reaches.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "pearl", kind: "shard", name: "Pearl shard" },
      { id: "inner", kind: "sticker", name: "Calm-lane sticker", hero: "vexa" },
   ],
   2: [
      { id: "pearl", kind: "shard", name: "Pearl shard" },
      { id: "reef", kind: "shard", name: "Reef shard", hero: "riko" },
   ],
   3: [
      { id: "pearl", kind: "shard", name: "Pearl shard" },
      { id: "inner", kind: "sticker", name: "Calm-lane sticker", hero: "vexa" },
   ],
   4: [
      { id: "pearl", kind: "shard", name: "Pearl shard" },
      { id: "cave", kind: "shard", name: "Cliff-cave shard", hero: "nami" },
   ],
   5: [
      { id: "pearl", kind: "shard", name: "Pearl shard" },
      { id: "inner", kind: "sticker", name: "Calm-lane sticker", hero: "vexa" },
      { id: "reef", kind: "shard", name: "Reef shard", hero: "riko" },
   ],
};

/**
 * Level 5's boss, King Breaker (a giant crab set over the surf bay by Shadow Plates), through menu2/boss.
 * Phase 1 "Claw": it rides the wave ahead of you and slams a claw into your lane (a 1.2 s shadow
 * first); then it rests on the lip: air off the lip onto its carapace (3 hits). Phase 2 "Bubbles":
 * it burrows into the face and blows bubble mines into the lower lanes; pump past them, then trick into
 * its eye stalks when it surfaces on the lip, at speed (3 hits). Phase 3 "Barrel": the wave barrels
 * and it blocks the exit; carve into it at speed (1 hit, slow-mo), then ring the Tide Bell on the beach.
 * A boss adds no score: the proof only takes its least defeat time as a floor (rules.ts bossMinMs).
 */
export const KING_BREAKER: BossConfig = {
   id: "king-breaker",
   name: "King Breaker",
   maxHp: 7,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "claw", name: "Claw", endsAt: 4 / 7, attacks: [{ id: "slam", telegraphMs: 1200, attackMs: 600, vulnerableMs: 3000 }] },
      { id: "bubbles", name: "Bubbles", endsAt: 1 / 7, attacks: [{ id: "mines", telegraphMs: 1000, attackMs: 1400, vulnerableMs: 3000 }] },
      { id: "barrel", name: "Barrel", endsAt: 0, attacks: [{ id: "block", telegraphMs: 900, attackMs: 900, vulnerableMs: 3200 }] },
   ],
};
