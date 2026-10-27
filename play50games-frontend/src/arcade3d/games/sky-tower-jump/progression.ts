// Sky Tower Jump's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress): the reference
// adoption. Plain data and tiny pure helpers; rules.ts uses the combo and secret numbers, Scene.tsx
// the stars and progress. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";

/** The flow meter: a link within 2 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2; at x1.25 a quarter of it). Only fixed, countable
 * events feed the meter, so the proof can bound them: each orb once, and the first landing on each
 * platform (the start excluded).
 */
export const COMBO_BASE_MS = { orb: 40, island: 20 } as const;

/** The third star: the submitted time (finish minus orb and flow bonus) at or under this. */
export const STAR_TARGET_MS: Record<LevelId, number> = {
   1: 17_000,
   2: 27_000,
   3: 36_000,
   4: 50_000,
   5: 72_000,
};

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: STAR_TARGET_MS[level] } };
}

/**
 * Secrets per level (placed by rules.ts secretSpots): the sky shard hangs over the first bounce pad's
 * apex (straight up from the pad, Nami's double jump steadies the hover), the ledge shard floats off
 * the side of a mid-route island (a jump out and back; Zuno's magnet reaches it from the edge), and
 * the sticker drifts beside the gate on levels 1 and 5.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
      { id: "ledge", kind: "shard", name: "Ledge shard", hero: "zuno" },
      { id: "gate", kind: "sticker", name: "Gate sticker" },
   ],
   2: [
      { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
      { id: "ledge", kind: "shard", name: "Ledge shard", hero: "zuno" },
   ],
   3: [
      { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
      { id: "ledge", kind: "shard", name: "Ledge shard", hero: "zuno" },
   ],
   4: [
      { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
      { id: "ledge", kind: "shard", name: "Ledge shard", hero: "kiro" },
   ],
   5: [
      { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
      { id: "ledge", kind: "shard", name: "Ledge shard", hero: "kiro" },
      { id: "gate", kind: "sticker", name: "Summit sticker" },
   ],
};

/**
 * Level 5's boss, declared only (no boss fight yet: Infinite Tower is a climb). The day the summit
 * gets its guardian, the Scene steps this with menu2/boss and the HUD draws BossHealthBar; a boss
 * adds no score, so the proof is unchanged.
 */
export const STORM_GUARDIAN: BossConfig = {
   id: "storm-guardian",
   name: "Storm Guardian",
   maxHp: 6,
   introMs: 1800,
   transitionMs: 1200,
   hitFlashMs: 140,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      {
         id: "gusts",
         name: "Gusts",
         endsAt: 0.5,
         attacks: [{ id: "gust-wave", telegraphMs: 900, attackMs: 700, vulnerableMs: 1600 }],
      },
      {
         id: "thunder",
         name: "Thunder",
         endsAt: 0,
         attacks: [
            { id: "rim-strike", telegraphMs: 700, attackMs: 500, vulnerableMs: 1200 },
            { id: "gust-wave", telegraphMs: 600, attackMs: 700, vulnerableMs: 1000 },
         ],
      },
   ],
};
