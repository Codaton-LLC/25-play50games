// Stars, secrets, the combo and the Bridge Keeper (shared menu2 systems, this game's numbers).
import type { BossConfig } from "../../menu2/boss/boss";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";

/** The flow meter: chained orbs and Keeper hits within 3 s take a little more time off. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };
/** Time (ms) one chained event takes off, before the multiplier. */
export const COMBO_BASE_MS = { orb: 60, boss: 120 } as const;

export const SECRETS: readonly SecretSpec[] = [
   { id: "flicker-shard", name: "Flicker-gap shard", kind: "shard", hero: "vexa" },
   { id: "white-isle-sticker", name: "White-isle sticker", kind: "sticker" },
   { id: "hidden-node-shard", name: "Hidden-node shard", kind: "shard", hero: "riko" },
];

/**
 * The Bridge Keeper (L5), a crane robot guarding the canyon gate, six hits over three phases. Each
 * window its chest plate shows a colour; send a beam of exactly that colour into the plate.
 *  1 "Primaries" (3): red, blue, yellow. Between windows it stomps the row you stand on.
 *  2 "Mixes" (2): purple, green; its arm laser greys one node for 4 s each cycle.
 *  3 "White" (1): all three beams crossed into the plate; then the gate opens.
 */
export const KEEPER: BossConfig = {
   id: "bridge-keeper",
   name: "Bridge Keeper",
   maxHp: 6,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "primaries", name: "Primaries · send the colour its plate shows", endsAt: 3 / 6, attacks: [{ id: "stomp", telegraphMs: 1200, attackMs: 600, vulnerableMs: 9000 }] },
      { id: "mixes", name: "Mixes · cross two beams into the plate", endsAt: 1 / 6, attacks: [{ id: "arm", telegraphMs: 1200, attackMs: 600, vulnerableMs: 11000 }] },
      { id: "white", name: "White · all three colours at once", endsAt: 0, attacks: [{ id: "roar", telegraphMs: 1200, attackMs: 600, vulnerableMs: 13000 }] },
   ],
};

export const starSpecFor = (level: LevelId, orbTotal: number) => ({ orbTotal, goal: { kind: "time" as const, targetMs: LEVELS[level].targetMs } });
