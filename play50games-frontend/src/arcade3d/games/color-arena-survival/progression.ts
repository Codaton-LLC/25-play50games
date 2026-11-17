// Color Arena Survival's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and
// progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/**
 * The flow meter: lock-ins and orbs within 9 s of each other chain (a round lasts a few seconds).
 * It is shown, never scored: the submitted time is the finish time alone (README "Scoring").
 */
export const COMBO: ComboConfig = { windowMs: 9000, gain: 0.25, cap: 2 };

/** Five colour orbs a level (the second star); one floats over a tile of the called colour on these rounds. */
export const ORBS_PER_LEVEL = 5;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId): StarSpec {
   return { orbTotal: ORBS_PER_LEVEL, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The secrets, in the order rules.ts collects them. Secrets never add score.
 * - "Rainbow Tile" (a shard, every level): once a level one tile shines in every colour; it is safe
 *   whatever is called. Be on it when the floor drops.
 * - "Quick Lock" (a sticker, every level): lock in under 1.5 s three rounds running.
 * - "Over the Gap" (a shard, L2-L3): a shard floats over a hole; Vexa phases to it, Nami jumps to it.
 * - "Bar Hopper" (a sticker, L4): jump the sweeper bar five times.
 * - "Beacon Streak" (a sticker, L5): three beacon rounds running, each one a hit on the Keeper.
 * Level 5 has no lock-in (the Keeper sets the pace), so it has no "Quick Lock".
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "rainbow", kind: "shard", name: "Rainbow Tile" },
      { id: "quick", kind: "sticker", name: "Quick Lock" },
   ],
   2: [
      { id: "rainbow", kind: "shard", name: "Rainbow Tile" },
      { id: "quick", kind: "sticker", name: "Quick Lock" },
      { id: "gap", kind: "shard", name: "Over the Gap", hero: "vexa" },
   ],
   3: [
      { id: "rainbow", kind: "shard", name: "Rainbow Tile" },
      { id: "quick", kind: "sticker", name: "Quick Lock" },
      { id: "gap", kind: "shard", name: "Over the Gap", hero: "nami" },
   ],
   4: [
      { id: "rainbow", kind: "shard", name: "Rainbow Tile" },
      { id: "quick", kind: "sticker", name: "Quick Lock" },
      { id: "hopper", kind: "sticker", name: "Bar Hopper" },
   ],
   5: [
      { id: "rainbow", kind: "shard", name: "Rainbow Tile" },
      { id: "streak", kind: "sticker", name: "Beacon Streak" },
   ],
};

/** The secret indices rules.ts fires (an id missing on a level is -1). */
export function secretIndex(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

/** "Quick Lock": this many rounds running, each locked in under QUICK_MS after the call. */
export const QUICK_ROUNDS = 3;
export const QUICK_MS = 1500;
/** "Bar Hopper": jumps over the sweeper bar. */
export const HOPS = 5;
/** "Beacon Streak": beacon rounds running, each a hit. */
export const STREAK = 3;

/**
 * Level 5's boss: the Prism Keeper (m2PrismArenaBoss), a crystal warden hovering off the arena's north
 * edge. On level 5 its attack cycle IS the round: its telegraph is the call, its attack the drop, its
 * vulnerable window the rise. Every third round a COLOUR BEACON stands on one tile of the called
 * colour: be on it when the floor drops and the beacon fires a prism beam into the Keeper (the hit lands
 * as its window opens). Six plates, three phases:
 * P1 "Cracked Tiles" (6 -> 4): it cracks two tiles of the called colour; they drop with the wrong ones.
 * P2 "Shock Rings" (4 -> 2): as the floor drops it slams a ring out across the arena: jump it.
 * P3 "Repaint" (2 -> 0): halfway through the call it changes the called colour.
 * A boss adds no score: the proof takes its least defeat time (bound.ts / proof.test.ts).
 */
export const KEEPER: BossConfig = {
   id: "prism-keeper",
   name: "Prism Keeper",
   maxHp: 6,
   introMs: 2200,
   transitionMs: 2600,
   hitFlashMs: 240,
   oneHitPerWindow: false,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "crack", name: "Cracked Tiles", endsAt: 4 / 6, attacks: [{ id: "drop", telegraphMs: LEVELS[5].callMs, attackMs: 900, vulnerableMs: 800 }] },
      { id: "shock", name: "Shock Rings", endsAt: 2 / 6, attacks: [{ id: "drop", telegraphMs: LEVELS[5].callMs, attackMs: 900, vulnerableMs: 800 }] },
      { id: "repaint", name: "Repaint", endsAt: 0, attacks: [{ id: "drop", telegraphMs: LEVELS[5].callMs, attackMs: 900, vulnerableMs: 800 }] },
   ],
};

/** Level 5: a beacon round every this many rounds (the first on round 3). */
export const BEACON_EVERY = 3;
/** P1: tiles of the called colour it cracks each round. */
export const KEEPER_CRACKS = 2;
/** P2: the shock ring's speed (m/s) from the arena's centre, its half thickness and its height (jump it). */
export const SHOCK_SPEED = 11;
export const SHOCK_HALF = 0.45;
export const SHOCK_HIGH = 0.7;
/** P3: the repaint lands this far into the call (a 0.6 s flicker before it). */
export const REPAINT_AT = 0.5;
export const REPAINT_WARN_MS = 600;
