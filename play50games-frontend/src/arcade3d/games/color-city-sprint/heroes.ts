// The five Color Roll Heroes and what each one does in Color City Sprint (World 1, the card).
// The picked hero is a run option: menu2/heroes HeroPicker writes it, and the next createRun copies it.
//
// - Riko: a dash (V_RED for half a second, never faster than a red lane) that smashes the cracked
//   construction hoarding: the site behind it is a diagonal cut through its block.
// - Nami: a second jump. From a bus roof it reaches the elevated rail, a fast ring road with orbs.
// - Kiro: a shield. Sludge, steam vents and Greyout's drones do not slow or knock him.
// - Zuno: a magnet. Storm drains and fountains give up their hidden coin trails, and orbs come from 6 m.
// - Vexa: a phase. The ghost shop-fronts (purple glow) let her through the block.
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
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 9_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 9_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
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
export const POWER_MS = { dash: 500, shield: 3000, magnet: 4000, phase: 1800 } as const;

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
