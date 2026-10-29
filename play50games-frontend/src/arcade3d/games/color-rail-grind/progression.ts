// Color Rail Grind's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress): plain data
// and tiny pure helpers; rules.ts uses the combo, the secrets and the boss, the Scene the stars and
// progress. README "Stars, flow, secrets, boss".
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The grind flow: the next orb, ring or thrown switch within 1.5 s, +0.2 per link, capped at x2. */
export const COMBO: ComboConfig = { windowMs: 1500, gain: 0.2, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2): each orb once, each ring once, and each switch thrown
 * that a hero then takes (one per static junction; level 5's arena switches count up to ARENA_LINKS).
 */
export const COMBO_BASE_MS = { orb: 20, ring: 20, switch: 40 } as const;
export const ARENA_LINKS = 20;

/** The third star: the level's target time (the card: 60 / 80 / 95 / 105 / 150 s). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].starTargetMs } };
}

/**
 * Secrets per level (placed by network.ts): Vexa's hidden spur behind the old tunnel's ghost door (every
 * level), Zuno's loop shortcut shard (every level), and level 2's golden caboose sticker (a branch
 * reached only by throwing two switches within a second).
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [
      { id: "hidden", kind: "shard", name: "Hidden spur shard", hero: "vexa" },
      { id: "loop", kind: "shard", name: "Loop shard", hero: "zuno" },
   ],
   2: [
      { id: "hidden", kind: "shard", name: "Hidden spur shard", hero: "vexa" },
      { id: "caboose", kind: "sticker", name: "Golden caboose" },
      { id: "loop", kind: "shard", name: "Loop shard", hero: "zuno" },
   ],
   3: [
      { id: "hidden", kind: "shard", name: "Hidden spur shard", hero: "vexa" },
      { id: "loop", kind: "shard", name: "Loop shard", hero: "zuno" },
   ],
   4: [
      { id: "hidden", kind: "shard", name: "Hidden spur shard", hero: "vexa" },
      { id: "loop", kind: "shard", name: "Loop shard", hero: "zuno" },
   ],
   5: [
      { id: "hidden", kind: "shard", name: "Hidden spur shard", hero: "vexa" },
      { id: "loop", kind: "shard", name: "Loop shard", hero: "zuno" },
   ],
};

/**
 * Level 5's boss, the Clockwork Express (a possessed toy locomotive, Shadow Plates' lieutenant), through
 * menu2/boss. Phase 1 "Route it": it runs ahead on its own rail; throw its switches (they light up as it
 * comes) to send it into the buffer stops (3 crashes). Phase 2 "Wagon drop": it uncouples wagons back at
 * you along your rail (hop to dodge); grind through 3 rings to charge. Phase 3 "Roof": a launch ramp
 * throws you onto its roof; stomp the wind-up key 3 times between its steam puffs. A crash, a charged
 * ring or a stomp queues a hit that lands while it is open. Slow-mo as the key spins out.
 */
export const CLOCKWORK: BossConfig = {
   id: "clockwork",
   name: "the Clockwork Express",
   maxHp: 9,
   introMs: 2500,
   transitionMs: 1800,
   hitFlashMs: 180,
   oneHitPerWindow: true,
   defeatMs: 2800,
   slowMo: { scale: 0.25, durationMs: 2000 },
   phases: [
      { id: "route", name: "Route it", endsAt: 6 / 9, attacks: [{ id: "whistle", telegraphMs: 700, attackMs: 500, vulnerableMs: 6000 }] },
      { id: "wagons", name: "Wagon drop", endsAt: 3 / 9, attacks: [{ id: "wagon", telegraphMs: 900, attackMs: 600, vulnerableMs: 4000 }] },
      { id: "roof", name: "Roof", endsAt: 0, attacks: [{ id: "steam", telegraphMs: 800, attackMs: 900, vulnerableMs: 3200 }] },
   ],
};
