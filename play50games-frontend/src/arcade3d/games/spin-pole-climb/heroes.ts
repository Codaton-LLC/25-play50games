// The five Color Roll Heroes and what each one does in Spin Pole Climb (the card's hero roles).
// Each hero is its own GLB (menu2/heroModels.ts). The picked hero is a run option: the picker writes
// it here and the next createRun copies it.
//
// - Riko: a dash round the stair (0.35 s at 11 m/s); it smashes the cracked urn and frees its orb.
// - Nami: a second jump in the air: the orb ledges float 2.3 m over the steps.
// - Kiro: a shield (World 3's lead hero): sweepers, spikes and spore puffs pass through him, and the
//   still spore veil gives him the orb hidden in it.
// - Zuno: a magnet that pulls the orb out of the hollow pole from 6 m.
// - Vexa: a phase that lets her hop onto the ghost pole, whose stair leads to the colour shard.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 8_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 12_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 10_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 10_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each power stays up after it fires (ms). Nami's double jump is instant. */
export const POWER_MS = { dash: 350, shield: 3000, magnet: 3000, phase: 2500 } as const;

/** Riko's dash speed round the stair (m/s), and Zuno's magnet reach (m). */
export const V_DASH = 11;
export const MAGNET_REACH = 6;

/** World 3's lead hero. */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("spin-pole-climb");

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
