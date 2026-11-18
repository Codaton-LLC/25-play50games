// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Crystal Cave Switch.
// Each hero is its own GLB (menu2/heroModels.ts); the pick is the shared Menu 2 pick (menu2/heroes).
//
// Action (E / Enter / the Power button) strikes the crystal you stand at; away from a crystal it fires
// the hero power:
// - Riko: a dash (4 m in 0.2 s, on the ground or in the air): beat a sequence timer.
// - Nyla: no button: her second jump in the air reaches the high crystal on its pillar (a sticker).
// - Kiro: a shield (1.5 s): the Hollow Prism's beams pass him by.
// - Zuno: a magnet (3 s): strikes crystals from 4 m instead of 1.6 m.
// - Vexa: a phase (0.6 s): through the ghost walls to the hidden crystal alcoves (World 5's lead).
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "double" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 1_200 },
   { id: "nami", name: "Nyla", color: "#2563EB", power: "double", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 6_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 2_500 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power runs (ms) and Riko's dash speed (m/s). */
export const POWER_MS = { dash: 200, shield: 1500, magnet: 3000, phase: 600 } as const;
export const V_DASH = 20;
/** Striking reach (m): everyone, and Zuno with the magnet up. */
export const ACT_REACH = 1.6;
export const MAGNET_REACH = 4;

/** World 5's lead hero is preselected (menu2/heroes defaultHeroFor) and is the rules' own default. */
export const DEFAULT_HERO: HeroId = "vexa";

const pick = createHeroPick("crystal-cave-switch");

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
