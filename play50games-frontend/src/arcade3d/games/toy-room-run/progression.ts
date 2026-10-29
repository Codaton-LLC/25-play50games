// Toy Room Run's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo).
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 2.5 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/**
 * Ms off the submitted time at x2, each source once per thing: a chain you start (the first time),
 * a gap you cross, an orb, a hit on Jack. "Surfing" the wave (crossing a gap within 3 m of its front)
 * doubles that gap's link base.
 */
export const COMBO_BASE_MS = { chain: 40, gap: 50, surf: 50, orb: 25, hit: 40 } as const;

/** The third star: the card's target times. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, in each level's `secrets` order: the sticker inside the toy castle (Vexa phases through
 * its ghost doorway), the shard behind the cracked block wall (Riko's dash), the shard on the high
 * bookshelf ledge (Nami's double jump off the pencil ramp).
 */
const BASE: readonly SecretSpec[] = [
   { id: "castle-sticker", kind: "sticker", name: "Castle sticker", hero: "vexa" },
   { id: "wall-shard", kind: "shard", name: "Block shard", hero: "riko" },
   { id: "shelf-shard", kind: "shard", name: "Shelf shard", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: BASE, 4: BASE, 5: BASE };

/**
 * Jack Wobble, a giant jack-in-the-box, one of King Bonbon's frozen helpers. 6 HP (the card):
 * - Whack (3 hits): a lid rattles (the telegraph), he springs out of that box and sways there,
 *   dazed: start the book chain to that box so its last book drops on his spring.
 * - Throwback (2 hits): he spits toy blocks that land on end as a new chain toward his box; push it
 *   back at him while he is out.
 * - Bounce (1 hit): he bounces round the room, slams down in front (keep clear) and crouches there:
 *   topple the giant book-stack line onto him.
 * His hits come from the chains, not from the hero (the card: targets triggered by level events).
 */
export const JACK: BossConfig = {
   id: "jack-wobble",
   name: "Jack Wobble",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "whack", name: "Whack", endsAt: 3 / 6, attacks: [{ id: "pop", telegraphMs: 1600, attackMs: 500, vulnerableMs: 3200 }] },
      { id: "throwback", name: "Throwback", endsAt: 1 / 6, attacks: [{ id: "spit", telegraphMs: 1800, attackMs: 600, vulnerableMs: 3600 }] },
      { id: "bounce", name: "Bounce", endsAt: 0, attacks: [{ id: "slam", telegraphMs: 2600, attackMs: 500, vulnerableMs: 1500 }] },
   ],
};
