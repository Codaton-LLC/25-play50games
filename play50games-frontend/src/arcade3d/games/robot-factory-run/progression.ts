import type { BossConfig } from "@/arcade3d/menu2/boss/boss";
import type { SecretSpec } from "@/arcade3d/menu2/secrets/secrets";
import type { StarSpec } from "@/arcade3d/menu2/stars/stars";
import type { LevelId } from "../../types";
import { LEVELS } from "./levels";
export const COMBO = { windowMs: 4000, gain: 0.25, cap: 2 };
export const SECRET_LIST: readonly SecretSpec[] = [
   { id: "sixth-junction", kind: "sticker", name: "Secret charger" },
   { id: "maintenance", kind: "shard", name: "Maintenance ember", hero: "vexa" },
   { id: "roof-window", kind: "shard", name: "Roof window", hero: "nami" },
];
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: SECRET_LIST, 2: SECRET_LIST, 3: SECRET_LIST, 4: SECRET_LIST, 5: SECRET_LIST };
export const starSpecFor = (id: LevelId): StarSpec => ({ orbTotal: 8, goal: { kind: "time", targetMs: LEVELS[id].targetMs } });
export const OVERSEER: BossConfig = {
   id: "overseer-m8", name: "Overseer M-8", maxHp: 8, introMs: 1600, transitionMs: 1400,
   hitFlashMs: 180, oneHitPerWindow: true, defeatMs: 2200, slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "socket", name: "Route cells into the chest", endsAt: 5 / 8, attacks: [{ id: "jam-stomp", telegraphMs: 900, attackMs: 600, vulnerableMs: 4500 }] },
      { id: "press", name: "Reverse the boss belt into the press", endsAt: 3 / 8, attacks: [{ id: "belt-walk", telegraphMs: 1000, attackMs: 650, vulnerableMs: 5000 }] },
      { id: "vents", name: "Catwalk: jump, then Roll into the vent", endsAt: 0, attacks: [{ id: "overheat", telegraphMs: 1000, attackMs: 550, vulnerableMs: 5500 }] },
   ],
};
