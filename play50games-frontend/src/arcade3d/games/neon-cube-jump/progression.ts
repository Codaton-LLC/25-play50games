// Neon Cube Jump's Menu 2 structure (menu2/stars, combo, secrets, boss, progress). Plain data; rules.ts
// uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: first landings on cubes within 1.5 s of each other chain; +0.25 a link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 1500, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x1): a cube's first landing, a Flipframe hit. */
export const COMBO_BASE_MS = { cube: 15, boss: 150 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: the parity shard (picked up only after an
 * even number of jumps since the checkpoint), Vexa's two ghost-wall crystals, and on level 3 Nami's
 * same-set ledge sticker in place of the second crystal. Secrets never add time.
 */
const BASE: readonly SecretSpec[] = [
   { id: "parity", kind: "shard", name: "Parity shard" },
   { id: "ghost-a", kind: "sticker", name: "Ghost wall crystal", hero: "vexa" },
   { id: "ghost-b", kind: "shard", name: "Second ghost crystal", hero: "vexa" },
];

const L3: readonly SecretSpec[] = [
   { id: "parity", kind: "shard", name: "Parity shard" },
   { id: "ghost-a", kind: "shard", name: "Ghost wall crystal", hero: "vexa" },
   { id: "ledge", kind: "sticker", name: "Same-set ledge", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: L3, 4: BASE, 5: BASE };

/**
 * Level 5's boss, Flipframe: a 3 x 3 giant of neon cubes round its core (m2FlipframeCore on a sentry
 * drone). Time-driven: hits land only in the vulnerable windows.
 * P1 "Dodge the stomp" (hp 7 -> 4): it stomps the set that is solid at its tell (and the floor); be on
 *    the other set when it lands. Each dodged stomp cracks it (3 hits).
 * P2 "Stomp the core" (hp 4 -> 1): its core drops onto a hologram cube; jump so that cube turns solid
 *    and land on it while the core is open (3 hits).
 * P3 "Overdrive" (hp 1 -> 0): the field flips on its own every 1.2 s as well as on your jumps; climb
 *    the core tower and land on its top while the core is open (slow-mo finish).
 */
export const FLIPFRAME: BossConfig = {
   id: "flipframe",
   name: "Flipframe",
   maxHp: 7,
   introMs: 1600,
   transitionMs: 1600,
   hitFlashMs: 200,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "stomp", name: "Be on the other set when it stomps", endsAt: 4 / 7, attacks: [{ id: "stomp", telegraphMs: 1500, attackMs: 300, vulnerableMs: 900 }] },
      { id: "core", name: "Turn the core's cube solid and land on it", endsAt: 1 / 7, attacks: [{ id: "drop", telegraphMs: 1200, attackMs: 400, vulnerableMs: 3200 }] },
      { id: "overdrive", name: "Overdrive: climb the tower to the core", endsAt: 0, attacks: [{ id: "overdrive", telegraphMs: 1000, attackMs: 400, vulnerableMs: 4200 }] },
   ],
};

/** P3 flips the field by itself this often (ms). */
export const OVERDRIVE_MS = 1200;
