// The five Color Roll Heroes and what each one does in Temple Coin Rush (the card's hero roles,
// docs/menu2-super/world-3-wild-temples.md "16 Temple Coin Rush"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch.
//
// - Riko: a dash (450 ms burst, never past the top speed) that breaks a cracked side wall at a gate: a
//   free toll into the fast lane (it skips the gate without paying).
// - Nami: a double jump onto the ledge coin arcs high over the slow lanes.
// - Kiro: a shield (3 s, every 20 s): straight through the fire-jet pillars (he keeps his coin line),
//   and it takes a stumble's knock (blocks, beams, spikes, side boulders, the serpent's coils).
// - Zuno: a magnet: the hidden coin veins come out of the walls (+8 to +10 coins a vein).
// - Vexa: a phase: through the ghost gate, a hidden toll-free passage to coins and a shard.
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

/** How long each power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 450, shield: 3000, magnet: 4000, phase: 2000 } as const;

/** Pickup reach while Zuno's magnet is up (m). */
export const MAGNET_REACH = 5;

/** World 3's lead hero is preselected, and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "kiro";

// The shared Menu 2 hero pick: the player's own last pick in this game, else the world's lead
// (W3 "Wild Temples": Kiro, menu2/heroes defaultHeroFor). This file never touches storage.
const pick = createHeroPick("temple-coin-rush");

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
