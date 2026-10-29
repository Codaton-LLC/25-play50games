// The five Color Roll Heroes and what each one does in Color Door Sprint (the card's hero roles,
// docs/menu2-super/world-1-ember-heights.md "46 Color Door Sprint"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch.
//
// - Riko: a dash (450 ms burst, never past the top speed) that smashes a cracked fake door into the
//   hidden side corridor (3 orbs, it skips the next 2 walls).
// - Nami: a double jump: over the floor bars' high orb arcs, and from level 3 into the upper door row
//   over the tall walls (a bonus orb lane).
// - Kiro: a shield (3 s, every 20 s): it absorbs one wrong door (no bounce), the floor bars, the low
//   beams and the flame vents.
// - Zuno: a magnet: the orb trails hidden in the corridor walls come out and fly to him.
// - Vexa: a phase: she passes through a ghost door (always right, a faint shimmer) to a colour shard.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   /** the picker swatch */
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 6_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 1_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 20_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 12_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 10_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** The hero's own door colour (DOOR_COLORS index): the co-op "Door Roulette" rule. */
export const HERO_COLOR_INDEX: Record<HeroId, number> = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 };

/** How long each power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 450, shield: 3000, magnet: 4000, phase: 2000 } as const;

/** Pickup reach while Zuno's magnet is up (m). */
export const MAGNET_REACH = 5;

/** World 1's lead hero is preselected, and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "riko";

// The shared Menu 2 hero pick: the player's own last pick in this game, else the world's lead
// (W1 "Ember Heights": Riko, menu2/heroes defaultHeroFor). This file never touches storage.
const pick = createHeroPick("color-door-sprint");

export function pickedHero(): HeroId {
   return pick.get();
}

export function subscribeHero(fn: () => void): () => void {
   return pick.subscribe(fn);
}

export function selectHero(id: HeroId): void {
   pick.set(id);
}

export function resetHeroPick(): void {
   pick.reset();
}
