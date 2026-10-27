// Runs a game's per-player simulation N times with the same deterministic rules. Every player's
// sim is made from the SAME seed (rules.ts is seeded), so the course, the movers and the hazards
// are the same race for everyone; only the hero and the input differ. Each frame every sim takes
// the same dt, so all clocks stay in lock-step (a finished sim may stop its own clock).
// Pure (no React, no three.js); tested in simulate.test.ts and in the reference game.

export interface PlayerSimSpec<Sim, Input, Events> {
   /** one player's sim: the shared seed, the player's index and the per-player options (its hero) */
   create(seed: number, index: number): Sim;
   /** one frame of one sim (the game's own step) */
   step(sim: Sim, dtMs: number, input: Input): Events;
}

export interface PlayerSims<Sim, Events> {
   seed: number;
   sims: Sim[];
   /** each sim's events of the latest step (the game's own objects, as step returned them) */
   events: Events[];
}

export function createPlayerSims<Sim, Input, Events>(spec: PlayerSimSpec<Sim, Input, Events>, seed: number, count: number): PlayerSims<Sim, Events> {
   const sims: Sim[] = [];
   for (let i = 0; i < count; i++) sims.push(spec.create(seed, i));
   return { seed, sims, events: new Array<Events>(count) };
}

/**
 * Steps every sim once with the same dt and its own input (inputs[i]; a missing input is the
 * `idle` input). `skip(i)` true leaves a sim untouched this frame (a dropped player). Returns the
 * events array (the same one every frame). Allocates nothing.
 */
export function stepPlayerSims<Sim, Input, Events>(
   spec: PlayerSimSpec<Sim, Input, Events>,
   group: PlayerSims<Sim, Events>,
   dtMs: number,
   inputs: readonly (Input | undefined)[],
   idle: Input,
   skip?: (index: number) => boolean,
): Events[] {
   const { sims, events } = group;
   for (let i = 0; i < sims.length; i++) {
      if (skip?.(i)) continue;
      events[i] = spec.step(sims[i], dtMs, inputs[i] ?? idle);
   }
   return events;
}
