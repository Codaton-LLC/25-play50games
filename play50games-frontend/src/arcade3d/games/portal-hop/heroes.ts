// The five Color Roll Heroes and what each one does in Portal Hop (the card's hero roles). Each hero is
// its own GLB (menu2/heroModels.ts). The picked hero is a run option: the picker writes it here and the
// next createRun copies it.
//
// - Riko: a dash (0.35 s at 11 m/s). Dashing into a portal adds +4 m/s to the speed in, and the dash
//   smashes the cracked void crystals that hold an orb.
// - Nami: a second jump in the air: after an exit it stretches the arc, and it reaches the orbs that
//   float 3.3 m over a landing.
// - Kiro: a shield: the laser cages round some orbs (and the Wyrm's tail, level 5) pass through him.
// - Zuno: a magnet that pulls orbs from 6 m (the ones floating off an island's edge).
// - Vexa (World 5's lead hero): a phase that carries her THROUGH an entry frame without teleporting,
//   onto the ghost route behind it, where her colour shard waits.
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
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 10_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 6_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each power stays up after it fires (ms). Nami's double jump is instant. */
export const POWER_MS = { dash: 350, shield: 3000, magnet: 3000, phase: 1500 } as const;

/** Riko's dash speed (m/s), the speed a dash adds going into a portal, and Zuno's magnet reach (m). */
export const V_DASH = 11;
export const DASH_PORTAL_BONUS = 4;
export const MAGNET_REACH = 6;

/** World 5's lead hero. */
export const DEFAULT_HERO: HeroId = "vexa";

const pick = createHeroPick("portal-hop");

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
