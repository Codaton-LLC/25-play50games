// The five Color Roll Heroes and what each one does in Space Pod Jump (the card's hero roles,
// world-5 "10 Space Pod Jump"). Each hero is its own GLB (menu2/heroModels.ts); the colour is the swatch.
//
// - Riko: her dash is a 0.3 s prograde burn (+2.5 m/s), the way into a high orbit without a pod; it
//   also breaks a cracked satellite panel.
// - Nami: her double jump is a second impulse mid-orbit (up held: straight away from the body; else
//   prograde), to catch what others miss.
// - Kiro: his shield (3 s, every 20 s) crosses the solar flares and the debris.
// - Zuno: his magnet pulls orbs in from 6 m.
// - Vexa: her phase drops her through a planetoid's crust to its far side (a straight chord), and opens
//   the ghost hatches.
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
export const MAGNET_REACH = 6;

/** World 5's lead hero is preselected, and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "vexa";

// The shared Menu 2 hero pick: the player's own last pick in this game, else the world's lead
// (W5 "Neon Cosmos": Vexa, menu2/heroes defaultHeroFor). This file never touches storage.
const pick = createHeroPick("space-pod-jump");

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
