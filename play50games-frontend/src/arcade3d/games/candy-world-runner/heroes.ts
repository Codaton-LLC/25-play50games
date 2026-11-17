// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Candy World Runner (the
// card's hero roles, docs/menu2-super/world-4-frost-and-sweets.md "19 Candy World Runner"). Each hero is its
// own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The pick is the shared Menu 2
// hero pick (menu2/heroes): Zuno, W4's lead, unless the player picked someone else here.
//
// - Riko: a dash; at Big it is a sugar charge that breaks the reinforced gingerbread walls into a bonus lane.
// - Nami: a second jump in the air onto the candy-cane rail above the lanes (fewer coins: a Small run).
// - Kiro: a shield that crosses the popping-candy fields (crackling ground that knocks you down a size).
// - Zuno: a magnet he switches on and off (he chooses when to grow): it pulls the coin trails out of the
//   frosting walls and the candy coins round him.
// - Vexa: a phase through the ghost gingerbread walls into a hidden fourth lane.
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
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 8_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 1_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id] ?? HEROES[0];
}

/** How long each power stays up (ms). The dash is one push (and a smash). */
export const POWER_MS = { dash: 600, shield: 3000, magnet: 4000, phase: 2600 } as const;

/** Zuno's magnet reaches this far (m). */
export const MAGNET_REACH = 4.5;

/** World 4's lead hero: the rules' own default (bots, proofs) and the picker's first choice here. */
export const DEFAULT_HERO: HeroId = "zuno";

const pick = createHeroPick("candy-world-runner");

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
