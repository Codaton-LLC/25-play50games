// World 6's hero tag-switch (docs/menu2-super/world-6-prism-fortress.md §2.1). Pure and deterministic,
// stepped in whole milliseconds by the game's own rules (time arguments are rules ms).
//
// - The whole squad is in every level; the player swaps the ACTIVE hero mid-level. The active hero's
//   colour is the player's colour: every W6 colour check reads activeColour(state).
// - A tag takes TAG_SWAP_MS (the burst), keeps position, velocity and airborne state, and gives no
//   invulnerability. A global cooldown (tagCooldownMs) follows every tag.
// - Each hero keeps its own power cooldown; a benched hero recharges benchRecharge x faster.
// - Hand-off: a tag within HANDOFF_MS after the outgoing hero's power ended (or while it is still
//   active) gives the incoming hero +1 combo step; the outgoing effect lingers LINGER_MS.
// - Spectrum: each distinct hero that scores inside one combo window lights a segment; all five lit
//   is a Full Prism. Tags alone never score (the game scores only real actions).
// - Prism Lock: an enemy effect that disables tagging for a while.
// - Fresh legs: a hero tagged in mid-air gets a fresh air action, once per airtime.
// The game owns the hero bodies, the powers' effects and the scoring; this module owns who is active.

export type TagHeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type TagColour = "red" | "blue" | "green" | "yellow" | "purple";

/** The colour-wheel order R -> B -> G -> Y -> P. */
export const TAG_ORDER: readonly TagHeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];
export const TAG_COLOUR: Readonly<Record<TagHeroId, TagColour>> = { riko: "red", nami: "blue", kiro: "green", zuno: "yellow", vexa: "purple" };
export const HERO_OF_COLOUR: Readonly<Record<TagColour, TagHeroId>> = { red: "riko", blue: "nami", green: "kiro", yellow: "zuno", purple: "vexa" };
/** The accessibility glyph of each colour (portraits, claws, plates). */
export const TAG_GLYPH: Readonly<Record<TagColour, "chevron" | "wave" | "hexagon" | "horseshoe" | "spiral">> = {
   red: "chevron",
   blue: "wave",
   green: "hexagon",
   yellow: "horseshoe",
   purple: "spiral",
};

export const TAG_SWAP_MS = 120;
export const HANDOFF_MS = 400;
export const LINGER_MS = 300;
/** The global cooldown after every tag (the default tagCooldownMs). */
export const TAG_COOLDOWN_MS = 500;
/** How much faster a benched hero's power recharges (the default benchRecharge). */
export const BENCH_RECHARGE = 2;

export interface TagOptions {
   /** the heroes in this level (a teaching level may restrict it); always contains the lead */
   roster?: readonly TagHeroId[];
   lead: TagHeroId;
   tagCooldownMs?: number;
   /** how much faster a benched hero's power recharges */
   benchRecharge?: number;
}

export interface TagState {
   roster: TagHeroId[];
   active: TagHeroId;
   /** the hero just tagged out (for the hand-off linger), and when */
   previous: TagHeroId | null;
   lastTagMs: number;
   tagCooldownMs: number;
   benchRecharge: number;
   /** ms each hero's power still has to recharge (the active hero's counts at 1x, benched at benchRecharge x) */
   cooldown: Record<TagHeroId, number>;
   /** when each hero's power effect ends (the game writes it when a power fires) */
   powerUntil: Record<TagHeroId, number>;
   /** tagging is locked until this ms (Prism Lock) */
   lockedUntil: number;
   /** the airtime the last fresh air action was given in (one per airtime) */
   freshAirtime: number;
   /** heroes that scored in the current combo window (the spectrum ring) */
   spectrum: Set<TagHeroId>;
   tags: number;
   handOffs: number;
}

export function createTagState(opts: TagOptions): TagState {
   const roster = (opts.roster ?? TAG_ORDER).filter((h, i, a) => TAG_ORDER.includes(h) && a.indexOf(h) === i);
   if (!roster.includes(opts.lead)) roster.unshift(opts.lead);
   const zero = { riko: 0, nami: 0, kiro: 0, zuno: 0, vexa: 0 };
   return {
      roster: TAG_ORDER.filter((h) => roster.includes(h)),
      active: opts.lead,
      previous: null,
      lastTagMs: -1e9,
      tagCooldownMs: opts.tagCooldownMs ?? TAG_COOLDOWN_MS,
      benchRecharge: opts.benchRecharge ?? BENCH_RECHARGE,
      cooldown: { ...zero },
      powerUntil: { riko: -1, nami: -1, kiro: -1, zuno: -1, vexa: -1 },
      lockedUntil: -1,
      freshAirtime: -1,
      spectrum: new Set(),
      tags: 0,
      handOffs: 0,
   };
}

export function activeColour(s: TagState): TagColour {
   return TAG_COLOUR[s.active];
}

/** The hero after (+1) or before (-1) the active one in the roster's wheel order. */
export function neighbour(s: TagState, dir: 1 | -1): TagHeroId {
   const i = s.roster.indexOf(s.active);
   return s.roster[(i + dir + s.roster.length) % s.roster.length];
}

export type TagResult = { ok: true; handOff: boolean } | { ok: false; reason: "cooldown" | "locked" | "taken" | "same" | "roster" };

/**
 * Swaps the active hero at rules ms `nowMs`. `taken` (co-op): heroes other players own. Returns why not,
 * or whether it was a hand-off.
 */
export function tagTo(s: TagState, to: TagHeroId | "next" | "prev", nowMs: number, taken: readonly TagHeroId[] = []): TagResult {
   if (nowMs < s.lockedUntil) return { ok: false, reason: "locked" };
   if (nowMs - s.lastTagMs < s.tagCooldownMs) return { ok: false, reason: "cooldown" };
   let target: TagHeroId;
   if (to === "next" || to === "prev") {
      const dir = to === "next" ? 1 : -1;
      target = s.active;
      for (let k = 0; k < s.roster.length; k++) {
         target = neighbour({ ...s, active: target }, dir);
         if (!taken.includes(target)) break;
      }
   } else target = to;
   if (!s.roster.includes(target)) return { ok: false, reason: "roster" };
   if (target === s.active) return { ok: false, reason: "same" };
   if (taken.includes(target)) return { ok: false, reason: "taken" };
   const out = s.active;
   const handOff = isHandOff(s, nowMs);
   s.previous = out;
   s.active = target;
   s.lastTagMs = nowMs;
   s.tags += 1;
   if (handOff) s.handOffs += 1;
   return { ok: true, handOff };
}

/** Would a tag now be a hand-off (the active hero's power still on, or ended within HANDOFF_MS)? */
export function isHandOff(s: TagState, nowMs: number): boolean {
   const until = s.powerUntil[s.active];
   return until >= 0 && nowMs <= until + HANDOFF_MS;
}

/** Is the tagged-out hero's effect still lingering (the hand-off relay), for the game's checks? */
export function lingering(s: TagState, hero: TagHeroId, nowMs: number): boolean {
   return s.previous === hero && nowMs - s.lastTagMs <= LINGER_MS && s.powerUntil[hero] >= s.lastTagMs - HANDOFF_MS;
}

/** One ms of cooldowns: the active hero at 1x, the bench at benchRecharge x. */
export function stepTagMs(s: TagState): void {
   for (const h of s.roster) {
      if (s.cooldown[h] <= 0) continue;
      s.cooldown[h] = Math.max(0, s.cooldown[h] - (h === s.active ? 1 : s.benchRecharge));
   }
}

/** The game fires the active hero's power: its cooldown starts, its effect lasts `durationMs`. */
export function usePowerTag(s: TagState, nowMs: number, durationMs: number, cooldownMs: number): boolean {
   const h = s.active;
   if (s.cooldown[h] > 0) return false;
   s.cooldown[h] = cooldownMs;
   s.powerUntil[h] = nowMs + durationMs;
   return true;
}

export function prismLock(s: TagState, nowMs: number, durationMs: number): void {
   s.lockedUntil = Math.max(s.lockedUntil, nowMs + durationMs);
}

export function isLocked(s: TagState, nowMs: number): boolean {
   return nowMs < s.lockedUntil;
}

/** Is the swap burst still playing (the visuals' curl)? */
export function swapping(s: TagState, nowMs: number): boolean {
   return nowMs - s.lastTagMs < TAG_SWAP_MS;
}

/**
 * Fresh legs: a hero tagged in mid-air may take one fresh air action per airtime. `airtime` is the
 * game's counter of take-offs (it changes each time the hero leaves the ground). Returns true once.
 */
export function freshLegs(s: TagState, airtime: number, taggedInAirtime: boolean): boolean {
   if (!taggedInAirtime || s.freshAirtime === airtime) return false;
   s.freshAirtime = airtime;
   return true;
}

/** A hero scored inside the combo window (the spectrum ring); `windowOpen` false resets the ring first. */
export function noteSpectrum(s: TagState, hero: TagHeroId, windowOpen: boolean): number {
   if (!windowOpen) s.spectrum.clear();
   s.spectrum.add(hero);
   return s.spectrum.size;
}

export function fullPrism(s: TagState): boolean {
   return s.spectrum.size >= 5;
}
