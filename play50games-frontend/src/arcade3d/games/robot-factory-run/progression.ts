// Robot Factory Run's Menu 2 structure: flow, stars, secrets and Overseer M-8 (menu2/combo, stars,
// secrets, boss). Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb once, each charged cell, each boss hit. */
export const COMBO_BASE_MS = { orb: 20, cell: 30, boss: 40 } as const;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * Two secrets a level, in factory.ts order: one for anyone who explores (L1: the hidden sixth
 * turntable's secret charger, fed a cell; L3: the roof window the arm lifts you to), one behind a
 * hero power (Vexa's ghost-crate maintenance rooms, Nami's catwalk sticker).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "secret-charger", kind: "sticker", name: "Secret charger" },
      { id: "maintenance", kind: "shard", name: "Maintenance shard", hero: "vexa" },
   ],
   2: [
      { id: "corner", kind: "shard", name: "Klaxon shard" },
      { id: "maintenance", kind: "sticker", name: "Ghost-crate sticker", hero: "vexa" },
   ],
   3: [
      { id: "roof-window", kind: "shard", name: "Roof window shard" },
      { id: "maintenance", kind: "sticker", name: "Maintenance sticker", hero: "vexa" },
   ],
   4: [
      { id: "corner", kind: "shard", name: "Laser shard" },
      { id: "catwalk", kind: "sticker", name: "Catwalk sticker", hero: "nami" },
   ],
   5: [
      { id: "catwalk", kind: "shard", name: "Foreman's shard" },
      { id: "maintenance", kind: "sticker", name: "Overdrive sticker", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, Overseer M-8 (Shadow Plates' factory foreman, m2MegaRobotBoss), menu2/boss.
 * P1 "Overload" (8 -> 5): its chest socket glows; a cell routed into it while it glows is a hit.
 * Its punch (the attack) knocks a turntable a quarter turn and jams it for 3 s.
 * P2 "Belt walk" (5 -> 3): it walks the lane belts; reverse the lane (the lane plate) to drag it
 * into the press, which slams it while the window is open. Twice.
 * P3 "Overheat" (3 -> 0): back on its gantry, its back vents open: from the catwalk, jump and
 * roll-drop (Jump in the air) into a vent. Three times. Slow-mo, the furnaces relight red.
 */
export const OVERSEER: BossConfig = {
   id: "overseer-m8",
   name: "Overseer M-8",
   maxHp: 8,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "overload", name: "Overload", endsAt: 5 / 8, attacks: [{ id: "punch", telegraphMs: 1000, attackMs: 800, vulnerableMs: 4000 }] },
      { id: "belt-walk", name: "Belt walk", endsAt: 3 / 8, attacks: [{ id: "walk", telegraphMs: 1000, attackMs: 1000, vulnerableMs: 5000 }] },
      { id: "overheat", name: "Overheat", endsAt: 0, attacks: [{ id: "vent", telegraphMs: 900, attackMs: 700, vulnerableMs: 4000 }] },
   ],
};
