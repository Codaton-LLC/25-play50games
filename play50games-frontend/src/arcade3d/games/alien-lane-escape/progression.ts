// Alien Lane Escape's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data
// and tiny pure helpers. README "Stars, flow, secrets".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: a link within 3 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 3000, gain: 0.25, cap: 2 };

/** Chain bases (ms off the submitted time at x2): each orb, each scan passed "Unseen". */
export const COMBO_BASE_MS = { orb: 30, unseen: 80 } as const;

export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by course.ts): the cave behind a ghost-crystal wall (Vexa's phase), the
 * sticker on the high mesa (Nyla's double jump), and on level 3 the "abducted shard" you only reach by
 * letting the beam take you once inside the abduction zone.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "cave", kind: "shard", name: "Crystal-cave shard", hero: "vexa" },
      { id: "mesa", kind: "sticker", name: "Mesa sticker", hero: "nami" },
   ],
   2: [{ id: "cave", kind: "shard", name: "Crystal-cave shard", hero: "vexa" }],
   3: [
      { id: "cave", kind: "shard", name: "Crystal-cave shard", hero: "vexa" },
      { id: "abducted", kind: "shard", name: "Abducted shard" },
   ],
   4: [
      { id: "cave", kind: "shard", name: "Crystal-cave shard", hero: "vexa" },
      { id: "mesa", kind: "sticker", name: "Mesa sticker", hero: "nami" },
   ],
   5: [{ id: "cave", kind: "shard", name: "Crystal-cave shard", hero: "vexa" }],
};

/**
 * Level 5's boss, the Mothership, in a running fight through menu2/boss. Every hit comes from the track:
 * an abduction beam lured onto a decoy pod (phase 1: stand in the pod's lane as the beam locks, leave it
 * before it lands), a jump into its glowing underside off the saucer drones (phase 2), and the last jump
 * that crashes a meteor into it at the launch pad (phase 3). Each lands in its next open window. A boss
 * adds no score: the proof only takes its least defeat time as a floor.
 */
export const MOTHERSHIP: BossConfig = {
   id: "mothership",
   name: "Mothership",
   maxHp: 7,
   introMs: 2500,
   transitionMs: 2000,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "beams", name: "Abduction beams", endsAt: 4 / 7, attacks: [{ id: "beam", telegraphMs: 900, attackMs: 800, vulnerableMs: 2600 }] },
      { id: "underside", name: "Glowing underside", endsAt: 1 / 7, attacks: [{ id: "lower", telegraphMs: 1000, attackMs: 900, vulnerableMs: 2600 }] },
      { id: "launch", name: "Planet escape", endsAt: 0, attacks: [{ id: "scan", telegraphMs: 800, attackMs: 800, vulnerableMs: 3000 }] },
   ],
};
