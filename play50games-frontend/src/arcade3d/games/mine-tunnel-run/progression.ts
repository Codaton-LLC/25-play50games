// Stars, secrets, the combo and Rockjaw (shared menu2 systems, this game's numbers).
import type { BossConfig } from "../../menu2/boss/boss";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";

/** The flow meter: chained finds within 2.5 s take a little more time off. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };
/** Time (ms) one chained event takes off, before the multiplier. */
export const COMBO_BASE_MS = { orb: 40, crush: 80, boss: 100 } as const;

export const SECRETS: readonly SecretSpec[] = [
   { id: "ghost-shard", name: "Ghost-shaft shard", kind: "shard", hero: "vexa" },
   { id: "air-sticker", name: "Air-pocket sticker", kind: "sticker", hero: "nami" },
   { id: "vault-shard", name: "Sealed vault shard", kind: "shard" },
];

/**
 * Rockjaw, the Tunnel Beetle (L5). Eight hits over three phases:
 *  1 "Ceiling drop" (3): it charges along the chamber, stops sniffing under a plug: dig the plug.
 *  2 "Burrow" (2): it erupts under the hero after a 1 s dust warning, then stays up: drop a boulder.
 *  3 "Flipped" (3): on its back, belly up: roll-drop onto it down an open chute.
 */
export const ROCKJAW: BossConfig = {
   id: "rockjaw",
   name: "Rockjaw",
   maxHp: 8,
   introMs: 1500,
   transitionMs: 1400,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "drop", name: "Ceiling drop · dig the plug above it", endsAt: 5 / 8, attacks: [{ id: "charge", telegraphMs: 1000, attackMs: 1600, vulnerableMs: 4500 }] },
      { id: "burrow", name: "Burrow · step off the dust, then drop a boulder", endsAt: 3 / 8, attacks: [{ id: "erupt", telegraphMs: 1000, attackMs: 600, vulnerableMs: 4000 }] },
      { id: "flipped", name: "Flipped · roll-drop onto its belly", endsAt: 0, attacks: [{ id: "flail", telegraphMs: 900, attackMs: 600, vulnerableMs: 6000 }] },
   ],
};

export const starSpecFor = (level: LevelId, orbTotal: number) => ({ orbTotal, goal: { kind: "time" as const, targetMs: LEVELS[level].targetMs } });
