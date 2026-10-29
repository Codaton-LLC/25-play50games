// Candy World Runner's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 2.5 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each obstacle met at the right size. */
export const COMBO_BASE_MS = { orb: 30, size: 60 } as const;

/** The third star: the card's "no size miss" (at most 1 wrong-size hit; 0 on level 5). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "atMost", target: LEVELS[level].maxMisses, label: "Size misses" } };
}

/**
 * Secrets per level (placed by course.ts): the shard in the hidden fourth lane (Vexa's phase), the
 * "sugar giant" sticker (level 2: stay Big 20 s without breaking a bridge), and the alternate exit
 * behind a candy-cane arch (level 3: only Small fits).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [{ id: "lane4", kind: "shard", name: "Fourth-lane shard", hero: "vexa" }],
   2: [
      { id: "lane4", kind: "shard", name: "Fourth-lane shard", hero: "vexa" },
      { id: "giant", kind: "sticker", name: "Sugar giant" },
   ],
   3: [
      { id: "lane4", kind: "shard", name: "Fourth-lane shard", hero: "vexa" },
      { id: "exit", kind: "sticker", name: "Secret exit" },
   ],
   4: [{ id: "lane4", kind: "shard", name: "Fourth-lane shard", hero: "vexa" }],
   5: [{ id: "lane4", kind: "shard", name: "Fourth-lane shard", hero: "vexa" }],
};

/** The sugar giant: Big this long without a break (and no bridge broken). */
export const GIANT_MS = 20_000;

/**
 * Level 5's boss, King Bonbon (the world guardian), in a running fight through menu2/boss. Every hit
 * comes from the track at Big size: the jelly drum he stands on (phase 1), his throne (phase 2), his
 * crown (phase 3). Each lands in his next open window. A boss adds no score: the proof only takes his
 * least defeat time as a floor.
 */
export const KING_BONBON: BossConfig = {
   id: "king-bonbon",
   name: "King Bonbon",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 2000,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "wheels", name: "Lollipop wheels", endsAt: 3 / 6, attacks: [{ id: "wheels", telegraphMs: 900, attackMs: 900, vulnerableMs: 2600 }] },
      { id: "sprinkles", name: "Sour sprinkles", endsAt: 1 / 6, attacks: [{ id: "sprinkles", telegraphMs: 1000, attackMs: 1000, vulnerableMs: 2600 }] },
      { id: "collapse", name: "Palace collapse", endsAt: 0, attacks: [{ id: "collapse", telegraphMs: 800, attackMs: 800, vulnerableMs: 3000 }] },
   ],
};
