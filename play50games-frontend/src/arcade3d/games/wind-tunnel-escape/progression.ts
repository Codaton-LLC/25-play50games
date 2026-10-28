import type { BossConfig } from "../../menu2/boss/boss";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";
export const COMBO = { windowMs: 3500, gain: 0.25, cap: 2 };
export const SECRETS: readonly SecretSpec[] = [
   { id: "gust", kind: "shard", name: "Creative current" },
   { id: "duct", kind: "sticker", name: "Quiet maintenance", hero: "vexa" },
   { id: "anemometer", kind: "shard", name: "Perfect pressure" },
];
export const starSpecFor = (id: LevelId) => ({ orbTotal: LEVELS[id].rooms * 3, goal: { kind: "time" as const, targetMs: LEVELS[id].starTargetMs } });
export const GALE: BossConfig = {
   id: "gale-engine", name: "Gale Engine", maxHp: 6,
   introMs: 1800, transitionMs: 1200, hitFlashMs: 200, oneHitPerWindow: true,
   defeatMs: 1800, slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "return", name: "Return the blast", endsAt: 0.5, attacks: [{ id: "blast", telegraphMs: 1200, attackMs: 1000, vulnerableMs: 3500 }] },
      { id: "jam", name: "Jam the core", endsAt: 0, attacks: [{ id: "intake", telegraphMs: 1000, attackMs: 1200, vulnerableMs: 4000 }] },
   ],
};
