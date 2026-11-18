// Paint the Platforms' Menu 2 structure (menu2/stars, combo, secrets, boss, progress). Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import { starLabels, type StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: fresh tiles, paint blobs, set rows and Blob hits within 3 s of each other chain. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x1). All 0: in this game the chain (fresh tiles, paint
 * blobs, rows set, Blob hits within 3 s of each other) drives the Flow meter and the XP, never the time:
 * painting fast already is the score, and any time bonus would sink the proven floor (README).
 */
export const COMBO_BASE_MS = { tile: 0, blob: 0, row: 0, boss: 0 } as const;

/** Stars: clear, every paint blob, the submitted time at or under the level's target. */
export function starSpecFor(level: LevelId, blobTotal: number): StarSpec {
   return { orbTotal: blobTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/** The star screen's labels: this game's collectibles are paint blobs, not orbs. */
export function paintStarLabels(level: LevelId, blobTotal: number): [string, string, string] {
   const labels = starLabels(starSpecFor(level, blobTotal));
   labels[1] = `All ${blobTotal} paint blobs`;
   return labels;
}

/**
 * The secrets, in the order rules.ts collects them: "Full mural" (every tile painted at once: a
 * sticker), Vexa's caged prism blob (a shard), Nami's gold blob on the high pillar (a sticker). Secrets
 * never add time.
 */
const LIST: readonly SecretSpec[] = [
   { id: "mural", kind: "sticker", name: "Full mural" },
   { id: "ghost", kind: "shard", name: "Caged prism blob", hero: "vexa" },
   { id: "high", kind: "sticker", name: "Gold pillar blob", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: LIST, 2: LIST, 3: LIST, 4: LIST, 5: LIST };

/**
 * Level 5's boss, the Paint Blob: a grey blob on a pedestal in the middle of the court that wipes paint.
 * Its tell drops a shadow ring where you stand and the slam greys every unset tile inside it (and stuns
 * you, unless you are out of it or behind Kiro's shield); after the slam it sags and its core opens:
 * splat it (Action beside it). P1 "Slam" (hp 6 -> 3, a 2.4 m ring), P2 "Wide slam" (hp 3 -> 1, 3.2 m),
 * P3 "Twin slam" (the ring and its mirror across the Blob: the finish, slow-mo).
 */
export const BLOB: BossConfig = {
   id: "paint-blob",
   name: "Paint Blob",
   maxHp: 6,
   introMs: 1800,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "slam", name: "Dodge the slam, then splat the Blob", endsAt: 3 / 6, attacks: [{ id: "slam", telegraphMs: 1300, attackMs: 400, vulnerableMs: 4000 }] },
      { id: "wide", name: "Wide slams now", endsAt: 1 / 6, attacks: [{ id: "wide", telegraphMs: 1200, attackMs: 400, vulnerableMs: 4000 }] },
      { id: "twin", name: "Twin slams: watch both rings", endsAt: 0, attacks: [{ id: "twin", telegraphMs: 1200, attackMs: 400, vulnerableMs: 4000 }] },
   ],
};

/** Each phase's slam ring radius (m). */
export const SLAM_R: readonly number[] = [2.4, 3.2, 3.2];
