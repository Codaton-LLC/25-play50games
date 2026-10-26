// Hero powers for Cloud Hopper. The same numbers on keyboard and touch (decision 7).
// None of them adds a vertical reach, and none of them holds back the rising water.
// heroes.ts names each hero's power; rules.ts applies these durations.

/** How long each power stays up after it fires (ms). The cooldown is heroById().cooldownMs and starts as it fires. */
export const POWER_MS = { dash: 280, shield: 2500, magnet: 2500, phase: 1200 } as const;

/** Dash speed (m/s). Above V_RUN; the height bound does not use it (a dash is horizontal). */
export const V_DASH = 12.5;

/** Coin pickup radius while Zuno's magnet is up (m). */
export const MAGNET_REACH = 4.2;
