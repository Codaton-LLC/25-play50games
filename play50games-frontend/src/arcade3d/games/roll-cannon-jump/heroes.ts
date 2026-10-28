// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Roll Cannon Jump (the
// card's hero roles, docs/menu2-super/world-1-ember-heights.md "43 Roll Cannon Jump"). Each hero is
// its own GLB (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run
// option: the picker (menu2/heroes HeroPicker) writes it here and the next createRun copies it.
//
// - Riko: an in-flight dash, a horizontal burst of 4 m extra (+8 m/s for 500 ms, once a flight); it
//   smashes cracked target boards, which open a hidden cannon line.
// - Nami: a double jump in flight, a second arc (vy back up to 12 m/s, once a flight): the high
//   trapeze orbs.
// - Kiro: a shield (2.5 s): grey smoke jets do not knock him off his arc.
// - Zuno: a magnet (3 s): orb trails hidden in the tent canvas come out and fly to him from 4 m.
// - Vexa: a phase (1.5 s): she flies through ghost tent poles that block the direct shot.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Air dash", cooldownMs: 5_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 2_000 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 10_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 10_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 9_000 },
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

/** How long each timed power stays up after it fires (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 500, shield: 2500, magnet: 3000, phase: 1500 } as const;

/** Riko's dash: +8 m/s along the flight for 500 ms = exactly 4 m extra (the card), once a flight. */
export const V_DASH = 8;
export const DASH_EXTRA_M = (V_DASH * POWER_MS.dash) / 1000;
/** Nami's second arc: the vertical speed goes back up to this (m/s), once a flight; the horizontal is kept. */
export const NAMI_VY = 12;
/** Zuno's magnet: hidden canvas orbs show and every orb flies in from this far (m). */
export const MAGNET_REACH = 4;

/** World 1's lead (menu2/heroes defaultHeroFor): the rules' own default for bots and proofs. */
export const DEFAULT_HERO: HeroId = "riko";

// The pick is the shared Menu 2 hero pick (menu2/heroes): the player's own last pick in this game,
// else the world's lead (W1 Ember Heights: Riko). The shared module remembers it; this file never
// touches storage.
const pick = createHeroPick("roll-cannon-jump");

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
