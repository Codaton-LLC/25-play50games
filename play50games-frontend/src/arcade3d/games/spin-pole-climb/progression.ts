// Spin Pole Climb's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data and
// tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter (the card: "the combo counts laps without a hit"): laps within 3.5 s of each other chain; +0.25 a link, x2 at most. */
export const COMBO: ComboConfig = { windowMs: 3500, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each lap
 * of each stair the first time it is reached, each orb once and each Coilstone hit.
 */
export const COMBO_BASE_MS = { lap: 40, orb: 30, boss: 80 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: "Against the Grain" (climb a stair against
 * its pole's spin from bottom to top without hopping off: a sticker), Vexa's colour shard on the ghost
 * pole's cap, and the checkpoint disc hidden on a mushroom cap (standing on it spins every pole your way
 * for 10 s: a sticker). Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "against-the-grain", kind: "sticker", name: "Against the Grain" },
      { id: "ghost-pole", kind: "shard", name: "Ghost pole shard", hero: "vexa" },
      { id: "spin-disc", kind: "sticker", name: "Spin Disc" },
   ],
   2: [
      { id: "against-the-grain", kind: "sticker", name: "Against the Grain" },
      { id: "ghost-pole", kind: "shard", name: "Ghost pole shard", hero: "vexa" },
   ],
   3: [
      { id: "ghost-pole", kind: "shard", name: "Ghost pole shard", hero: "vexa" },
      { id: "spin-disc", kind: "sticker", name: "Spin Disc" },
   ],
   4: [
      { id: "ghost-pole", kind: "shard", name: "Ghost pole shard", hero: "vexa" },
      { id: "steepest", kind: "sticker", name: "Steepest Stair" },
   ],
   5: [
      { id: "ghost-pole", kind: "shard", name: "Ghost pole shard", hero: "vexa" },
      { id: "untouched", kind: "sticker", name: "Never Bitten" },
   ],
};

/** The secret indices rules.ts fires (an id missing on a level is -1). */
export function secretIndex(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

/**
 * Level 5's boss: Coilstone, the Temple Serpent (World 3's guardian, the shared m2CoilstoneHead and
 * m2CoilstoneSegment GLBs), wound round the central pole in the opposite spiral. Time-driven: hits land
 * only in the vulnerable windows. Six hits in all.
 * P1 "Jump the coils" (hp 6 -> 3): its coils slide down the stair at you; jump each one; then a dark
 *    plated segment rests just ahead: land on it from a jump (3 hits).
 * P2 "Strike the crown" (hp 3 -> 1): its head bites at the angle you stood on; then it rests its crown
 *    on a side pole's cap: hop onto that cap from the central stair (2 hits).
 * P3 "Ring the gong" (hp 1 -> 0): it shakes you three laps down and the pole spins your way at 60 deg/s;
 *    climb to the gong cap on top (1 hit, slow-mo finish).
 * A boss adds no score: the proof takes its least defeat time (bound.ts / proof.test.ts).
 */
export const COILSTONE: BossConfig = {
   id: "coilstone",
   name: "Coilstone",
   maxHp: 6,
   introMs: 1500,
   transitionMs: 1600,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "coils", name: "Jump the coils, stomp the dark plate", endsAt: 3 / 6, attacks: [{ id: "slide", telegraphMs: 900, attackMs: 2400, vulnerableMs: 4200 }] },
      { id: "crown", name: "Hop onto the side pole that holds its crown", endsAt: 1 / 6, attacks: [{ id: "bite", telegraphMs: 1200, attackMs: 700, vulnerableMs: 7000 }] },
      { id: "gong", name: "Climb to the gong and ring it", endsAt: 0, attacks: [{ id: "spin", telegraphMs: 800, attackMs: 600, vulnerableMs: 16000 }] },
   ],
};

/** Coilstone's P3 spin (rad/s, the stair's way): the card's 60 deg/s. */
export const P3_SPIN = Math.PI / 3;
/** P3 shakes the hero this many laps under the gong first. */
export const P3_DROP_LAPS = 3;
