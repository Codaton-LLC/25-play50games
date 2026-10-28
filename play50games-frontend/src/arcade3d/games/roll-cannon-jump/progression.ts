// Roll Cannon Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), after the
// cloud-hopper reference adoption. Plain data and tiny pure helpers; rules.ts uses the combo, the
// secrets and the boss, Scene.tsx the stars and progress. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 2 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter: each
 * orb once, the first catch of each cannon, the first pass through each fire hoop and each boss hit.
 */
export const COMBO_BASE_MS = { orb: 20, catch: 10, hoop: 15, boss: 40 } as const;

/** The third star: beat the show target (levels.ts starTargetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Two secrets a level, placed by layouts.ts in this order: one anyone can find by exploring (an odd
 * shot off the line), one behind a hero power (the card: Riko's cracked board opens a hidden cannon,
 * Nami's sticker on the high trapeze, Kiro's in the smoke, Vexa's behind the ghost poles), and L4's
 * shard on the 100 % one-shot line. Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ember", kind: "shard", name: "Ember shard" },
      { id: "trapeze", kind: "sticker", name: "Trapeze sticker", hero: "nami" },
   ],
   2: [
      { id: "ticket", kind: "sticker", name: "Ticket stub" },
      { id: "board", kind: "shard", name: "Target-board shard", hero: "riko" },
   ],
   3: [
      { id: "rail", kind: "shard", name: "Rail shard" },
      { id: "smoke", kind: "sticker", name: "Smoke sticker", hero: "kiro" },
   ],
   4: [
      { id: "oneshot", kind: "shard", name: "One-shot shard" },
      { id: "ghost", kind: "sticker", name: "Ghost-pole sticker", hero: "vexa" },
   ],
   5: [
      { id: "ash", kind: "shard", name: "Ash shard" },
      { id: "valve", kind: "sticker", name: "Valve sticker" },
   ],
};

/**
 * Level 5's boss, Ashbag the Smoke Blimp (a Shadow Plates lieutenant, the card), fought through
 * menu2/boss once the hero reaches the stage. Time-driven: hits land only in the vulnerable windows.
 * P1 "Smoke pods" (hp 6 -> 3): it circles the tent and stops at a hover spot with one pod swollen
 * (telegraph 1 s): fire yourself through the pod; each pod you pop rains orbs onto the stage.
 * P2 "Paint bombs" (hp 3 -> 1): a shadow marks a stage cannon for 1 s, then grey paint jams it for
 * 3 s; between bombs it hangs low over a trampoline: bounce up into its gondola, 2 hits.
 * P3 "Valve" (hp 1 -> 0): it rises to the tent top; chain the 4 auto-cannons up and roll-dive into
 * its open valve. A boss adds no score: the proof takes its least defeat time (bound.ts bossMinMs).
 */
export const ASHBAG: BossConfig = {
   id: "ashbag",
   name: "Ashbag, the Smoke Blimp",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.3, durationMs: 1600 },
   phases: [
      { id: "pods", name: "Smoke pods", endsAt: 3 / 6, attacks: [{ id: "circle", telegraphMs: 1000, attackMs: 3000, vulnerableMs: 3200 }] },
      { id: "bombs", name: "Paint bombs", endsAt: 1 / 6, attacks: [{ id: "bomb", telegraphMs: 1000, attackMs: 2000, vulnerableMs: 3200 }] },
      { id: "valve", name: "Valve", endsAt: 0, attacks: [{ id: "rise", telegraphMs: 800, attackMs: 1600, vulnerableMs: 6000 }] },
   ],
};
