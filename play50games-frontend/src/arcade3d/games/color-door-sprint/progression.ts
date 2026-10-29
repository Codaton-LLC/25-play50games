// Color Door Sprint's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress): plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, the Scene the stars and
// progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: the next link within 4.5 s (a wall comes every 2-4.5 s), +0.25 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 4500, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). Only countable events feed the meter: each orb once,
 * each static wall's true pass once, and on level 5 only the first ARENA_LINKS true arena doors (the
 * arena's walls keep coming while Flicker is up, so their count is capped: the bound stays finite).
 */
export const COMBO_BASE_MS = { orb: 30, door: 40 } as const;
export const ARENA_LINKS = 40;

/** The third star: the level's target time. */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by halls.ts): the card's Riko side-corridor shard (L1, L3), Nami's
 * sticker in the upper door row (L3 to L5), and a colour shard behind every level's ghost door (Vexa).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "side", kind: "shard", name: "Side-corridor shard", hero: "riko" },
      { id: "ghost", kind: "shard", name: "Ghost-door shard", hero: "vexa" },
   ],
   2: [{ id: "ghost", kind: "shard", name: "Ghost-door shard", hero: "vexa" }],
   3: [
      { id: "side", kind: "shard", name: "Side-corridor shard", hero: "riko" },
      { id: "upper", kind: "sticker", name: "Upper-row sticker", hero: "nami" },
      { id: "ghost", kind: "shard", name: "Ghost-door shard", hero: "vexa" },
   ],
   4: [
      { id: "upper", kind: "sticker", name: "Upper-row sticker", hero: "nami" },
      { id: "ghost", kind: "shard", name: "Ghost-door shard", hero: "vexa" },
   ],
   5: [
      { id: "upper", kind: "sticker", name: "Upper-row sticker", hero: "nami" },
      { id: "ghost", kind: "shard", name: "Ghost-door shard", hero: "vexa" },
   ],
};

/**
 * Level 5's boss, Flicker the Fire Spirit (a drained fire spirit Shadow Plates set as the hall's
 * warden), through menu2/boss. Phase 1 "Door Slam": he races ahead slamming doors, his flame colour is
 * the rule; a rolling fire wave (jump it); every 4 true doors in a row charge a red rush: fire it while
 * he is open to ram him (3 hits). Phase 2 "False Cues": the lamp flickers between colours, the true one
 * is held longest and chimes; a low flame arc (roll under it); the rush again (2 hits). Phase 3 "Three
 * Flames": he splits into three flames, each behind a door; take the door that matches the lamp while
 * he is open (3 hits, each one faster); a lane of fire to dodge. Slow-mo, and the doors swing open.
 * A boss adds no score: the proof only takes its least defeat time as a floor (rules.ts bossMinMs).
 */
export const FLICKER: BossConfig = {
   id: "flicker",
   name: "Flicker, the Fire Spirit",
   maxHp: 8,
   introMs: 2500,
   transitionMs: 1800,
   hitFlashMs: 160,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "slam", name: "Door Slam", endsAt: 5 / 8, attacks: [{ id: "wave", telegraphMs: 900, attackMs: 1500, vulnerableMs: 4500 }] },
      { id: "cues", name: "False Cues", endsAt: 3 / 8, attacks: [{ id: "arc", telegraphMs: 900, attackMs: 1500, vulnerableMs: 4500 }] },
      { id: "flames", name: "Three Flames", endsAt: 0, attacks: [{ id: "lane", telegraphMs: 900, attackMs: 1500, vulnerableMs: 5000 }] },
   ],
};
