// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Laser Maze Run (the
// card's GAME 38: "Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain
// available"). Each hero is its own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The
// pick is the shared Menu 2 hero pick (menu2/heroes): Vexa, World 5's purple lead, unless the player
// picked someone else here.
//
// - Riko: a dash (x1.6 for 0.6 s) through a pulse alley's short off window (its orbs).
// - Nyla: a second jump in the air clears the tall beams (and takes the high orbs over them).
// - Kiro: a shield that soaks one laser touch for 1.2 s, and carries him across the live floor tiles.
// - Zuno: a magnet that pulls the orbs out of the laser cages (3 s).
// - Vexa: a phase: she passes through laser beams and walls for 2.6 s (the cage shard).
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
   { id: "nami", name: "Nyla", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 8_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id] ?? HEROES[0];
}

/** How long each power stays up (ms). */
export const POWER_MS = { dash: 600, shield: 1200, magnet: 3000, phase: 2600 } as const;

/** Riko's dash speeds her up this much. */
export const DASH_X = 1.6;

/** Zuno's magnet reaches this far (m). */
export const MAGNET_REACH = 5;

/** World 5's lead hero (purple): the rules' own default (bots, proofs) and the picker's first choice here. */
export const DEFAULT_HERO: HeroId = "vexa";

const pick = createHeroPick("laser-maze-run");

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
