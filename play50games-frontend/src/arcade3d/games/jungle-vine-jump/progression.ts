// Jungle Vine Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and
// progress. README "Stars, combo, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The catch combo: vine-to-vine catches within 1.2 s of the last release chain (the card); +0.25 a link, x2 cap. */
export const COMBO: ComboConfig = { windowMs: 1200, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each
 * vine's first catch, each orb once, each emerald once and each hit on the King.
 */
export const COMBO_BASE_MS = { catch: 15, orb: 20, emerald: 10, boss: 40 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

const LIST: readonly SecretSpec[] = [
   { id: "monkey-bars", kind: "sticker", name: "Monkey Bars" },
   { id: "trunk-hollow", kind: "shard", name: "Trunk hollow", hero: "vexa" },
   { id: "emerald-vine", kind: "sticker", name: "Emerald vine" },
];

/**
 * The card's secrets, in the order rules.ts collects them: "Monkey Bars" (ten vine-to-vine catches
 * without touching a platform: a sticker), Vexa's shard in the trunk hollow behind the ghost-root
 * wall, and the hidden emerald vine that glows only when you hang at the full 6 m grip. Secrets never
 * add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: LIST, 2: LIST, 3: LIST, 4: LIST, 5: LIST };

/**
 * Level 5's boss, the Howler King (m2JungleMonkey at 3x, ash-grey fur with dark shoulder plates, a
 * Shadow Plates lieutenant), fought through menu2/boss once the hero reaches the arena in the crown.
 * Time-driven: hits land only in the vulnerable windows, by meeting him at speed (HIT_SPEED or more).
 * P1 "Swing into his perch" (hp 6 -> 4): he throws fruit pods in 3-shot volleys at you; swing at
 *    full amplitude into his perch branch (2 hits).
 * P2 "Release straight into him" (hp 4 -> 2): he roars and your vine drops for 2 s; then he hangs
 *    over the arena: release from a big swing into him (2 hits).
 * P3 "Meet him at the bottom, faster" (hp 2 -> 0): he swings on his own vine opposite you; meet him
 *    with more speed (a short grip swings faster), slow-mo finish (2 hits).
 * A boss adds no score: the proof takes its least defeat time (bound.ts / proof.test.ts).
 */
export const HOWLER: BossConfig = {
   id: "howler-king",
   name: "Howler King",
   maxHp: 6,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 200,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "perch", name: "Swing into his perch", endsAt: 4 / 6, attacks: [{ id: "volley", telegraphMs: 900, attackMs: 900, vulnerableMs: 6000 }] },
      { id: "roar", name: "Release straight into him", endsAt: 2 / 6, attacks: [{ id: "roar", telegraphMs: 1000, attackMs: 2000, vulnerableMs: 6500 }] },
      { id: "duel", name: "Meet him at the bottom, faster", endsAt: 0, attacks: [{ id: "duel", telegraphMs: 1000, attackMs: 1500, vulnerableMs: 7000 }] },
   ],
};
