// The five Color Roll Heroes and what each one does in Robot Factory Run (the card's hero roles,
// docs/menu2-super/world-1-ember-heights.md "13 Robot Factory Run"). The pick is the shared
// Menu 2 hero pick (menu2/heroes): W1 Ember Heights preselects Riko.
//
// - Riko: a dash (12 m/s for 0.35 s): it flicks a cell beside him one belt over (a one-shot
//   reroute), breaks cracked crates and knocks a jammed turntable free.
// - Nami: a double jump: catwalk switches and the orb ledge.
// - Kiro: a shield (2.5 s): through a laser gate (the short line) and past the hazards.
// - Zuno: a magnet (3 s): a cell within 4 m hops one belt towards him; orbs fly in from 4 m.
// - Vexa: a phase (1.6 s): through ghost crates into the maintenance shortcut.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 5_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 9_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 7_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 8_000 },
];

export function heroById(id: HeroId): HeroDef {
   return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export const POWER_MS = { dash: 350, shield: 2500, magnet: 3000, phase: 1600 } as const;
export const V_DASH = 12;
/** a magnet or a flick moves a cell one belt; this many m away it still reaches */
export const MAGNET_REACH = 4;
export const FLICK_REACH = 1.6;

/** W1's lead (menu2/heroes defaultHeroFor): the rules' own default for bots and proofs. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("robot-factory-run");

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
