// Color Orb Defense's Menu 2 structure: points, combo, stars, secrets, the boss. Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";

/** Points: a block, a block at the lane's outermost zone (early), a wave with no leak, the boss. */
export const PTS = { block: 100, early: 50, perfectWave: 250, bossHit: 600, defeat: 2000 } as const;

/** The combo: blocks chain within 2.5 s, x1 to x5; a leak or a knock from the drone breaks it. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 1, cap: 5 };
export const COMBO_BASE = { block: 20, boss: 100 } as const;

/** The core's hit points: an orb that reaches it costs one; none left and the run is lost. */
export const CORE_HP = 20;

/** The third star: a score of at least this share of the level's proven maximum. */
export const STAR_SHARE = 0.6;

export function starSpecFor(level: LevelId, orbTotal: number, maxScore: number): StarSpec {
   const target = Math.round((maxScore * STAR_SHARE) / 50) * 50;
   void level;
   return { orbTotal, goal: { kind: "atLeast", target, label: `Score ${target}` } };
}

/**
 * Secrets, the same three on every level: 0 the perfect wave (every orb of one wave blocked at the
 * outermost zone); 1 the rainbow chain (one block of every colour of the level in a row); 2 the hidden
 * beacon on top of a pillar outside the ring (Nami's double jump).
 */
const SET: readonly SecretSpec[] = [
   { id: "perfect-wave", kind: "sticker", name: "Perfect wave" },
   { id: "rainbow", kind: "sticker", name: "Rainbow chain" },
   { id: "pillar-beacon", kind: "shard", name: "Pillar beacon", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: SET, 2: SET, 3: SET, 4: SET, 5: SET };

/**
 * Level 5's boss: the Orb Mortar, squatting on the north rim. In each window he lobs a golden core orb
 * down a lane; block it in its colour and it flies back into him.
 * P1 Lob: one core orb (2 hits). P2 Twin: two core orbs on two lanes (2 hits). P3 Rainbow: a blinking
 * core orb while the drone speeds up (2 hits).
 */
export const MORTAR: BossConfig = {
   id: "orb-mortar",
   name: "Orb Mortar",
   maxHp: 6,
   introMs: 2000,
   transitionMs: 1500,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2200,
   slowMo: { scale: 0.25, durationMs: 1500 },
   phases: [
      { id: "lob", name: "Lob", endsAt: 4 / 6, attacks: [{ id: "lob", telegraphMs: 900, attackMs: 800, vulnerableMs: 4200 }] },
      { id: "twin", name: "Twin", endsAt: 2 / 6, attacks: [{ id: "twin", telegraphMs: 800, attackMs: 800, vulnerableMs: 4200 }] },
      { id: "rainbow", name: "Rainbow", endsAt: 0, attacks: [{ id: "rainbow", telegraphMs: 700, attackMs: 800, vulnerableMs: 4200 }] },
   ],
};
