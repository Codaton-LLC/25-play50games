// Stars, secrets, the combo and Scrap Magnus (shared menu2 systems, this game's numbers).
import type { BossConfig } from "../../menu2/boss/boss";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";

/** The flow meter: coins banked in quick succession take a little more time off. */
export const COMBO: ComboConfig = { windowMs: 1500, gain: 0.25, cap: 2 };
export const COMBO_BASE_MS = { bank: 15, boss: 120 } as const;

export const SECRETS: readonly SecretSpec[] = [
   { id: "storage-shard", name: "Storage-room shard", kind: "shard", hero: "vexa" },
   { id: "prototype-sticker", name: "Prototype magnet sticker", kind: "sticker", hero: "zuno" },
   { id: "vault-shard", name: "Vent vault shard", kind: "shard" },
];

/**
 * Scrap Magnus (L5): a frozen workshop helper built of metal blocks round a horseshoe-magnet head.
 *  1 Tug (3 hits): his sign swaps every 3 s; ride out the slam on his sign, flip to be yanked into his core.
 *  2 Block storm (3 hits): catch a hurled block as -, flip to + and it flies back at his chest.
 *  3 Core (1 hit): the core floats over the pad ring: launch, pull, strike.
 */
export const MAGNUS: BossConfig = {
   id: "scrap-magnus",
   name: "Scrap Magnus",
   maxHp: 7,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "tug", name: "Tug · ride the slam, then flip into his core", endsAt: 4 / 7, attacks: [{ id: "slam", telegraphMs: 1000, attackMs: 900, vulnerableMs: 2800 }] },
      { id: "storm", name: "Block storm · catch it as -, flip to throw", endsAt: 1 / 7, attacks: [{ id: "hurl", telegraphMs: 900, attackMs: 600, vulnerableMs: 5000 }] },
      { id: "core", name: "Core · launch, pull, strike", endsAt: 0, attacks: [{ id: "rise", telegraphMs: 1200, attackMs: 600, vulnerableMs: 7000 }] },
   ],
};

export const starSpecFor = (level: LevelId, orbTotal: number) => ({ orbTotal, goal: { kind: "time" as const, targetMs: LEVELS[level].targetMs } });
