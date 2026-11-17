// Portal Hop's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data and tiny
// pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: portal passes within 4 s of each other chain; +0.25 a link, x2 at most. */
export const COMBO: ComboConfig = { windowMs: 4000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x1). Only countable events feed the meter: the first pass
 * out of each anchor's exit, each orb once and each Wyrm hit (bound.ts maxBonusMs).
 */
export const COMBO_BASE_MS = { exit: 60, orb: 30, boss: 80 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them: Vexa's colour shard behind a frame (phase
 * through it instead of being teleported), "Terminal Velocity" (come out of an exit at 18 m/s or more),
 * "Portal Economy" (finish with no more anchor switches than the level's par) and, where a level has
 * one, the hidden anchor that only shows from one spot. Secrets never add score.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "ghost-frame", kind: "shard", name: "Behind the frame", hero: "vexa" },
      { id: "terminal", kind: "sticker", name: "Terminal Velocity" },
      { id: "economy", kind: "sticker", name: "Portal Economy" },
   ],
   2: [
      { id: "ghost-frame", kind: "shard", name: "Behind the frame", hero: "vexa" },
      { id: "hidden-anchor", kind: "sticker", name: "The Hidden Anchor" },
      { id: "economy", kind: "sticker", name: "Portal Economy" },
   ],
   3: [
      { id: "ghost-frame", kind: "shard", name: "Behind the frame", hero: "vexa" },
      { id: "terminal", kind: "sticker", name: "Terminal Velocity" },
      { id: "economy", kind: "sticker", name: "Portal Economy" },
   ],
   4: [
      { id: "ghost-frame", kind: "shard", name: "Behind the frame", hero: "vexa" },
      { id: "economy", kind: "sticker", name: "Portal Economy" },
   ],
   5: [
      { id: "ghost-frame", kind: "shard", name: "Behind the frame", hero: "vexa" },
      { id: "terminal", kind: "sticker", name: "Terminal Velocity" },
   ],
};

/** The secret indices rules.ts fires (an id missing on a level is -1). */
export function secretIndex(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

/**
 * Level 5's boss: the Portal Wyrm, a long serpent of void glass (m2PortalWyrmBoss head, m2VoidCrystal
 * body segments) that swims through YOUR portals. Six plates:
 * P1 "Bonk it on a beacon" (hp 6 -> 3): each window it dives into the west frame and comes out of pair
 *    A's exit; open that exit facing an intact beacon spike and it bonks its head (the spike shatters).
 * P2 "Fling onto its back" (hp 3 -> 1): it coils round the centre island; come down on its back crystal
 *    at 12 m/s or more (the plateau, the pad, the pillar's fling).
 * P3 "Tie the knot" (hp 1 -> 0): set both pairs on their loop anchors so it swims into its own tail,
 *    then touch the knotted head (slow-mo finish).
 * Between windows its tail sweeps the centre island: jump it. A boss adds no score: the proof takes its
 * least defeat time (bound.ts / proof.test.ts).
 */
export const WYRM: BossConfig = {
   id: "portal-wyrm",
   name: "Portal Wyrm",
   maxHp: 6,
   introMs: 1500,
   transitionMs: 1600,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "beacon", name: "Open its exit at a beacon", endsAt: 3 / 6, attacks: [{ id: "sweep", telegraphMs: 1000, attackMs: 1400, vulnerableMs: 7000 }] },
      { id: "back", name: "Fling onto its back", endsAt: 1 / 6, attacks: [{ id: "sweep", telegraphMs: 1000, attackMs: 1400, vulnerableMs: 15000 }] },
      { id: "knot", name: "Tie it in a knot", endsAt: 0, attacks: [{ id: "sweep", telegraphMs: 1000, attackMs: 1400, vulnerableMs: 12000 }] },
   ],
};

/** P1: the Wyrm dives into the west frame this long into its window, and comes out DIVE_MS later. */
export const P1_DIVE_AT = 2500;
export const DIVE_MS = 900;
/** P2: a landing on its back crystal at this speed or more (m/s) cracks a plate */
export const BACK_SPEED = 12;
export const BACK_REACH = 2;
/** P3: with both loops set the Wyrm knots this long into the window; then its head rests here */
export const P3_KNOT_AT = 1500;
export const HEAD_REACH = 1.5;
/** the tail sweep: the centre island between these radii, this wide, low enough to jump */
export const SWEEP_R0 = 1.6;
export const SWEEP_R1 = 7.4;
export const SWEEP_HALF = 0.3;
export const SWEEP_HIGH = 0.9;
