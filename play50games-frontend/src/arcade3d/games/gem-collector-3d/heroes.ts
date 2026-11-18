// The five Color Roll Heroes and what each one does in Gem Collector 3D (World 4, the card). The
// picked hero is a run option: menu2/heroes HeroPicker writes it, and the next createRun copies it.
//
// - Riko: a dash (+7 m/s for 0.4 s, 3 charges a run) breaks the cracked crystal wall to the sealed
//   gem pocket, and snaps the train straight behind him (a tight turn is safe while it lasts).
// - Nyla: a second jump up to the high pedestal's gold gem; the train follows through the air.
// - Kiro: a shield: the frost sweepers, the sinking tiles and the slimes cannot cut his tail.
// - Zuno: a magnet: +1.5 m pickup reach, and it pulls the hidden gem trail out of the rim. His
//   train is no longer than anyone's.
// - Vexa: a phase: for 2 s the train passes through itself (no self-cut, tight loops allowed) and she
//   goes through the ghost wall into the back vault.
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
export const POWER_MS = { dash: 400, shield: 3000, magnet: 4000, phase: 2000 } as const;
/** Riko's dash: this much on top of the roll speed, this many per run. */
export const DASH_BOOST = 7;
export const DASH_CHARGES = 3;

/** World 4's lead (menu2/heroes defaultHeroFor("gem-collector-3d") is Zuno); bots and proofs use it too. */
export const DEFAULT_HERO: HeroId = "zuno";

const pick = createHeroPick("gem-collector-3d");

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
