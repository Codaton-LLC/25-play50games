// The five Color Roll Heroes and what each one does in Crystal Tower (World 5, the card). The picked
// hero is a run option: menu2/heroes HeroPicker writes it, and the next createRun copies it.
//
// - Riko: a dash (+6 m/s for 0.4 s, 3 charges a run) that crosses a wide gap and shatters the dark
//   crystal wall in front of a side nook. Its shard is inside.
// - Nyla: a second jump: up to the sky ledge over a pad (the ledge shard and its gems).
// - Kiro: a shield: shard storms, spark drones, the boss's shockwave and a wrong crystal's shove do
//   not knock him (a wrong crystal still resets the sequence).
// - Zuno: a magnet: gems come from 6 m, the hidden gems rise out of the crystal dust, and the NEXT
//   crystal of the sequence (never a wrong one) is picked from 3 m, one crystal per activation.
// - Vexa (lead): a phase: through the void gate of a side nook to its sticker.
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
   { id: "nami", name: "Nyla", color: "#2563EB", power: "doubleJump", powerLabel: "Double jump", cooldownMs: 0 },
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

/** World 5's lead (menu2/heroes defaultHeroFor("crystal-tower") is Vexa); bots and proofs use it too. */
export const DEFAULT_HERO: HeroId = "vexa";

const pick = createHeroPick("crystal-tower");

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
