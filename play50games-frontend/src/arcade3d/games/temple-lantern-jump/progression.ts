// Temple Lantern Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and
// progress. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: lanterns lit within 2 s of each other chain; +0.25 per link, capped at x2 (the card's pitch-rising chime). */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each
 * lantern's first ignition, each orb once and each Queen hit.
 */
export const COMBO_BASE_MS = { lantern: 15, orb: 20, boss: 40 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: "First Light" (clear without the ember
 * ever dropping under 2 s: a sticker), Vexa's shard in the hidden lantern room behind the ghost wall,
 * and on level 1 the roof brazier that lights when all nine lanterns burn in one run. Secrets never
 * add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "first-light", kind: "sticker", name: "First Light" },
      { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
      { id: "nine-lights", kind: "sticker", name: "Nine Lights" },
   ],
   2: [
      { id: "first-light", kind: "sticker", name: "First Light" },
      { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
   ],
   3: [
      { id: "first-light", kind: "sticker", name: "First Light" },
      { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
   ],
   4: [
      { id: "first-light", kind: "sticker", name: "First Light" },
      { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
   ],
   5: [
      { id: "first-light", kind: "sticker", name: "First Light" },
      { id: "lantern-room", kind: "shard", name: "Hidden lantern room", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, the Soot Bat Queen (m2CaveBat at 4x, ash tint; a Shadow Plates lieutenant), fought
 * through menu2/boss once the hero climbs into the roof arena. Time-driven: hits land only in the
 * vulnerable windows. Seven hits in all.
 * P1 "Relight" (hp 7 -> 4): she flaps (attack) and snuffs every lantern; then relight three lanterns
 *    in the window to scorch her wings (3 hits).
 * P2 "Bounce into her dive" (hp 4 -> 1): she dives to hang over a lantern; ride its bounce up into her
 *    while your ember burns (3 hits). The fire jets pulse faster.
 * P3 "Roof brazier" (hp 1 -> 0): the roof is dark but for her eyes; throw the ember (Action in the
 *    air) into the giant roof brazier as she passes over it (1 hit, slow-mo finish).
 * A boss adds no score: the proof takes its least defeat time (bound.ts / proof.test.ts).
 */
export const QUEEN: BossConfig = {
   id: "soot-bat-queen",
   name: "Soot Bat Queen",
   maxHp: 7,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 200,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "relight", name: "Relight three lanterns", endsAt: 4 / 7, attacks: [{ id: "blackout", telegraphMs: 1000, attackMs: 600, vulnerableMs: 6000 }] },
      { id: "dive", name: "Bounce into her dive", endsAt: 1 / 7, attacks: [{ id: "dive", telegraphMs: 1400, attackMs: 800, vulnerableMs: 4200 }] },
      { id: "brazier", name: "Throw the ember into the roof brazier", endsAt: 0, attacks: [{ id: "roof", telegraphMs: 1400, attackMs: 800, vulnerableMs: 5000 }] },
   ],
};
