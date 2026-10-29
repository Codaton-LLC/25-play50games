// The five Color Roll Heroes and what each one does in Plate Bounce Arena (the card's hero roles,
// docs/menu2-super/world-4-frost-and-sweets.md "32 Plate Bounce Arena"). The hero IS the pinball: it is
// always curled in ball form. Action fires the hero's power:
// - Riko: a nudge-dash (once per ball): +9 m/s along the stick; it smashes the cracked toy block in
//   front of the skill lane.
// - Nami: a hop, and a double hop in the air: from under the raised deck the double hop lands on it.
// - Kiro: a shield (4 s, once per ball): a drain under the shield bounces back up instead.
// - Zuno: magnet pads: hold Action on a pad to stick there (up to 1.5 s), aim with the stick, let go to
//   fire; while he sticks, the coins under the glass fly to him.
// - Vexa: a phase (3 s): she passes the ghost gate in the left wall into the attic.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "hop" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   /** ms before the power can fire again (0: none, or once per ball) */
   cooldownMs: number;
   /** the power fires once per ball */
   perBall: boolean;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 0, perBall: true },
   { id: "nami", name: "Nami", color: "#2563EB", power: "hop", powerLabel: "Hop", cooldownMs: 0, perBall: false },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 0, perBall: true },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 0, perBall: false },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 9_000, perBall: false },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

export const POWER_MS = { dash: 450, shield: 4000, phase: 3000 } as const;
export const V_DASH = 9;
export const V_HOP = 6;
/** Zuno: the longest stick on a pad, the shot speed, how far the coins fly from */
export const MAGNET_HOLD_MS = 1500;
export const V_MAGNET = 15;
export const MAGNET_PULL = 7;

/** World 4's lead (menu2/heroes defaultHeroFor): Zuno, the rules' own default for bots and proofs. */
export const DEFAULT_HERO: HeroId = "zuno";

const pick = createHeroPick("plate-bounce-arena");

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
