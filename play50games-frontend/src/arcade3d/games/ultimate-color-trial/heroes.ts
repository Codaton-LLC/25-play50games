// The five Color Roll Heroes and what each one does in Ultimate Color Trial (World 6, the finale: no
// lead hero, the player's last pick). The picked hero is a run option: menu2/heroes HeroPicker writes
// it, and the next createRun copies it.
//
// - Riko: a dash (+6 m/s for 0.4 s, 3 charges a run) that crosses the widest pad gaps and shatters
//   the crystal wall of a side nook. His shard is inside.
// - Nami: a second jump: up to the sky ledge over the corridor (her shard and two gems).
// - Kiro: a shield: laser beams, rolling orbs and the Sentinel's sweeps do not knock him (he keeps
//   the energy core he carries).
// - Zuno: a magnet: gems from 6 m, the hidden gems rise out of the floor light, and the energy core
//   flies to him from 5 m.
// - Vexa: a phase: through the void gate of a side nook to her sticker.
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
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 2_500 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 8_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 8_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 6_000 },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** How long each power stays up (ms). The cooldown starts as it fires. */
export const POWER_MS = { dash: 400, shield: 3000, magnet: 4000, phase: 1800 } as const;
/** Riko's dash: this much on top of the run speed, and this many per run (the proof counts them). */
export const DASH_BOOST = 6;
export const DASH_CHARGES = 3;

/** World 6 has no lead: menu2/heroes defaultHeroFor falls back to the last pick, else Riko; bots and proofs use Riko. */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("ultimate-color-trial");

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
