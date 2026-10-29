// Dragon Cave Rush's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter (the card: per-lean chains): a link within 2.5 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each perfect lean, each obstacle cleared, once. */
export const COMBO_BASE_MS = { orb: 40, lean: 40, clear: 30 } as const;

/** The card's bonus badge: the distance meter never fell below this once the dragon woke. */
export const DISTANCE_BADGE = 50;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by track.ts): the colour shard at the end of the upper scaffold track
 * (Nami's double hop), the sticker in the ghost-rail cave (Vexa), and on level 4 the hidden hoard room
 * behind a cracked barricade (Riko's boost).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "scaffold", kind: "shard", name: "Ember shard", hero: "nami" },
      { id: "ghost", kind: "sticker", name: "Ghost-rail sticker", hero: "vexa" },
   ],
   2: [
      { id: "scaffold", kind: "shard", name: "Ember shard", hero: "nami" },
      { id: "ghost", kind: "sticker", name: "Ghost-rail sticker", hero: "vexa" },
   ],
   3: [
      { id: "scaffold", kind: "shard", name: "Ember shard", hero: "nami" },
      { id: "ghost", kind: "sticker", name: "Ghost-rail sticker", hero: "vexa" },
   ],
   4: [
      { id: "hoard", kind: "shard", name: "Hoard shard", hero: "riko" },
      { id: "ghost", kind: "sticker", name: "Ghost-rail sticker", hero: "vexa" },
      { id: "scaffold", kind: "shard", name: "Ember shard", hero: "nami" },
   ],
   5: [
      { id: "scaffold", kind: "shard", name: "Ember shard", hero: "nami" },
      { id: "ghost", kind: "sticker", name: "Ghost-rail sticker", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, Cindermaw (a cave dragon wearing Shadow Plates' grey collar), fought through
 * menu2/boss. Every hit comes from the track: a crystal you drop from a trigger plate (phase 1), ore a
 * boost ramp flings (phase 2), a collar lock you hop at on the loop (phase 3). Each lands in her next
 * open window. A boss adds no score: the proof only takes her least defeat time as a floor.
 */
export const CINDERMAW: BossConfig = {
   id: "cindermaw",
   name: "Cindermaw",
   maxHp: 8,
   introMs: 2500,
   transitionMs: 2000,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "crystals", name: "Crystal drop", endsAt: 5 / 8, attacks: [{ id: "swipe", telegraphMs: 900, attackMs: 800, vulnerableMs: 2600 }] },
      { id: "ramps", name: "Ore ramps", endsAt: 3 / 8, attacks: [{ id: "fireballs", telegraphMs: 1000, attackMs: 1000, vulnerableMs: 2600 }] },
      { id: "locks", name: "Collar locks", endsAt: 0, attacks: [{ id: "roar", telegraphMs: 800, attackMs: 800, vulnerableMs: 3000 }] },
   ],
};
