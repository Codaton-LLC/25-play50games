// The five Color Roll Heroes and what each one does in Color Orb Defense (the card: Red Dash, Blue Double
// Jump, Green Shield, Yellow Magnet, Purple Phase). Only a zone of the orb's colour ever blocks it: no
// power turns a wrong colour into a block. Action fires the power:
// - Riko: a dash (14 m/s for 0.3 s) to reach a far zone in time.
// - Nami: a second jump in the air (over the drone; the hidden beacon on the pillar).
// - Kiro: a shield over the core (3 s): an orb that reaches the core costs no hit points.
// - Zuno: a magnet (3 s): while he stands on a zone it also blocks matching orbs of the neighbouring lanes
//   within MAGNET_REACH of him.
// - Vexa: a phase (2 s): the drone passes through her and she runs 40 % faster.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 4_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Core shield", cooldownMs: 18_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 10_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 8_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

export const POWER_MS = { dash: 300, shield: 3000, magnet: 3000, phase: 2000 } as const;
export const V_DASH = 14;
export const MAGNET_REACH = 4;

/** The lead hero (menu2/heroes defaultHeroFor; the game is not on the world map yet): Riko. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("color-orb-defense");

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
