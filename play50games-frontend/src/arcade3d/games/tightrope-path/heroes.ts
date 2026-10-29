// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Tightrope Path (the
// card's hero roles, docs/menu2-super/world-3-wild-temples.md "47 Tightrope Path"). Each hero is its
// own GLB (menu2/heroModels.ts); the pick is the shared Menu 2 pick (menu2/heroes).
//
// Action (E / Enter / the Action button) held is the crouch for every hero (half the drift, no
// walking, sandbags and plates pass over); its press also fires the hero power:
// - Riko: on a cracked dash rope, a dash across the whole rope in 0.4 s that ignores the lean.
// - Nami: no button power: Jump in the air is a second jump, up to the high orbs over the gaps.
// - Kiro: a shield (3 s): the needle does not drift, gusts and hits do not move it (the lead hero).
// - Zuno: a magnet (3 s): pulls the coin arcs up out of the river mist within 4 m.
// - Vexa: a phase (6 s): leaving a pillar with a ghost bridge, she walks the invisible planks to the shard.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "double" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Rope dash", cooldownMs: 2_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "double", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 10_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 9_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power runs (ms). */
export const POWER_MS = { dash: 400, shield: 3000, magnet: 3000, phase: 6000 } as const;
/** Zuno's magnet reach along the path (m). */
export const MAGNET_REACH = 4;
/** Riko starts a dash within this far into a dash rope (m). */
export const DASH_START = 1.2;

/** World 3's lead hero is preselected (menu2/heroes defaultHeroFor) and is the rules' own default. */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("tightrope-path");

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
