import type { BossConfig } from "../../menu2/boss/boss";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";

export const COMBO = { windowMs: 3000, gain: 0.25, cap: 2 };
export const SECRETS: readonly SecretSpec[] = [
   { id: "lantern", name: "Lantern shard", kind: "shard" },
   { id: "signal", name: "Ghost signal sticker", kind: "sticker", hero: "vexa" },
   { id: "beam", name: "Lighthouse shard", kind: "shard" },
];
export const starSpecFor = (level: LevelId) => ({ orbTotal: LEVELS[level].sections * 4, goal: { kind: "time" as const, targetMs: LEVELS[level].targetMs } });
export const VOLT_EEL: BossConfig = {
   id: "volt-eel", name: "Volt Eel", maxHp: 5, introMs: 1200, transitionMs: 1000,
   hitFlashMs: 180, oneHitPerWindow: true, defeatMs: 2200, slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "cables", name: "The cables · hop onto the head", endsAt: 2 / 5, attacks: [{ id: "electrify", telegraphMs: 1500, attackMs: 800, vulnerableMs: 2200 }] },
      { id: "coiled", name: "Coiled · tuck, release into the gill", endsAt: 1 / 5, attacks: [{ id: "coil", telegraphMs: 1500, attackMs: 900, vulnerableMs: 4000 }] },
      { id: "plunge", name: "The plunge · land, ring the Tide Bell", endsAt: 0, attacks: [{ id: "snap", telegraphMs: 1500, attackMs: 600, vulnerableMs: 20_000 }] },
   ],
};
