// Laser Maze Run's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each laser zone crossed without a hit. */
export const COMBO_BASE_MS = { orb: 30, zone: 120 } as const;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by course.ts): the shard inside a laser cage (Vexa's phase walks in) and the
 * sticker hanging high over a beam (Nyla's second jump).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "cage", kind: "shard", name: "Cage shard", hero: "vexa" },
      { id: "high", kind: "sticker", name: "High-beam sticker", hero: "nami" },
   ],
   2: [{ id: "cage", kind: "shard", name: "Cage shard", hero: "vexa" }],
   3: [{ id: "cage", kind: "shard", name: "Cage shard", hero: "vexa" }],
   4: [
      { id: "cage", kind: "shard", name: "Cage shard", hero: "vexa" },
      { id: "high", kind: "sticker", name: "High-beam sticker", hero: "nami" },
   ],
   5: [{ id: "cage", kind: "shard", name: "Cage shard", hero: "vexa" }],
};

/**
 * Level 5's boss, the Vault Core (m2VaultCoreBoss), in its arena. It sweeps a low beam across the
 * arena on each attack (jump it); while it is open, a press on one of the three pylons overloads it (a
 * hit). Phase 2 shortens its open window, phase 3 sweeps faster. A boss adds no score: the proof only
 * takes its least defeat time as a floor.
 */
export const VAULT_CORE: BossConfig = {
   id: "vault-core",
   name: "Vault Core",
   maxHp: 6,
   introMs: 2200,
   transitionMs: 1800,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "grid", name: "Laser grid", endsAt: 3 / 6, attacks: [{ id: "sweep", telegraphMs: 1000, attackMs: 1800, vulnerableMs: 2600 }] },
      { id: "overload", name: "Overload", endsAt: 1 / 6, attacks: [{ id: "sweep", telegraphMs: 900, attackMs: 1600, vulnerableMs: 2200 }] },
      { id: "meltdown", name: "Meltdown", endsAt: 0, attacks: [{ id: "sweep", telegraphMs: 800, attackMs: 1400, vulnerableMs: 2200 }] },
   ],
};
