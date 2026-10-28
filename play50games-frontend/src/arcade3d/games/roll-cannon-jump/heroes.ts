// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Roll Cannon Jump (the
// card's hero roles, .handoff/K-m2-cannon/world-1-cards.md "43"). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run option: the
// picker (menu2/heroes HeroPicker) writes it here and the next createRun copies it.
//
// - Riko: an in-flight dash: a horizontal burst of 4 m extra (8 m/s for 500 ms, over the speed cap);
//   it smashes cracked target boards that open a hidden cannon line.
// - Nami: a double jump in flight: a second arc at 14 m/s, reaching the high trapeze cannons' orbs.
// - Kiro: a shield: grey smoke jets (from L3) do not knock him off his arc.
// - Zuno: a magnet: pulls orb trails out of the tent canvas along the arc, from 4 m.
// - Vexa: a phase: she flies through ghost tent poles that block the direct shot.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Air dash", cooldownMs: 8_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 2_500 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 15_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 15_000 },
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

/** How long each power stays up after it fires (ms). The cooldown is heroById().cooldownMs and starts as it fires. */
export const POWER_MS = { dash: 500, shield: 2500, magnet: 2500, phase: 1500 } as const;

/** Riko's in-flight dash: 8 m/s for 500 ms = 4 m extra (the card), above the flight speed cap. */
export const V_DASH = 8;
/** Nami's second arc: 14 m/s at 60 degrees, once a flight (well under the launch speed bound). */
export const NAMI_JUMP_V = 14;
export const NAMI_JUMP_PITCH = 60;

/** Pickup reach while Zuno's magnet is up (m): orbs and the hidden canvas trails. */
export const MAGNET_REACH = 4;

/** World 1's lead hero is preselected (the coordinator's rule: each Menu 2 game starts on its world's lead). */
export const DEFAULT_HERO: HeroId = "riko";

// The pick is the shared Menu 2 hero pick (menu2/heroes): it starts as the player's own last pick in
// this game, else the world's lead hero (Roll Cannon Jump is in W1 "Ember Heights": Riko, the same as
// DEFAULT_HERO, the rules' own default for bots and proofs). The shared module remembers it; this
// file never touches storage.
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
