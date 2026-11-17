// Color Match Jump's Menu 2 structure (menu2/combo, stars, secrets, boss). Plain data.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: matched landings within 2 s chain; +0.25 a link, capped at x2. Flow never changes the time. */
export const COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

/** Stars: clear / every orb (each hero's route holds one) / the crown within the target time. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/** One secret per level (course.ts marks the hex or float; L4's is a rule). */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [{ id: "high-pillar", kind: "sticker", name: "High pillar sticker", hero: "nami" }],
   2: [{ id: "ghost-hex", kind: "sticker", name: "Hex inside the ghost pillar", hero: "vexa" }],
   3: [{ id: "far-island", kind: "shard", name: "Far island shard", hero: "riko" }],
   4: [{ id: "fast-code", kind: "shard", name: "A code cracked in under 4 s" }],
   5: [{ id: "frost-shard", kind: "shard", name: "Frost shard over the void", hero: "zuno" }],
};

/**
 * L5's boss, the Echo Frost Golem (m2FrostGolemBoss in grey glass). Event-driven: the rules queue a hit
 * when the player earns it and the machine takes it in its next vulnerable window.
 * P1 "Crack the cores" (7 -> 4): it slams a ring of hexes into grey ice; crack a 4-colour code whose
 *    last hex is the glowing core hex behind it (3 hits).
 * P2 "Stomp the plate" (4 -> 1): boulders delete the hex you stand on; land the stomp hex beside it,
 *    jump at it, double-jump (Nami) and be the plate's colour as you land on its shoulder (3 hits).
 * P3 "Prism storm" (1 -> 0): every hex recolours every 2 s; survive 20 s and take 5 prism shards.
 */
export const FROST_GOLEM: BossConfig = {
   id: "echo-frost-golem",
   name: "Echo Frost Golem",
   maxHp: 7,
   introMs: 1500,
   transitionMs: 1500,
   hitFlashMs: 220,
   oneHitPerWindow: false,
   defeatMs: 2400,
   slowMo: { scale: 0.3, durationMs: 1800 },
   phases: [
      { id: "cores", name: "Crack a code onto its glowing core", endsAt: 4 / 7, attacks: [{ id: "slam", telegraphMs: 1200, attackMs: 400, vulnerableMs: 4400 }] },
      { id: "plate", name: "Stomp hex, double jump, match its plate", endsAt: 1 / 7, attacks: [{ id: "boulder", telegraphMs: 1000, attackMs: 300, vulnerableMs: 3000 }] },
      { id: "storm", name: "Prism storm: survive 20 s, take 5 shards", endsAt: 0, attacks: [{ id: "storm", telegraphMs: 800, attackMs: 200, vulnerableMs: 3000 }] },
   ],
};

/** P3 recolours the field this often (ms) and lasts at least this long (ms); shards to take. */
export const STORM = { recolourMs: 2000, surviveMs: 20_000, shards: 5 } as const;
