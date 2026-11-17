// The five Color Roll Heroes and what each one does in Switch Color Hero (the card: Red Dash, Blue Double
// Jump, Green Shield, Yellow Magnet, Purple Phase). No power ever passes a gate in the wrong colour: the
// gates are the game. Action fires the power:
// - Riko: a dash (+6 m/s for 0.5 s) that smashes an energy block in its lane.
// - Nami: a second jump in the air (the high prism over the gaps).
// - Kiro: a shield (3 s): hazards do not stop him, and a wrong gate costs no heart (it still bounces).
// - Zuno: a magnet (4 s): energy pickups fly to him from 6 m.
// - Vexa: a phase (2 s): she passes blocks, walls, beams and sweepers (the ghost lane shard).
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
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 15_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 10_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 8_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

export const POWER_MS = { dash: 500, shield: 3000, magnet: 4000, phase: 2000 } as const;
export const V_DASH = 6;
export const MAGNET_REACH = 6;

/** The lead hero (menu2/heroes defaultHeroFor): the switch-color-hero pick defaults to Riko. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("switch-color-hero");

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
