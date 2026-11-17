// The five Color Roll Heroes and what each one does in Color Arena Survival (the card: "tune or
// temporarily restrict any ability that would trivialize this level"). No power keeps a wrong tile up
// or counts as a lock-in: they help you reach the colour, not skip it. Each hero is its own GLB
// (menu2/heroModels.ts). World 6 has no lead hero: the default is your last pick anywhere, else Riko
// (menu2/heroes defaultHeroFor).
//
// - Riko: a dash (0.35 s at 11 m/s): the far colour in time.
// - Nami: a second jump in the air: over a hole, a sweeper bar or a shock ring.
// - Kiro: a shield (3 s): a knock (the sweeper, the Keeper's shock ring) passes through him, and a drop
//   under him while it is up bounces him onto the safe marker instead of costing a life.
// - Zuno: a magnet that pulls the colour orbs from 6 m.
// - Vexa: a phase (1.2 s): she walks over holes and dropped tiles as if they were there. She cannot
//   lock in while phased, and when the phase ends over the void she falls.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 6_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 12_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 8_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each power stays up after it fires (ms). Nami's double jump is instant. */
export const POWER_MS = { dash: 350, shield: 3000, magnet: 3000, phase: 1200 } as const;

/** Riko's dash speed (m/s) and Zuno's magnet reach (m). */
export const V_DASH = 11;
export const MAGNET_REACH = 6;

/** World 6 has no lead hero; the shared pick falls back to the last pick anywhere, then Riko. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("color-arena-survival");

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
