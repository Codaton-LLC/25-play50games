// Stars, secrets, the combo and the Glass Sentinel (shared menu2 systems, this game's numbers).
import type { BossConfig } from "../../menu2/boss/boss";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";

/** The flow meter: chained orbs and "Twin Perfect" saves within 2.5 s take a little more time off. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };
/** Time (ms) one chained event takes off, before the multiplier. */
export const COMBO_BASE_MS = { orb: 40, twin: 60, boss: 100 } as const;

export const SECRETS: readonly SecretSpec[] = [
   { id: "ghost-runway-shard", name: "Ghost-runway shard", kind: "shard", hero: "vexa" },
   { id: "shortcut-sticker", name: "Shortcut sticker", kind: "sticker", hero: "riko" },
   { id: "frost-shard", name: "Frosted-zone shard", kind: "shard" },
];

/**
 * The Glass Sentinel (L5), a towering knight of mirror panes, five hits over three phases:
 *  1 "Pane rain" (1): panes crash onto both runways at mirrored spots; then it stoops and its knee-gem
 *    sweeps over the middle lanes: jump through it.
 *  2 "Shield pane" (3): its shield covers one runway; the other body jumps through the knee-gem lane.
 *  3 "Chest crystal" (1): the runways merge; both bodies jump into the chest crystal as the ring closes.
 */
export const SENTINEL: BossConfig = {
   id: "glass-sentinel",
   name: "Glass Sentinel",
   maxHp: 5,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "rain", name: "Pane rain · dodge, then jump through the knee-gem", endsAt: 4 / 5, attacks: [{ id: "panes", telegraphMs: 900, attackMs: 1200, vulnerableMs: 3600 }] },
      { id: "shield", name: "Shield pane · the open side jumps the gem", endsAt: 1 / 5, attacks: [{ id: "shield", telegraphMs: 900, attackMs: 800, vulnerableMs: 3600 }] },
      { id: "chest", name: "Chest crystal · both jump as the ring closes", endsAt: 0, attacks: [{ id: "ring", telegraphMs: 1200, attackMs: 600, vulnerableMs: 3600 }] },
   ],
};

export const starSpecFor = (level: LevelId, orbTotal: number) => ({ orbTotal, goal: { kind: "time" as const, targetMs: LEVELS[level].targetMs } });
