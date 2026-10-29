// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Dragon Cave Rush (the
// card's hero roles, docs/menu2-super/world-1-ember-heights.md "14 Dragon Cave Rush"). Each hero is its
// own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The pick is the shared Menu 2
// hero pick (menu2/heroes): Riko, W1's lead, unless the player picked someone else here.
//
// - Riko: a cart boost (Action) that smashes a cracked barricade onto the shortcut track and gains 20 distance.
// - Nami: a second hop in the air lifts the cart onto the upper scaffold track, which carries orbs.
// - Kiro: a shield that absorbs one breath or lavafall.
// - Zuno: a magnet that pulls the crystal trails off the cave walls as you pass.
// - Vexa: a phase: the purple ghost rails are solid for her, through a rockfall.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "boost" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "boost", powerLabel: "Boost", cooldownMs: 4_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 8_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id] ?? HEROES[0];
}

/** How long each power stays up (ms). The boost is one smash. */
export const POWER_MS = { boost: 600, shield: 3000, magnet: 3000, phase: 2600 } as const;

/** Zuno's magnet reaches the wall trails this far (m). */
export const MAGNET_REACH = 6.5;

/** World 1's lead hero: the rules' own default (bots, proofs) and the picker's first choice here. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("dragon-cave-rush");

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
