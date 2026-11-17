// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Paint the Platforms. Each
// hero is its own GLB (menu2/heroModels.ts); the pick is the shared Menu 2 pick (menu2/heroes). World 6
// (Prism Fortress) has no lead hero: the start card preselects the player's last pick, else Riko.
//
// Every hero paints in its own colour. Action (E / Enter / the Power button) fires the hero power; next
// to the Paint Blob while its core is open it splats the Blob instead.
// - Riko: a dash (4 m in 0.2 s, on the ground or in the air): a fast streak of paint.
// - Nami: no button: her second jump in the air reaches the gold blob on the high pillar (a sticker).
// - Kiro: a shield (1.5 s): a grey blot he touches freezes for 3 s, the roller stops on him, the
//   Blob's slam passes him.
// - Zuno: a magnet (3 s): paint blobs come to him from 5 m.
// - Vexa: a phase (0.8 s): through the ghost panels of the glass cage (a shard) and through the blots.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "double" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 1_200 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "double", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 5_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 2_500 },
];

export const HERO_IDS: readonly HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each timed power runs (ms) and Riko's dash speed (m/s). */
export const POWER_MS = { dash: 200, shield: 1500, magnet: 3000, phase: 800 } as const;
export const V_DASH = 20;
/** Zuno's magnet reach for paint blobs (m); a blot Kiro's shield touches freezes this long (ms). */
export const MAGNET_REACH = 5;
export const FREEZE_MS = 3000;

/** The rules' own default (World 6 has no lead: menu2/heroes defaultHeroFor falls back to Riko). */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("paint-the-platforms");

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
