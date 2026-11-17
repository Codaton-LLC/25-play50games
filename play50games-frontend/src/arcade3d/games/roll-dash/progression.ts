// Roll Dash's Menu 2 game structure (menu2/stars, combo, secrets, boss, progress). Plain data and tiny
// pure helpers; rules.ts uses the combo, the secrets and the boss, Scene.tsx the stars and progress.
import type { LevelId } from "../../types";
import type { ComboConfig } from "../../menu2/combo/combo";
import type { StarSpec } from "../../menu2/stars/stars";
import type { SecretSpec } from "../../menu2/secrets/secrets";
import type { BossConfig } from "../../menu2/boss/boss";
import { LEVELS } from "./levels";

/** The flow meter: unlocks within 4 s of each other chain; +0.25 a link, x2 at most. */
export const COMBO: ComboConfig = { windowMs: 4000, gain: 0.25, cap: 2 };

/**
 * Chain bases (ms off the submitted time at x2). A tag never scores on its own (the W6 card's scoring
 * honesty): only a correct unlock (each lock once), a clutch tag on it, and each Hawk hit count.
 */
export const COMBO_BASE_MS = { lock: 60, clutch: 30, boss: 80 } as const;

/** The third star: beat the card's target time (levels.ts targetMs). */
export function starSpecFor(level: LevelId, orbTotal: number): StarSpec {
   return { orbTotal, goal: { kind: "time", targetMs: LEVELS[level].targetMs } };
}

/**
 * The card's secrets, in the order rules.ts collects them. Secrets never add score.
 * - Perfect Gate (L1): every lock answered, none hit.
 * - The Courtyard (L2): open the ghost wall past 550 m (Vexa).
 * - The Alley (L3): open the gold vault past 500 m (Zuno).
 * - The Shop Window (L4): break a red lock in the dark (Riko): a colour shard.
 * - Full Prism (L2-L4): five different heroes open a lock inside one flow chain.
 * - The Prism Shard (L5): free the Hawk's plates with a Full Prism.
 */
export const SECRETS: Record<LevelId, readonly SecretSpec[]> = {
   1: [{ id: "perfect-gate", kind: "sticker", name: "Perfect Gate" }],
   2: [
      { id: "courtyard", kind: "sticker", name: "The Courtyard", hero: "vexa" },
      { id: "full-prism", kind: "sticker", name: "Full Prism" },
   ],
   3: [
      { id: "alley", kind: "sticker", name: "The Alley", hero: "zuno" },
      { id: "full-prism", kind: "sticker", name: "Full Prism" },
   ],
   4: [
      { id: "shop-window", kind: "shard", name: "The Shop Window", hero: "riko" },
      { id: "full-prism", kind: "sticker", name: "Full Prism" },
   ],
   5: [{ id: "prism-shard", kind: "shard", name: "The Prism Shard" }],
};

export function secretIndex(level: LevelId, id: string): number {
   return SECRETS[level].findIndex((s) => s.id === id);
}

/**
 * Level 5's boss: the Echo Storm Hawk (m2StormHawkBoss in grey smoked glass), flying ahead over the
 * Fortress Bridge. Ten plates:
 * P1 "Feather-locks" (10 -> 4): it drops a feather-lock ahead in each window; open it with the right
 *    hero and a prism spark hits it (6 hits).
 * P2 "Swoop" (4 -> 1): it swoops down a lane (its shadow warns 1.2 s); dodge it. At the bottom its wing
 *    plate glows one colour for 1 s: be that hero and jump into it in its lane (3 hits).
 * P3 "Five plates" (1 -> 0): gusts push you a lane; then five coloured plates 0.6 s apart: pass each as
 *    its hero (a forced Full Prism). Slow-mo shatter.
 * A boss adds no score: the proof takes its least defeat time (bound.ts).
 */
export const HAWK: BossConfig = {
   id: "echo-storm-hawk",
   name: "Echo Storm Hawk",
   maxHp: 10,
   introMs: 1500,
   transitionMs: 1600,
   hitFlashMs: 220,
   oneHitPerWindow: true,
   defeatMs: 2600,
   slowMo: { scale: 0.25, durationMs: 1800 },
   phases: [
      { id: "feathers", name: "Open its feather-locks", endsAt: 4 / 10, attacks: [{ id: "feather", telegraphMs: 900, attackMs: 900, vulnerableMs: 2600 }] },
      { id: "swoop", name: "Jump into its glowing plate", endsAt: 1 / 10, attacks: [{ id: "swoop", telegraphMs: 1200, attackMs: 600, vulnerableMs: 1000 }] },
      { id: "plates", name: "Tag through its five plates", endsAt: 0, attacks: [{ id: "gust", telegraphMs: 800, attackMs: 1200, vulnerableMs: 4200 }] },
   ],
};

/** P3: the five plates come this far apart (s) once the window opens, the first one this late. */
export const PLATE_GAP_S = 0.6;
export const PLATE_FIRST_S = 1.2;
