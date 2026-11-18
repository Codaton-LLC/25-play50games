// Hero powers (the plan's table). Keyboard E/Enter and the touch Power button are the same
// action press. Durations are identical on every device. heroes.ts re-exports these.
export const POWER_MS = { dash: 280, shield: 2500, magnet: 2500, phase: 1200 } as const;

/** Dash speed (m/s). Above the run speed; the height bound does not use it (a dash is horizontal). */
export const V_DASH = 12.5;

/** Ember pickup radius while Zuno's magnet is up (m). */
export const MAGNET_REACH = 4.2;
