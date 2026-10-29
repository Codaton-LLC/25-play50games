// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Jungle Vine Jump (the
// card's hero roles, docs/menu2-super/world-3-wild-temples.md "8 Jungle Vine Jump"). Each hero is its
// own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run option:
// the picker (menu2/heroes HeroPicker) writes it here and the next createRun copies it.
//
// Action (E / Enter / the Power button) fires the hero's power when it is ready; every power is a
// bonus, never required:
// - Riko: a dash in the air after a release (+9 m/s along the flight for 350 ms): a second impulse that
//   stretches a short swing to the next vine.
// - Nami: a double jump on Jump in the air (once a flight): up to the high canopy leaf and its emeralds.
// - Kiro: a shield (3 s): fruit pods, snapper bites and the King's swing do not knock him off.
// - Zuno: a magnet (3 s): emeralds and orbs fly to him from 6 m.
// - Vexa: a phase (3 s): she walks through the ghost-root wall into the trunk hollow (the shard).
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   /** the picker swatch */
   color: string;
   power: PowerId;
   /** short label on the picker and the HUD */
   powerLabel: string;
   /** ms before the power can fire again (0 for Nami: a free double jump) */
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 3_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 9_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 9_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 8_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 350, shield: 3000, magnet: 3000, phase: 3000 } as const;
/** Riko's dash: +9 m/s along the flight (horizontal) for 350 ms. */
export const V_DASH = 9;
/** Zuno's magnet: an orb or an emerald flies to him from this far (m). */
export const MAGNET_REACH = 6;

/** World 3's lead (menu2/heroes defaultHeroFor): Kiro, the rules' own default for bots and proofs. */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("jungle-vine-jump");

/** The hero the next run starts as. The picker sets it; Scene passes it into createRun when a run starts. */
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
