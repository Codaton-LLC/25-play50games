// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Wind Tunnel Escape (the
// card's hero roles, docs/menu2-super/world-2-sky-and-sea.md "41 Wind Tunnel Escape"). Each hero is
// its own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The pick is the shared
// Menu 2 hero pick (menu2/heroes): Nami, W2's lead, unless the player picked someone else here.
//
// - Riko: a dash (Action away from a fan) that breaks cracked vent covers, opening a vent that skips ahead.
// - Nami: a second jump in the air, also out of a current mid-ride, up to the high orb shelves.
// - Kiro: a shield: the static-shock vents, the drones and the Gale Engine's blast do not hurt him.
// - Zuno: a magnet: orbs come to him from 7 m, out of currents he did not ride.
// - Vexa: a phase: she slips through ghost fan housings into the maintenance ducts.
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
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Vent dash", cooldownMs: 5_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 9_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 9_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 7_000 },
];

const BY_ID: Record<HeroId, HeroDef> = {
   riko: HEROES[0],
   nami: HEROES[1],
   kiro: HEROES[2],
   zuno: HEROES[3],
   vexa: HEROES[4],
};

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id] ?? HEROES[1];
}

/** How long each power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 300, shield: 3000, magnet: 3000, phase: 1600 } as const;

/** Riko's dash speed (m/s), in the stick's (or the facing) direction; currents do not touch a dash. */
export const V_DASH = 12;

/** Pickup reach while Zuno's magnet is up (m). */
export const MAGNET_REACH = 7;

/** World 2's lead hero: the rules' own default (bots, proofs) and the picker's first choice here. */
export const DEFAULT_HERO: HeroId = "nami";

const pick = createHeroPick("wind-tunnel-escape");

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

/** Tests: forget the cached pick (the next pickedHero() reads the stored pick or the default again). */
export function resetHeroPick(): void {
   pick.reset();
}
