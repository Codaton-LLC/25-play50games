// Wind Tunnel Escape's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and
// progress. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each orb
 * once, each room's checkpoint once and each room's fan setup the first time it is right. Turning a fan
 * is never a link (it can be mashed).
 */
export const COMBO_BASE_MS = { orb: 40, checkpoint: 60, setup: 80 } as const;

/** The third star: the card's time targets (60 / 90 / 110 / 130 / 180 s). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by tunnel.ts): the gust shard at the end of a current that no exit needs (a
 * deliberate "creative setup"), the sticker behind Vexa's ghost housing in the maintenance duct, and the
 * anemometer shard up the hidden vent that opens only when a fan is turned on the anemometer post.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "gust", kind: "shard", name: "Gust shard" },
      { id: "duct", kind: "sticker", name: "Duct sticker", hero: "vexa" },
   ],
   2: [
      { id: "anemo", kind: "shard", name: "Anemometer shard" },
      { id: "duct", kind: "sticker", name: "Duct sticker", hero: "vexa" },
   ],
   3: [
      { id: "gust", kind: "shard", name: "Gust shard" },
      { id: "anemo", kind: "shard", name: "Anemometer shard" },
   ],
   4: [
      { id: "gust", kind: "shard", name: "Gust shard" },
      { id: "duct", kind: "sticker", name: "Duct sticker", hero: "vexa" },
   ],
   5: [
      { id: "gust", kind: "shard", name: "Gust shard" },
      { id: "duct", kind: "sticker", name: "Duct sticker", hero: "vexa" },
      { id: "anemo", kind: "shard", name: "Anemometer shard" },
   ],
};

/**
 * Level 5's boss, the Gale Engine (a turbine monster Tempest built), fought through menu2/boss.
 * Phase 1 "Blow back": it blasts the arena's middle lane; turn the three side fans onto its intake and
 * each one aimed when its intake opens sends its own blast back (1 hit each, 3 hits). Phase 2 "Jam the
 * core": it opens its core and pulls everything in; switch on the vents under the three flying crates
 * and turn the high fans behind them, so the currents carry the crates into the intake (3 hits).
 * Phase 3 "Escape" is the rules' own (after the defeat): the engine collapses, its gate opens and the
 * storm surges; chain four fan rooms in 25 s and ring the Tide Bell in the open sky. A boss adds no
 * score: the proof only takes its least defeat time as a floor (rules.ts bossMinMs).
 */
export const GALE_ENGINE: BossConfig = {
   id: "gale-engine",
   name: "Gale Engine",
   maxHp: 6,
   introMs: 3000,
   transitionMs: 2600,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "blast", name: "Blow back", endsAt: 0.5, attacks: [{ id: "blast", telegraphMs: 1500, attackMs: 1700, vulnerableMs: 3200 }] },
      { id: "core", name: "Jam the core", endsAt: 0, attacks: [{ id: "suction", telegraphMs: 1300, attackMs: 2200, vulnerableMs: 3800 }] },
   ],
};

/** The escape after the defeat (the card's phase 3): the storm surge's speed and the par the HUD counts down. */
export const ESCAPE = { parMs: 25_000, surgeSpeed: 3.6, startBehind: 6 } as const;
