// Color Boss Tower's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo): a claw charged
// (each once), a cannon hit, an orb, a glyph of the tag finish. Tags and hand-offs never score.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Ms off the submitted time at x2, each source once per thing. */
export const COMBO_BASE_MS = { charge: 60, hit: 80, orb: 30, glyph: 30 } as const;

/** Level 5's tag finish: each of the five glyphs lights this long, one after the other. */
export const GLYPH_MS = 800;

/** The third star: the card's target times. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, in each level's `secrets` order: the sticker in a niche behind a ghost panel in the wall
 * (Vexa's phase), the shard behind a cracked window (Riko's dash), the sticker on the high skip ledge
 * (Nami's double jumps).
 */
const BASE: readonly SecretSpec[] = [
   { id: "ghost-niche", kind: "sticker", name: "Niche sticker", hero: "vexa" },
   { id: "window-shard", kind: "shard", name: "Window shard", hero: "riko" },
   { id: "skip-sticker", kind: "sticker", name: "Skip sticker", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: BASE, 4: BASE, 5: BASE };

/** The Stone Guardian's sweep cycle: the arm's dust and glow line, the sweep round the ring, his weak plate open. */
const SWEEP = { id: "sweep", telegraphMs: 3200, attackMs: 700, vulnerableMs: 3000 } as const;

function stone(cycles: number, fury = false): BossConfig {
   return {
      id: "stone-guardian",
      name: "Stone Guardian",
      maxHp: cycles,
      introMs: 2500,
      transitionMs: 1800,
      hitFlashMs: 160,
      oneHitPerWindow: true,
      defeatMs: 2600,
      slowMo: { scale: 0.3, durationMs: 1500 },
      phases: fury
         ? [
              { id: "fury", name: "Fury", endsAt: 2 / cycles, attacks: [SWEEP] },
              { id: "chase", name: "Climbing Chase", endsAt: 0, attacks: [{ id: "chase", telegraphMs: 3600, attackMs: 700, vulnerableMs: 3200 }] },
           ]
         : [{ id: "guard", name: "Guard", endsAt: 0, attacks: [SWEEP] }],
   };
}

/**
 * L1-4: the Stone Guardian (`m2StoneGuardianBoss`), the tower's lieutenant: 2, 3, 4, 5 cycles; his fury
 * on level 4 has a second phase that needs a chain charge. L5: the Grand Color Guardian
 * (`m2ColorGuardianBoss`), 6 HP: Plate Armour (3: the lit claw), Spire Collapse (2: a chain charge before
 * his beam drains the cores), Grey Heart (1: the tag finish, five glyphs).
 */
export const BOSSES: Record<"stone2" | "stone3" | "stone4" | "stone5" | "grand", BossConfig> = {
   stone2: stone(2),
   stone3: stone(3),
   stone4: stone(4),
   stone5: stone(5, true),
   grand: {
      id: "grand-color-guardian",
      name: "Grand Color Guardian",
      maxHp: 6,
      introMs: 3000,
      transitionMs: 2200,
      hitFlashMs: 160,
      oneHitPerWindow: true,
      defeatMs: 3000,
      slowMo: { scale: 0.25, durationMs: 1800 },
      phases: [
         { id: "plates", name: "Plate Armour", endsAt: 3 / 6, attacks: [{ id: "discs", telegraphMs: 3400, attackMs: 700, vulnerableMs: 3200 }] },
         { id: "collapse", name: "Spire Collapse", endsAt: 1 / 6, attacks: [{ id: "beam", telegraphMs: 3800, attackMs: 700, vulnerableMs: 3200 }] },
         { id: "heart", name: "Grey Heart", endsAt: 0, attacks: [{ id: "heart", telegraphMs: 3000, attackMs: 600, vulnerableMs: GLYPH_MS * 5 + 400 }] },
      ],
   },
};
