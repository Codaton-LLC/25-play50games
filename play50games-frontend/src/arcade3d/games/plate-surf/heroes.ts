// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Plate Surf (the card's
// hero roles, docs/menu2-super/world-2-sky-and-sea.md "37 Plate Surf"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run option: the
// picker (menu2/heroes HeroPicker) writes it and the next createRun copies it.
//
// - Riko: a dash carve (a 450 ms burst, never past the top speed) that cracks the reef walls into
//   the hidden lagoon lanes.
// - Nami: a double air off the lip: she reaches the high spray ledges (orb rows by the cliff arches).
// - Kiro: a shield: the violet storm spray, jellies, diving gulls and bubble mines cannot knock him.
// - Zuno: a magnet: orbs come from 6 m, and the hidden orb trails in the trough foam show.
// - Vexa: a phase: she slips through the ghost rock arches into the calm inner lane.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleAir" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   /** the picker swatch */
   color: string;
   power: PowerId;
   /** short label on the picker and the HUD */
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash carve", cooldownMs: 6_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleAir", powerLabel: "Double air", cooldownMs: 1_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 12_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 12_000 },
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

/** How long each power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 450, shield: 3000, magnet: 4000, phase: 2000 } as const;

/** Riko's dash carve: this much speed (m/s, capped at the top speed) and a sideways push along the stick. */
export const DASH = { boost: 4, push: 8 } as const;

/** Pickup reach while Zuno's magnet is up (m): orbs and the hidden foam trails. */
export const MAGNET_REACH = 6;

/** World 2's lead hero is preselected, and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "nami";

// The pick is the shared Menu 2 hero pick (menu2/heroes): the player's own last pick in this game,
// else the world's lead (W2 "Sky & Sea": Nami). The shared module remembers it; this file never
// touches storage.
const pick = createHeroPick("plate-surf");

/** The hero the next run starts as. The picker sets it; Scene passes it into createRun. */
export function pickedHero(): HeroId {
   return pick.get();
}

export function subscribeHero(fn: () => void): () => void {
   return pick.subscribe(fn);
}

export function selectHero(id: HeroId): void {
   pick.set(id);
}

/** Tests: forget the cached pick. */
export function resetHeroPick(): void {
   pick.reset();
}
