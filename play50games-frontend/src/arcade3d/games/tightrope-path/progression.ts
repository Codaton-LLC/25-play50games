// Tightrope Path's Menu 2 structure (menu2/stars, combo, secrets, boss, progress). Plain data; rules.ts
// uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: clean elements (crossed without a wobble) within 7 s chain; +0.25 a link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 7000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x1): a clean element once each, an Umbra hit. */
export const COMBO_BASE_MS = { element: 120, boss: 200 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: "Steady Hands" (cross without the needle
 * ever past 50 %: a sticker), Vexa's ghost bridge shard, and the hidden lookout tower's bird (crouch
 * still 5 s on its rope: a bird lands on your pole). Secrets never add time.
 */
const LIST: readonly SecretSpec[] = [
   { id: "steady", kind: "sticker", name: "Steady Hands" },
   { id: "ghost", kind: "shard", name: "Ghost bridge shard", hero: "vexa" },
   { id: "bird", kind: "sticker", name: "Bird friend" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: LIST, 2: LIST, 3: LIST, 4: LIST, 5: LIST };

/**
 * Level 5's boss, Umbra (m2ShadowArmadillo), walking the same rope towards you. Time-driven: hits land
 * only in the vulnerable windows, and only from the right spot.
 * P1 "Ride the stomp" (hp 6 -> 3): he stomps (a sway wave down the rope: crouch to ride it); while he
 *    wobbles mid-wave, jump to stomp back within 5 m (3 hits; each sends him back 3 m).
 * P2 "Shove" (hp 3 -> 1): on the beam he cuts strands (the needle drifts 1.6x); shove (Action) within
 *    1.8 m while his needle tips (2 hits).
 * P3 "Out-balance" (hp 1 -> 0): on the rotating beam he throws plates (crouch); stay upright 10 s on it,
 *    then a final shove: a slow-mo fall into the mist (he glides off, unharmed).
 */
export const UMBRA: BossConfig = {
   id: "umbra",
   name: "Umbra",
   maxHp: 6,
   introMs: 1600,
   transitionMs: 1800,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "stomp", name: "Ride the stomp, stomp back", endsAt: 3 / 6, attacks: [{ id: "stomp", telegraphMs: 1200, attackMs: 400, vulnerableMs: 1800 }] },
      { id: "shove", name: "Shove when his needle tips", endsAt: 1 / 6, attacks: [{ id: "cut", telegraphMs: 1000, attackMs: 400, vulnerableMs: 2200 }] },
      { id: "balance", name: "Out-balance him, then shove", endsAt: 0, attacks: [{ id: "plates", telegraphMs: 900, attackMs: 400, vulnerableMs: 2600 }] },
   ],
};
