// The five Color Roll Heroes and what each one does in Color Rail Grind (the card's hero roles,
// docs/menu2-super/world-4-frost-and-sweets.md "35 Color Rail Grind"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch.
//
// - Riko: a dash (450 ms): in the air it carries him over the long broken rail gap (a shortcut), and it
//   breaks the wooden barrier of a side spur.
// - Nami: a double jump up onto the high rails (faster, with orbs).
// - Kiro: a shield (3 s, every 20 s): straight through the icicle tunnels.
// - Zuno: a magnet: its grip takes him round the upside-down loop (a boost and a shard), and it pulls
//   the coin trails out of the snowbanks beside the rails.
// - Vexa: a phase through the old tunnel's ghost door to the hidden spur.
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
export const MAGNET_REACH = 5.5;

/** World 4's lead hero is preselected, and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "zuno";

// The shared Menu 2 hero pick: the player's own last pick in this game, else the world's lead
// (W4 "Frost and Sweets": Zuno, menu2/heroes defaultHeroFor). This file never touches storage.
const pick = createHeroPick("color-rail-grind");

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
