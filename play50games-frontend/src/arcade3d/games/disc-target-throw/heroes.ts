// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Disc Target Throw (the
// card's hero roles, docs/menu2-super/world-3-wild-temples.md "40 Disc Target Throw"). Each hero is its
// own GLB (menu2/heroModels.ts); the colour here is the picker swatch and the disc's trail. The pick is
// the shared Menu 2 pick (menu2/heroes): this file never touches storage.
//
// Power (E / Enter / the Power button):
// - Riko: a dash (+12 m/s for 0.35 s) that also stretches the catch reach by 4 m while it runs.
// - Nami: a lob: the next throw flies high over the palisade (and over the hay: it reaches what stands
//   behind the wood).
// - Kiro: a shield (3 s): the thorn bursts over the best throwing spot and Mother Snapper's thorn
//   volleys do not touch him (World 3's lead hero).
// - Zuno: a magnet (3 s): a returning disc is pulled into his hand from 3 m, always a clean catch.
// - Vexa: a phase: the next throw passes the ghost walls, the way into the shrine that holds the shard.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "lob" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   /** the picker swatch and the disc's trail ribbon */
   color: string;
   power: PowerId;
   /** short label on the picker and the HUD */
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 3_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "lob", powerLabel: "Lob throw", cooldownMs: 4_000 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 10_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase throw", cooldownMs: 6_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power stays up (ms). The lob and the phase arm the next throw instead. */
export const POWER_MS = { dash: 350, shield: 3000, magnet: 3000 } as const;
/** Riko's dash speed (m/s) and the extra catch reach while it runs (m). */
export const V_DASH = 12;
export const DASH_REACH = 4;
/** Zuno's magnet: a returning disc this close is pulled in (m). */
export const MAGNET_REACH = 3;

/** World 3's lead hero is preselected (menu2/heroes defaultHeroFor) and is the rules' own default (bots, proofs). */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("disc-target-throw");

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
