// The five Color Roll Heroes (CLAUDE.md decision 5). Each hero is its own GLB (menu2/heroModels.ts);
// the colour here is only the picker swatch. Powers and cooldowns are the plan's table (powers.ts).
// The picked hero is a run option: the picker (menu2/heroes HeroPicker) writes it here and the next
// createRun copies it.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";
import { MAGNET_REACH, POWER_MS, V_DASH } from "./powers";

export { MAGNET_REACH, POWER_MS, V_DASH };
export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   /** shell plates, armour, glowing lines */
   color: string;
   power: PowerId;
   /** short label on the picker and the HUD */
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", cooldownMs: 15_000 },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", cooldownMs: 10_000 },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", cooldownMs: 20_000 },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", cooldownMs: 20_000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", cooldownMs: 20_000 },
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

// The pick is the shared Menu 2 hero pick (menu2/heroes): it starts as the player's own last pick in
// this game, else the world's lead hero (Lava Pillar Jump is in W1 Ember Heights: Riko). The shared
// module remembers it; this file never touches storage.
const pick = createHeroPick("lava-pillar-jump");

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
