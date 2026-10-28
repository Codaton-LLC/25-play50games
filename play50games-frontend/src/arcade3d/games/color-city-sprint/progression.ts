// Color City Sprint's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo).
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 2.5 s, +0.25 per link, capped at x2: a chain of red streets is the card's meter. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/**
 * Ms off the submitted time at x2. Each source counts once per thing: each beacon, each red street
 * (the first time you run it), each orb, each hit on Greyout; never a repeatable action.
 */
export const COMBO_BASE_MS = { beacon: 60, lane: 30, orb: 30, hit: 40 } as const;

/** Level 5's beacons keep lighting until Greyout falls: only the first this many feed the meter. */
export const BOSS_BEACON_LINKS = 12;

/** The third star: the submitted time at or under the level's target. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets (no score), in the order of each level's `secrets` spots: the rooftop sticker at the far
 * end of the elevated rail (Nami), the colour shard inside the ghost shop (Vexa), the hoarding shard
 * inside the construction site (Riko); level 4's third is the perfect loop, which only lights once
 * every street of its ring is red.
 */
const BASE: readonly SecretSpec[] = [
   { id: "rail-sticker", kind: "sticker", name: "Rooftop sticker", hero: "nami" },
   { id: "shop-shard", kind: "shard", name: "Ghost-shop shard", hero: "vexa" },
   { id: "site-shard", kind: "shard", name: "Hoarding shard", hero: "riko" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: BASE,
   2: BASE,
   3: BASE,
   4: [BASE[0], BASE[1], { id: "perfect-loop", kind: "sticker", name: "Perfect loop" }],
   5: BASE,
};

/**
 * Greyout, the Street Sweeper: Shadow Plates' lieutenant, a giant sweeper truck that erases your red
 * lanes as it drives. 7 HP in three phases (the card):
 * - Brushes (3 hits, ends at 4/7): it drives to a stop beside a ramp (sweeping the red off every
 *   street it crosses), sweeps its brushes, then parks: launch off the ramp onto a roof brush unit.
 *   Each hit stops the sweeping for 5 s.
 * - Valves (2 hits, ends at 2/7): brushes broken, it drives to a stop on the red avenue, sprays
 *   sludge behind it and drops drone cones ahead, then parks: roll-ram the tank valves on its back
 *   (curled, so at red-lane speed).
 * - Ram (2 hits, ends at 0): it hunts you along your own trail through the plaza. A red gate holds
 *   it; a gate that shuts on it slams it and it spins out.
 * A boss adds no score; the proof takes its least defeat time as the level's floor (rules bossMinMs).
 */
export const GREYOUT: BossConfig = {
   id: "greyout",
   name: "Greyout",
   maxHp: 7,
   introMs: 2600,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "brushes", name: "Brushes", endsAt: 4 / 7, attacks: [{ id: "sweep", telegraphMs: 3600, attackMs: 800, vulnerableMs: 3200 }] },
      { id: "valves", name: "Valves", endsAt: 2 / 7, attacks: [{ id: "spray", telegraphMs: 3600, attackMs: 1000, vulnerableMs: 3600 }] },
      { id: "ram", name: "Ram", endsAt: 0, attacks: [{ id: "ram", telegraphMs: 1000, attackMs: 1600, vulnerableMs: 4400 }] },
   ],
};
