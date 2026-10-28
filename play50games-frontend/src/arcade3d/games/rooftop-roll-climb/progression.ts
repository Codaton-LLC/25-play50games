// Rooftop Roll Climb's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress), adopted
// after the sky-tower-jump reference. Plain data and tiny pure helpers: rules.ts uses the combo and
// secret numbers and steps the boss, Scene.tsx the stars and progress. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";

/**
 * The flow meter: slope, leap, slope. The card asks for a 0.6 s window, but a rolled leap's flight
 * alone lasts about 0.85 s, so the window is 1.2 s: a link within it, +0.25 per link, capped at x2.
 */
export const COMBO: ComboConfig = { windowMs: 1200, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter, so the
 * proof can bound them: each coin once, the first landing on each roof (the start excluded), and the
 * first banked leap off each slope (a take-off from a slope at BANK_SPEED or more).
 */
export const COMBO_BASE_MS = { orb: 40, roof: 20, bank: 30 } as const;

/** The third star: the submitted time (finish minus coin and flow bonus) at or under this (about 1.5x the honest bot). */
export const STAR_TARGET_MS: Record<LevelId, number> = {
   1: 29_000,
   2: 37_000,
   3: 40_000,
   4: 42_000,
   5: 83_000,
};

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: STAR_TARGET_MS[level] } };
}

/**
 * Where a secret hides (roofs.ts places each one off the main line):
 * - tower: a water-tower ledge 8 m to the side of a deck, too far for a plain jump (Nami's second jump, or a fast curled turn);
 * - gutter: out over the street beside a slope's roll line (Zuno's magnet pulls it in from the slope);
 * - skylight: inside a cracked skylight box on a deck (Riko's dash smashes it);
 * - billboard: inside a purple-outlined ghost billboard on a deck (Vexa phases into it);
 * - arc: inside a live neon spark arc on a deck (Kiro's shield, or Vexa's phase);
 * - crane: hanging off a crane hook high over a street, on the line of a perfect rolled leap.
 */
export type SecretSpot = "tower" | "gutter" | "skylight" | "billboard" | "arc" | "crane";

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "tower", kind: "sticker", name: "Water-tower sticker", hero: "nami" },
      { id: "gutter", kind: "shard", name: "Gutter shard", hero: "zuno" },
      { id: "skylight", kind: "shard", name: "Skylight shard", hero: "riko" },
   ],
   2: [
      { id: "billboard", kind: "shard", name: "Billboard shard", hero: "vexa" },
      { id: "tower", kind: "sticker", name: "Water-tower sticker", hero: "nami" },
   ],
   3: [
      { id: "crane", kind: "shard", name: "Crane-hook shard" },
      { id: "skylight", kind: "sticker", name: "Skylight sticker", hero: "riko" },
   ],
   4: [
      { id: "arc", kind: "shard", name: "Neon shard", hero: "kiro" },
      { id: "billboard", kind: "shard", name: "Billboard shard", hero: "vexa" },
      { id: "gutter", kind: "sticker", name: "Gutter sticker", hero: "zuno" },
   ],
   5: [
      { id: "skylight", kind: "shard", name: "Skylight shard", hero: "riko" },
      { id: "tower", kind: "shard", name: "Water-tower shard", hero: "nami" },
      { id: "arc", kind: "sticker", name: "Neon sticker", hero: "kiro" },
   ],
};

/**
 * Level 5's boss: Ashback, the Shadow Armadillo (m2ShadowArmadillo), fought on the helipad arena (a
 * half-pipe: deck, ramp, pad, ramp, deck). Every attack ends with him open at the foot of the ramp on
 * your side: roll down it into him (curled, fast) to score a hit.
 * - P1 Race: he kicks a water tank down your ramp (wobble telegraph, 1 s rolling tank), then stands
 *   at its foot catching his breath. 2 hits.
 * - P2 Grey paint: he sprays your ramp grey (it glows 1.5 s ahead; grey = no roll speed), then sprays
 *   from its foot. Ram him at 10 m/s or more. 2 hits.
 * - P3 Helipad duel: he curls at the far side and rams across the pad on a 2.5 s telegraph, hits the
 *   antenna and is stunned at your foot for 2 s. 3 hits. Slow-mo finish; he flees down the mountain.
 * The defeat is the finish. The boss adds no score; the proof adds his least defeat time (rules.ts).
 */
export const ASHBACK: BossConfig = {
   id: "ashback",
   name: "Ashback, the Shadow Armadillo",
   maxHp: 7,
   introMs: 1500,
   transitionMs: 1200,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      { id: "race", name: "Race", endsAt: 5 / 7, attacks: [{ id: "tank", telegraphMs: 1000, attackMs: 1000, vulnerableMs: 3000 }] },
      { id: "paint", name: "Grey paint", endsAt: 3 / 7, attacks: [{ id: "paint", telegraphMs: 1500, attackMs: 2000, vulnerableMs: 2500 }] },
      { id: "duel", name: "Helipad duel", endsAt: 0, attacks: [{ id: "ram", telegraphMs: 2500, attackMs: 900, vulnerableMs: 2000 }] },
   ],
};

/** The curled speed (m/s) a ram needs, per phase (the card: 10 m/s in P2). */
export const ASHBACK_HIT_SPEED = [9, 10, 9] as const;
