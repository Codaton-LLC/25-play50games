// The five Color Roll Heroes and what each one does in Color City Sprint (World 1, the card).
// The picked hero is a run option: menu2/heroes HeroPicker writes it, and the next createRun copies it.
//
// - Riko: a dash that smashes a cracked hoarding, opening a diagonal cut. It does not outrun a red lane.
// - Nami: a second jump. From a bus roof it reaches the elevated rail.
// - Kiro: a shield. Sludge and steam do not slow him.
// - Zuno: a magnet. Drains and fountains give up their gems from 6 m.
// - Vexa: a phase. Ghost shop-fronts let her through the block.
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
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 2_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 15_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 15_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 12_000 },
];

const BY_ID: Record<HeroId, HeroDef> = {
   riko: HEROES[0],
   nami: HEROES[1],
   kiro: HEROES[2],
   zuno: HEROES[3],
   vexa: HEROES[4],
};

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each power stays up (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 420, shield: 2500, magnet: 2500, phase: 1200 } as const;

export const MAGNET_REACH = 6;

/**
 * World 1's lead, the same answer as menu2/heroes defaultHeroFor("color-city-sprint") (Ember Heights
 * is Riko). Bots and the limit proof start here; a player's own last pick overrides it on the start card.
 */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("color-city-sprint");

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
