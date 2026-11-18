// The Menu 2 flow meter (00-framework.md "Juice"): chained actions inside a window raise a multiplier,
// up to a hard cap. Pure and allocation-free per step, so a game's rules.ts can call it every ms.
//
// The proof helper `comboMaxBonus(spec)` is the most bonus any run can collect on a level: each game
// adds it to its maxScore bound (points games) or takes it off its least duration (time games).
//
// Why the bound holds (README "Proof"):
// 1. An event's bonus is comboBonus(base, chain), where chain is the event's place in its current
//    unbroken chain (1 for the first). chain <= the number of combo events so far, i.e. the i-th event
//    of a run has chain <= i.
// 2. comboMultiplier(chain) is non-decreasing in chain and capped, so the i-th event's bonus is at most
//    base_i * (multiplier(i) - 1).
// 3. The bases are a level's fixed pickups (each counted once), so summing (2) over every event, with
//    the largest bases put on the highest multipliers (the rearrangement inequality), is an upper bound
//    for every order and every break pattern. comboMaxBonus is exactly that sum.

export interface ComboConfig {
   /** a new event within this many ms of the previous one continues the chain */
   windowMs: number;
   /** the multiplier grows by this much per chained event after the first (1, 1 + gain, 1 + 2 gain, ...) */
   gain: number;
   /** the hard cap of the multiplier (>= 1) */
   cap: number;
}

/** A sensible default: 2 s window, +0.25 per link, capped at x2. */
export const DEFAULT_COMBO: ComboConfig = { windowMs: 2000, gain: 0.25, cap: 2 };

export interface ComboState {
   /** events in the current chain (0 = no chain) */
   chain: number;
   /** the multiplier the current chain stands at (1 without a chain) */
   multiplier: number;
   /** the rules ms of the last event in the chain (-Infinity = none) */
   lastMs: number;
   /** every bonus awarded this run (game units: points or ms) */
   bonusTotal: number;
   /** the longest chain this run */
   bestChain: number;
   /** events counted this run (the proof's i) */
   events: number;
}

export function createCombo(): ComboState {
   return { chain: 0, multiplier: 1, lastMs: Number.NEGATIVE_INFINITY, bonusTotal: 0, bestChain: 0, events: 0 };
}

export function resetCombo(s: ComboState): void {
   s.chain = 0;
   s.multiplier = 1;
   s.lastMs = Number.NEGATIVE_INFINITY;
   s.bonusTotal = 0;
   s.bestChain = 0;
   s.events = 0;
}

/** Copies one state into another (look-ahead bots copy runs). */
export function copyCombo(src: ComboState, dst: ComboState): void {
   dst.chain = src.chain;
   dst.multiplier = src.multiplier;
   dst.lastMs = src.lastMs;
   dst.bonusTotal = src.bonusTotal;
   dst.bestChain = src.bestChain;
   dst.events = src.events;
}

/** The multiplier at a chain length (1 for chain <= 1), never above cap. */
export function comboMultiplier(chain: number, cfg: ComboConfig): number {
   if (chain <= 1) return 1;
   return Math.min(cfg.cap, 1 + cfg.gain * (chain - 1));
}

/** The bonus one event with this base is worth at this chain length: whole units, rounded down. */
export function comboBonus(base: number, chain: number, cfg: ComboConfig): number {
   return Math.floor(base * (comboMultiplier(chain, cfg) - 1) + 1e-9);
}

/** Ends the chain if its window ran out by `nowMs`. Call each step (cheap) or before reading the meter. */
export function comboTick(s: ComboState, cfg: ComboConfig, nowMs: number): void {
   if (s.chain > 0 && nowMs - s.lastMs > cfg.windowMs) {
      s.chain = 0;
      s.multiplier = 1;
   }
}

/** A hit, a fall, a wrong move: the chain breaks at once (the bonus already paid stays). */
export function comboBreak(s: ComboState): void {
   s.chain = 0;
   s.multiplier = 1;
}

/**
 * One chained action at rules ms `nowMs` with a `base` value (a level pickup's own worth). Returns the
 * bonus it adds (0 for the first link) and adds it to bonusTotal.
 */
export function comboHit(s: ComboState, cfg: ComboConfig, nowMs: number, base: number): number {
   comboTick(s, cfg, nowMs);
   s.chain += 1;
   s.events += 1;
   s.lastMs = nowMs;
   s.multiplier = comboMultiplier(s.chain, cfg);
   if (s.chain > s.bestChain) s.bestChain = s.chain;
   const bonus = comboBonus(base, s.chain, cfg);
   s.bonusTotal += bonus;
   return bonus;
}

/** The meter's fill, 1 just after an event and 0 when the window has run out (or no chain). */
export function comboFlow(s: ComboState, cfg: ComboConfig, nowMs: number): number {
   if (s.chain === 0) return 0;
   const left = cfg.windowMs - (nowMs - s.lastMs);
   return left <= 0 ? 0 : Math.min(1, left / cfg.windowMs);
}

/** What a level can feed the meter: each source is `count` events worth `base` each (orbs, first landings, knock-offs). */
export interface ComboLevelSpec {
   combo: ComboConfig;
   sources: ReadonlyArray<{ count: number; base: number }>;
}

/**
 * The proof helper: the most bonus any run of this level can collect (game units, whole, rounded up).
 * Add it to the maxScore bound (points) or take it off the least duration (time).
 */
export function comboMaxBonus(spec: ComboLevelSpec): number {
   const bases: number[] = [];
   for (const src of spec.sources) {
      if (!(src.count >= 0) || !Number.isFinite(src.count) || !(src.base >= 0) || !Number.isFinite(src.base)) {
         throw new Error(`comboMaxBonus: bad source ${JSON.stringify(src)}`);
      }
      for (let k = 0; k < Math.floor(src.count); k++) bases.push(src.base);
   }
   // the largest bases on the highest multipliers (the last events of one unbroken chain)
   bases.sort((a, b) => a - b);
   let total = 0;
   for (let i = 0; i < bases.length; i++) total += bases[i] * (comboMultiplier(i + 1, spec.combo) - 1);
   return Math.max(0, Math.ceil(total - 1e-9));
}

/** Problems with a config (empty = fine). */
export function comboConfigProblems(cfg: ComboConfig): string[] {
   const out: string[] = [];
   if (!(cfg.windowMs > 0)) out.push("windowMs must be > 0");
   if (!(cfg.gain >= 0)) out.push("gain must be >= 0");
   if (!(cfg.cap >= 1) || !Number.isFinite(cfg.cap)) out.push("cap must be a finite number >= 1");
   return out;
}
