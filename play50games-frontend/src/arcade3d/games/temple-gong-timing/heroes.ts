// The five Color Roll Heroes and what each one does in Temple Gong Timing (the card's hero roles). In a
// rhythm game every hand is busy with the beat, so the powers here are perks that work by themselves:
//
// - Riko: his roll is a dash (14 m/s, the others 9): he crosses the stage in a beat or two, so he alone
//   makes the cross-stage bonus notes (worth double).
// - Nami: a second jump in the air: the high gongs on the lantern pillars are struck from up there.
// - Kiro: his shield (World 3's lead hero perk) absorbs one shockwave, or saves the combo from one miss;
//   it recharges in 20 s.
// - Zuno: his magnet pulls the echo orbs (the green orbs a Perfect throws out) from 4 m.
// - Vexa: she phases into the ghost gong, an invisible gong whose three-note chord holds the shard.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash roll" },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double" },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield" },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet" },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase" },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** Rolling speed round the stage (m/s), Riko's dash roll, Kiro's shield recharge, Zuno's magnet reach. */
export const V_ROLL = 9;
export const V_DASH = 14;
export const SHIELD_MS = 20_000;
export const MAGNET_REACH = 4;

export const speedOf = (id: HeroId): number => (id === "riko" ? V_DASH : V_ROLL);

/** World 3's lead hero. */
export const DEFAULT_HERO: HeroId = "kiro";

const pick = createHeroPick("temple-gong-timing");

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
