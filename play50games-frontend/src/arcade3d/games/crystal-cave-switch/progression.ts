// Crystal Cave Switch's Menu 2 structure (menu2/stars, combo, secrets, boss, progress). Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: crystals struck in order within 5 s of each other chain; +0.25 a link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 5000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x1): a crystal's first correct strike, a Prism hit. */
export const COMBO_BASE_MS = { crystal: 60, boss: 200 } as const;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The secrets, in the order rules.ts collects them: "Flawless" (the level without a single wrong
 * crystal: a sticker), Vexa's ghost-wall crystal (a shard), Nami's high crystal on its pillar (a
 * sticker). Secrets never add time.
 */
const LIST: readonly SecretSpec[] = [
   { id: "flawless", kind: "sticker", name: "Flawless sequence" },
   { id: "ghost", kind: "shard", name: "Ghost alcove crystal", hero: "vexa" },
   { id: "high", kind: "sticker", name: "High crystal", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: LIST, 2: LIST, 3: LIST, 4: LIST, 5: LIST };

/**
 * Level 5's boss, the Hollow Prism (World 5's guardian): a huge black-glass octahedron over the arena.
 * Its tell picks a lane toward you and the beam follows (step out, or Kiro's shield); while its core is
 * open it shows a colour code over its head: strike the arena's crystals in that order before it closes.
 * P1 "One colour" (hp 6 -> 3): one crystal (3 hits). P2 "Two colours" (hp 3 -> 1): two in order
 * (2 hits). P3 "Three colours" (hp 1 -> 0): three in order (the finish, slow-mo).
 */
export const PRISM: BossConfig = {
   id: "hollow-prism",
   name: "Hollow Prism",
   maxHp: 6,
   introMs: 1600,
   transitionMs: 1600,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "one", name: "Strike the colour it shows", endsAt: 3 / 6, attacks: [{ id: "beam", telegraphMs: 1300, attackMs: 500, vulnerableMs: 4500 }] },
      { id: "two", name: "Strike its two colours in order", endsAt: 1 / 6, attacks: [{ id: "beam", telegraphMs: 1200, attackMs: 500, vulnerableMs: 6500 }] },
      { id: "three", name: "Strike its three colours in order", endsAt: 0, attacks: [{ id: "beam", telegraphMs: 1100, attackMs: 500, vulnerableMs: 8500 }] },
   ],
};
