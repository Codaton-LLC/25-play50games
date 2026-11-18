// Ultimate Color Trial's Menu 2 structure (menu2/stars, combo, secrets, boss). Plain data.
// The flow meter counts only fixed events, so comboMaxBonus stays finite (menu2/combo).
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** A link within 2.5 s, +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 2500, gain: 0.25, cap: 2 };

/**
 * Ms off the submitted time at x2, each source once per thing: a ring passed in order, a colour door
 * passed, a section done, a gem, the energy core delivered, a hit on the Chroma Sentinel. The boss's
 * own rings and doors never link (their number is not fixed: a missed window brings a new round).
 */
export const COMBO_BASE_MS = { ring: 30, door: 30, section: 60, orb: 25, core: 40, hit: 50 } as const;

/** The third star: the card's target windows. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets, in each level's `secrets` order: the sticker behind a void gate (Vexa phases through), the
 * shard behind a crystal wall (Riko's dash shatters it), the shard on the sky ledge (Nyla's second
 * jump).
 */
const BASE: readonly SecretSpec[] = [
   { id: "void-sticker", kind: "sticker", name: "Fortress sticker", hero: "vexa" },
   { id: "wall-shard", kind: "shard", name: "Prism shard", hero: "riko" },
   { id: "sky-shard", kind: "shard", name: "Sky shard", hero: "nami" },
];

export const SECRETS: Record<LevelId, readonly SecretSpec[]> = { 1: BASE, 2: BASE, 3: BASE, 4: BASE, 5: BASE };

/**
 * The Chroma Sentinel, Shadow Plates' last guardian, on the far end of the Grand Hero Trial's arena.
 * 6 HP. Every attack is a telegraph (his beacon shows what he asks), a sweep of his orbs across the
 * arena (keep clear), then the window:
 * - Gates (2 hits): the beacon shows a colour: take it from a switch and come through that colour's
 *   door to touch him.
 * - Rings (2 hits): his three arena rings light up: pass them in order.
 * - Siege (2 hits): an energy core drops in the arena: carry it to his receptor.
 * His hits come from the level's own mechanics, never from a plain touch.
 */
export const SENTINEL: BossConfig = {
   id: "chroma-sentinel",
   name: "Chroma Sentinel",
   maxHp: 6,
   introMs: 2500,
   transitionMs: 1500,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "gates", name: "Gates", endsAt: 4 / 6, attacks: [{ id: "colour", telegraphMs: 1800, attackMs: 1200, vulnerableMs: 10_000 }] },
      { id: "rings", name: "Rings", endsAt: 2 / 6, attacks: [{ id: "hoops", telegraphMs: 1800, attackMs: 1200, vulnerableMs: 12_000 }] },
      { id: "siege", name: "Siege", endsAt: 0, attacks: [{ id: "core", telegraphMs: 1800, attackMs: 1200, vulnerableMs: 12_000 }] },
   ],
};
