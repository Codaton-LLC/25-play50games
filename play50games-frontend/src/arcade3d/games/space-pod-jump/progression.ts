// Space Pod Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress): plain data and
// tiny pure helpers; rules.ts uses the combo, the secrets and the boss, the Scene the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: the next orb, gate or capture within 3 s, +0.2 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.2, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each gate, each first capture by a body. */
export const COMBO_BASE_MS = { orb: 20, gate: 40, capture: 60 } as const;

/** "Perfect Orbit": this many captures in a row without jets (the card). */
export const PERFECT_CHAIN = 3;

/** The third star: the level's target time. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by system.ts): Vexa's ghost hatch on every level (the card: two ghost-hatch
 * secrets for her, the hatch and level 4's core), Riko's high-orbit shard behind a cracked panel (levels
 * 2 and 5), level 3's hidden moonlet (a perfect slingshot), level 4's sticker in the big planetoid's core
 * (Vexa's chord through it).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [{ id: "hatch", kind: "shard", name: "Ghost hatch", hero: "vexa" }],
   2: [
      { id: "hatch", kind: "shard", name: "Ghost hatch", hero: "vexa" },
      { id: "shard", kind: "shard", name: "High-orbit shard", hero: "riko" },
   ],
   3: [
      { id: "hatch", kind: "shard", name: "Ghost hatch", hero: "vexa" },
      { id: "moonlet", kind: "shard", name: "Hidden moonlet" },
   ],
   4: [
      { id: "hatch", kind: "shard", name: "Ghost hatch", hero: "vexa" },
      { id: "core", kind: "sticker", name: "Core sticker", hero: "vexa" },
   ],
   5: [
      { id: "hatch", kind: "shard", name: "Ghost hatch", hero: "vexa" },
      { id: "shard", kind: "shard", name: "High-orbit shard", hero: "riko" },
   ],
};

/**
 * Level 5's boss, the Orbit Warden (a mechanical moon with plate rings at the arena's centre), through
 * menu2/boss. Phase 1 "Vents": it fires slow gravity mines that bend your arc; land on one of its three
 * glowing vents (3 hits). Phase 2 "Debris Belt": its rings spin up into a belt with one gap (round every
 * 2.4 s); land on its surface through the gap and walk to its thruster (2 hits). Phase 3 "Escape": it
 * runs for the planet's shadow; hit it fast (8.5 m/s or more: a slingshot off its moon, or a full pod
 * launch) for the final hit. A vent, a thruster or a fast hit queues a hit that lands while it is open.
 */
export const WARDEN: BossConfig = {
   id: "warden",
   name: "the Orbit Warden",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 1800,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2800,
   slowMo: { scale: 0.25, durationMs: 2000 },
   phases: [
      { id: "vents", name: "Vents", endsAt: 3 / 6, attacks: [{ id: "mine", telegraphMs: 800, attackMs: 600, vulnerableMs: 6000 }] },
      { id: "belt", name: "Debris Belt", endsAt: 1 / 6, attacks: [{ id: "belt", telegraphMs: 800, attackMs: 500, vulnerableMs: 7000 }] },
      { id: "escape", name: "Escape", endsAt: 0, attacks: [{ id: "flee", telegraphMs: 700, attackMs: 500, vulnerableMs: 7000 }] },
   ],
};
