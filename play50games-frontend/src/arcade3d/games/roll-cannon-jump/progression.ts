// Roll Cannon Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), after the
// cloud-hopper reference adoption. Plain data and tiny pure helpers; rules.ts uses the combo, the
// secrets and the boss, Scene.tsx the stars and progress. README "Stars, flow, secrets, boss" (M3).
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
export const COMBO_BASE_MS = { orb: 40, catch: 20, hoop: 30, boss: 60 } as const;

/** The no-hit badge of this game (the card): finish with no fall at all. */
export const STREAK_BADGE = 0;

/** The third star: beat the show target (the card's targets: 30 / 42 / 55 / 68 / 100 s). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by course.ts): the ember shard hides off the main arc (a deliberate
 * detour), the story ones are the card's: L2's cracked board behind Riko's dash opens a hidden
 * cannon line, the sticker sits on Nami's high trapeze line, L4's shard crowns the 100 % "one-shot"
 * line that skips three cannons. Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ticket", kind: "sticker", name: "Ticket stub" },
      { id: "ribbon", kind: "shard", name: "Ribbon shard" },
   ],
   2: [
      { id: "board", kind: "shard", name: "Cracked-board shard", hero: "riko" },
      { id: "trapeze", kind: "sticker", name: "Trapeze sticker", hero: "nami" },
   ],
   3: [
      { id: "rail", kind: "shard", name: "Rail shard" },
      { id: "smoke", kind: "sticker", name: "Smoke sticker", hero: "kiro" },
   ],
   4: [
      { id: "oneshot", kind: "shard", name: "One-shot shard" },
      { id: "balloon", kind: "sticker", name: "Balloon sticker" },
   ],
   5: [
      { id: "ash", kind: "shard", name: "Ash shard" },
      { id: "valve", kind: "sticker", name: "Valve sticker" },
   ],
};

/**
 * Level 5's boss, Ashbag the Smoke Blimp (a Shadow Plates lieutenant, the card), fought through
 * menu2/boss. Time-driven: hits land only in the vulnerable windows of its attack cycles.
 * P1 "Pods" (hp 6 -> 3): it circuits the tent every 6 s; one smoke-pod balloon is vulnerable per
 * circuit (fire yourself through it; each popped pod rains orbs). P2 "Bombs" (hp 3 -> 1): it drops
 * grey paint bombs that jam a cannon for 3 s (1 s shadow telegraph); bounce off trampolines into its
 * gondola, 2 hits. P3 "Ascent" (hp 1 -> 0): it rises to the tent top; chain 4 auto-cannons upward,
 * then roll-dive into its valve. A boss adds no score: the proof takes its least defeat time as a
 * floor (rules.ts bossMinMs).
 */
export const ASHBAG: BossConfig = {
   id: "ashbag",
   name: "Ashbag, the Smoke Blimp",
   maxHp: 6,
   introMs: 2000,
   transitionMs: 1200,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1500 },
   phases: [
      { id: "pods", name: "Pods", endsAt: 3 / 6, attacks: [{ id: "circuit", telegraphMs: 1000, attackMs: 3400, vulnerableMs: 1600 }] },
      { id: "bombs", name: "Bombs", endsAt: 1 / 6, attacks: [{ id: "bomb", telegraphMs: 1000, attackMs: 2200, vulnerableMs: 1400 }] },
      { id: "ascent", name: "Ascent", endsAt: 0, attacks: [{ id: "ascent", telegraphMs: 800, attackMs: 2400, vulnerableMs: 1200 }] },
   ],
};
