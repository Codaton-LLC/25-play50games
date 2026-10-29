// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Wall Run Temple (the
// card's hero roles, docs/menu2-super/world-3-wild-temples.md "6 Wall Run Temple"). Each hero is its
// own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run option:
// the picker (menu2/heroes HeroPicker) writes it here and the next createRun copies it.
//
// Action on a wall rolls the hero into ball form (spike panels pass over); in the air or on a pad it
// fires the hero's power, if it is ready.
// - Riko: a dash (12 m/s for 500 ms): it smashes the cracked stone panels into their orb alcoves.
// - Nami: a double jump on Jump in the air: at the end of a run it reaches the upper wall tier.
// - Kiro: a shield (3 s, 20 s cooldown: the world's rule): the dart vents and the rams do not hurt him.
// - Zuno: a magnet (3 s): the gold ring orbs in the cliff face fly to him from 6 m.
// - Vexa: a phase (3 s): she walks through a ghost wall into the hidden room with the shard.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 4_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 20_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 10_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 9_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 500, shield: 3000, magnet: 3000, phase: 3000 } as const;
/** Riko's dash: +12 m/s along the stick for 500 ms. */
export const V_DASH = 12;
/** Zuno's magnet: an orb flies to him from this far (m); a spark from SPARK_REACH. */
export const MAGNET_REACH = 6;

/** World 3's lead (menu2/heroes defaultHeroFor): Kiro, the rules' own default for bots and proofs. */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("wall-run-temple");

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
