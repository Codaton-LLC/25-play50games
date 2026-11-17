// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Alien Lane Escape (the
// card's hero roles, docs/menu2-super w5 "17 Alien Lane Escape"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch. The pick is the shared Menu 2 hero pick
// (menu2/heroes): Vexa, World 5's purple lead, unless the player picked someone else here.
//
// - Riko: a dash (x1.6 for 0.75 s): the scanner cannot lock onto her mid-dash, so she can take the orbs
//   in open ground (the speed route with no cover).
// - Nami: a second jump in the air onto the high mesa lane, which the scan cannot see (its orbs, a sticker).
// - Kiro: a shield, a scan-proof bubble for 1.2 s; it also carries him through goo without slowing.
// - Zuno: a magnet that pulls the coin trails out of the goo puddles.
// - Vexa: a phase: she hides inside any crystal (perfect cover, shadow or not) and walks through the
//   ghost-crystal walls into the cave (a shard).
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
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 8_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id] ?? HEROES[0];
}

/** How long each power stays up (ms). */
export const POWER_MS = { dash: 750, shield: 1200, magnet: 3000, phase: 2600 } as const;

/** Riko's dash speeds her up this much. */
export const DASH_X = 1.6;

/** Zuno's magnet reaches this far (m). */
export const MAGNET_REACH = 5;

/** World 5's lead hero (purple): the rules' own default (bots, proofs) and the picker's first choice here. */
export const DEFAULT_HERO: HeroId = "vexa";

const pick = createHeroPick("alien-lane-escape");

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
