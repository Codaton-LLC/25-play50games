// The five Color Roll Heroes and what each one does in Sky Hook Swing (the card's hero roles).
// Each hero is its own GLB (menu2/heroModels.ts). The picked hero is a run option: the picker writes
// it here and the next createRun copies it.
//
// - Riko: a dash out of a release, 6 m straight. It smashes cracked crate stacks on the docks.
// - Nami: a double jump after a release, the height for the high anchor ledges.
// - Kiro: a shield. Cannon smoke and cable sparks do not knock him off the rope.
// - Zuno: a magnet. Orb strings under the arc come in from 6 m.
// - Vexa: a phase. Ghost hull panels let her onto the inner deck.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 8_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 2_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 12_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 12_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 10_000 },
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

/** How long each power stays up after it fires (ms). Nami's double jump is instant. */
export const POWER_MS = { dash: 400, shield: 2500, magnet: 2500, phase: 1600 } as const;

/** Riko's dash: 15 m/s for 400 ms (6 m), under the free-flight speed cap. */
export const V_DASH = 15;

/** Zuno's magnet reach (m). */
export const MAGNET_REACH = 6;

/** World 2's lead hero. */
export const DEFAULT_HERO: HeroId = "nami";

const pick = createHeroPick("sky-hook-swing");

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
