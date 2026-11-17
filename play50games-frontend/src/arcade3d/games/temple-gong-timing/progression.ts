// Temple Gong Timing's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/**
 * The combo (the card: "accuracy x combo"): every struck note links the chain while the next comes
 * within 8 s (the longest break in any chart is under that), +0.1 a link, x2 from the tenth link on. A
 * miss or a shockwave hit breaks it. Only fixed, countable events feed it: each note once.
 */
export const COMBO: ComboConfig = { windowMs: 8_000, gain: 0.1, cap: 2 };

/** Points: a Perfect / a Good on a main note, a bonus note (cross notes are worth double), a held drum, an echo orb. */
export const POINTS = { perfect: 100, good: 50, bonusPerfect: 150, bonusGood: 75, crossPerfect: 200, crossGood: 100, hold: 50, echo: 20 } as const;

/** The stars: the clear (level 5: Coilstone freed), the level's echo orbs, its score target. */
export function starSpecFor(level: LevelId): StarSpec {
   return { orbTotal: LEVELS[level].echoTarget, goal: { kind: "atLeast", target: LEVELS[level].scoreTarget, label: "points" } };
}

/**
 * The card's secrets, in the order rules.ts collects them: Vexa's ghost-gong chord (every note of it:
 * the shard), the hidden ninth gong in the ruins (struck three times on a downbeat: a sticker; it plays
 * the remix's rimshot from then on), Silent Master (every answer to a call Perfect: a sticker) and, on
 * level 5, Coilstone freed with a Perfect on the Great Gong at the first try. Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ghost-chord", kind: "shard", name: "Ghost gong chord", hero: "vexa" },
      { id: "ninth-gong", kind: "sticker", name: "The Ninth Gong" },
   ],
   2: [
      { id: "ghost-chord", kind: "shard", name: "Ghost gong chord", hero: "vexa" },
      { id: "silent-master", kind: "sticker", name: "Silent Master" },
   ],
   3: [
      { id: "ghost-chord", kind: "shard", name: "Ghost gong chord", hero: "vexa" },
      { id: "ninth-gong", kind: "sticker", name: "The Ninth Gong" },
   ],
   4: [{ id: "ghost-chord", kind: "shard", name: "Ghost gong chord", hero: "vexa" }],
   5: [
      { id: "first-try", kind: "sticker", name: "One Strike" },
      { id: "silent-master", kind: "sticker", name: "Silent Master" },
   ],
};

export function secretIndex(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

/**
 * Level 5's boss: Coilstone, the Temple Serpent (World 3's finale; the shared m2CoilstoneHead and
 * m2CoilstoneSegment GLBs), coiled round the stage, its tail slamming the drums. Eight plates:
 * P1 "Echo the call" (hp 8 -> 4): its tail plays a pattern on three gongs; echo it, each Perfect echo
 *    cracks a plate (four).
 * P2 "Duel" (hp 4 -> 1): it slams off-beat shockwaves through an 8-bar phrase; 80 % or better in a
 *    phrase cracks a plate (three).
 * P3 "The Great Gong" (hp 1 -> 0): a crescendo that ends on the Great Gong in the middle; a Perfect last
 *    strike frees it (slow-mo, its eyes turn jade).
 * The fight is chart-driven (chart.ts BOSS_UNITS), so its vulnerable windows are long: the plates crack on
 * the notes, not on a timer. A boss adds no score.
 */
export const COILSTONE: BossConfig = {
   id: "coilstone-rhythm",
   name: "Coilstone",
   maxHp: 8,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: false,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "call", name: "Echo the call", endsAt: 4 / 8, attacks: [{ id: "tail", telegraphMs: 300, attackMs: 300, vulnerableMs: 600_000 }] },
      { id: "duel", name: "Duel: 80 % a phrase", endsAt: 1 / 8, attacks: [{ id: "shock", telegraphMs: 300, attackMs: 300, vulnerableMs: 600_000 }] },
      { id: "great", name: "Strike the Great Gong", endsAt: 0, attacks: [{ id: "crescendo", telegraphMs: 300, attackMs: 300, vulnerableMs: 600_000 }] },
   ],
};

/** P2: a phrase this accurate cracks a plate. */
export const DUEL_ACCURACY = 0.8;
