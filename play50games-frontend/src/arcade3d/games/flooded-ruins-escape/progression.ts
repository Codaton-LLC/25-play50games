// Flooded Ruins Escape's Menu 2 structure (menu2/stars, combo, secrets, boss, progress), after
// sky-tower-jump's reference adoption. Plain data and tiny pure helpers: rules.ts uses the combo,
// secret and boss numbers, Scene.tsx the stars and progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";

/** The flow meter: a link within 2.5 s (water takes a moment to move), +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only fixed, countable events feed the meter, so the
 * proof can bound them: each orb once, the first landing on each block (the start excluded), the
 * first pull of each lever, and each hit on the boss.
 */
export const COMBO_BASE_MS = { orb: 40, block: 20, lever: 40, boss: 80 } as const;

/** The third star: the submitted time at or under the card's target (L1 80 s ... L5 210 s). */
export const STAR_TARGET_MS: Record<LevelId, number> = {
   1: 80_000,
   2: 120_000,
   3: 150_000,
   4: 165_000,
   5: 210_000,
};

/** The all-orbs star counts the orbs every hero can reach (hero-gated bonus orbs are extra). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: STAR_TARGET_MS[level] } };
}

/**
 * Secrets per level (placed by ruins.ts, same ids): the card's sunken shard (a chamber fully flooded
 * and then drained in one run shows it on the floor), the sticker behind Vexa's ghost panel, and
 * the hidden chamber off the level 4 swim. No score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "sunken", kind: "shard", name: "Sunken shard" },
      { id: "ghost-niche", kind: "sticker", name: "Niche sticker", hero: "vexa" },
   ],
   2: [
      { id: "sunken", kind: "shard", name: "Sunken shard" },
      { id: "cistern", kind: "shard", name: "Cistern shard", hero: "riko" },
      { id: "ghost-niche", kind: "sticker", name: "Pipe sticker", hero: "vexa" },
   ],
   3: [
      { id: "sunken", kind: "shard", name: "Shaft shard" },
      { id: "ghost-spiral", kind: "sticker", name: "Spiral sticker", hero: "vexa" },
   ],
   4: [
      { id: "bubble-room", kind: "shard", name: "Bubble shard" },
      { id: "ghost-niche", kind: "sticker", name: "Grotto sticker", hero: "vexa" },
   ],
   5: [
      { id: "sunken", kind: "shard", name: "Drain shard" },
      { id: "ghost-niche", kind: "sticker", name: "Bell sticker", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, the card's Umbra Roller (m2ShadowArmadillo), one of Shadow Plates' lieutenants.
 * Three phases, one hit each (rules.ts bossPose and hitsOnBoss):
 * 1. the chase: it rolls down the spiral; flood the ring below so it floats at the ring gate, then
 *    land on its back;
 * 2. the drains: it curls in the drain; hold the three pressure levers so the geyser throws it up,
 *    then hit it while it spins in the air;
 * 3. the storm tide (0.8 m/s): it chases you up the switchbacks; pull the floodgate lever while it
 *    sits on the gate. The Tide Bell rings only after the defeat.
 * Hits come off the submitted time as flow links (COMBO_BASE_MS.boss), counted in the proof.
 */
export const UMBRA_ROLLER: BossConfig = {
   id: "umbra-roller",
   name: "Umbra Roller",
   maxHp: 3,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2400,
   slowMo: { scale: 0.25, durationMs: 1600 },
   phases: [
      {
         id: "chase",
         name: "The chase",
         endsAt: 2 / 3,
         attacks: [{ id: "roll", telegraphMs: 1200, attackMs: 3000, vulnerableMs: 3200 }],
      },
      {
         id: "drains",
         name: "Plugging the drains",
         endsAt: 1 / 3,
         attacks: [{ id: "spin", telegraphMs: 1000, attackMs: 2200, vulnerableMs: 3400 }],
      },
      {
         id: "tide",
         name: "Storm tide",
         endsAt: 0,
         attacks: [{ id: "climb", telegraphMs: 1000, attackMs: 9000, vulnerableMs: 3000 }],
      },
   ],
};
