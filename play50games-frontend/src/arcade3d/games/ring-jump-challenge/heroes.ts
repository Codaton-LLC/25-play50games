// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Ring Jump Challenge
// (the card's hero roles, docs/menu2-super/world-2-sky-and-sea.md #27). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch. The pick is the shared Menu 2 pick
// (menu2/heroes): this file never touches storage.
//
// - Riko: an air dash (cooldown 3 s) that crosses 8 m sideways in a quarter second; it shatters the
//   cracked ring seals over the side shafts.
// - Nami: the air-brake flip: the fall stops and she hops 3 m back up, so she can thread a ring she
//   just missed or reach the orb tucked under a wall ledge.
// - Kiro: a shield: storm shear pockets, blade gates and Cyclone Ray's lightning do not touch him.
// - Zuno: a magnet: orbs come from 7 m, and the orb trails hidden in the canyon wall come out.
// - Vexa: a phase: she slips through the ghost panels into the inner shaft lined with bonus rings.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "flip" | "shield" | "magnet" | "phase";

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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Air dash", cooldownMs: 3_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "flip", powerLabel: "Air brake", cooldownMs: 2_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 9_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 6_000 },
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
export const POWER_MS = { dash: 250, flip: 900, shield: 3000, magnet: 3000, phase: 1500 } as const;

/** Riko's air dash: 32 m/s sideways for 250 ms = 8 m (the card). Horizontal only: it never speeds the fall. */
export const V_DASH = 32;

/** Nami's flip: an upward kick that rises 3 m against G_FLIP (the card's "hops her back up 3 m"). */
export const FLIP_RISE = 3;
export const G_FLIP = 30;
export const V_FLIP = Math.sqrt(2 * G_FLIP * FLIP_RISE);

/** Pickup reach while Zuno's magnet is up (m): orbs and the hidden wall trails. */
export const MAGNET_REACH = 7;

/** World 2's lead hero is preselected (menu2/heroes defaultHeroFor) and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "nami";

const pick = createHeroPick("ring-jump-challenge");

/** The hero the next run starts as. The picker sets it; the Scene passes it into createRun when a run starts. */
export function pickedHero(): HeroId {
   return pick.get();
}

/** Calls `fn` whenever the pick changes (on the start card the Scene re-makes its run, so the intro shows the picked hero). */
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
