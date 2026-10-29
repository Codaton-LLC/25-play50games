// Ice Peak Jumper's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each perfect landing (within 0.3 m of a platform's centre, once per platform). */
export const COMBO_BASE_MS = { orb: 20, landing: 40 } as const;

/** The card's main orb count per level (every orb on the main route; hero side routes add bonus orbs). */
export const MAIN_ORBS: Record<LevelId, number> = { 1: 25, 2: 30, 3: 35, 4: 40, 5: 45 };

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by course.ts): the golden mitten sticker frozen in an ice cube (Riko's
 * dash breaks it), the summit-cairn shortcut flag on a high cornice (levels 2 and 4, Nami's re-aimed
 * jump), the hidden ledge behind the background peak (a max-speed launch, 8.5 m/s and up), and the
 * shard in the ghost-ice cave (Vexa's phase).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "mitten", kind: "sticker", name: "Golden mitten", hero: "riko" },
      { id: "hidden", kind: "shard", name: "Peak shard" },
   ],
   2: [
      { id: "flag", kind: "shard", name: "Cairn flag", hero: "nami" },
      { id: "ghost", kind: "shard", name: "Ghost-ice shard", hero: "vexa" },
   ],
   3: [
      { id: "mitten", kind: "sticker", name: "Golden mitten", hero: "riko" },
      { id: "ghost", kind: "shard", name: "Ghost-ice shard", hero: "vexa" },
   ],
   4: [
      { id: "flag", kind: "shard", name: "Cairn flag", hero: "nami" },
      { id: "hidden", kind: "shard", name: "Peak shard" },
   ],
   5: [
      { id: "ghost", kind: "shard", name: "Ghost-ice shard", hero: "vexa" },
      { id: "hidden", kind: "shard", name: "Peak shard" },
   ],
};

/**
 * Level 5's boss, the Frost Golem, fought through menu2/boss. Every hit comes from the arena: landing on
 * his glowing back core off a slam slope (phase 1), on his shoulder off the boulder steps (phase 2), on
 * his head crystal at the top of the cairn climb (phase 3). Each lands in his next open window (the 2 s
 * stun after a slam). A boss adds no score: the proof only takes his least defeat time as a floor.
 */
export const FROST_GOLEM: BossConfig = {
   id: "frost-golem",
   name: "Frost Golem",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 2000,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "slam", name: "Slope slam", endsAt: 3 / 6, attacks: [{ id: "slam", telegraphMs: 900, attackMs: 700, vulnerableMs: 2000 }] },
      { id: "glaze", name: "Glaze", endsAt: 1 / 6, attacks: [{ id: "boulders", telegraphMs: 1000, attackMs: 900, vulnerableMs: 2400 }] },
      { id: "climb", name: "Climb", endsAt: 0, attacks: [{ id: "climb", telegraphMs: 800, attackMs: 800, vulnerableMs: 3000 }] },
   ],
};
