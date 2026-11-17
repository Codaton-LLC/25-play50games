// The five Color Roll Heroes in Roll Dash: World 6, so the whole squad rolls together and the player
// TAGS the active hero mid-run (the W6 card's `heroTag`: the active hero's colour is your colour). The
// picker chooses the LEAD (the hero who starts); the rest follow in colour-wheel order. Powers use the
// W6 tag tuning (shorter cooldowns; a benched hero recharges twice as fast):
// - Riko: dash (0.3 s, +8 m/s): breaks a red cracked barricade.
// - Nami: double jump: clears a blue 3 m barrier; her high orb lines over it.
// - Kiro: shield (1.5 s): passes a green drain spray / tesla arc.
// - Zuno: magnet (3 s, 6 m): rips the coin trail out of a yellow vault and opens it.
// - Vexa: phase (0.8 s): through a purple ghost wall.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";

export type HeroId = "riko" | "nami" | "kiro" | "zuno" | "vexa";
export type PowerId = "dash" | "doubleJump" | "shield" | "magnet" | "phase";

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   power: PowerId;
   powerLabel: string;
   /** W6 tag tuning: how long the power lasts, and its cooldown while the hero is active (ms) */
   durationMs: number;
   cooldownMs: number;
   /** the World 6 glyph (colour-blind readable): chevron, wave, hexagon, horseshoe, spiral */
   glyph: "chevron" | "wave" | "hexagon" | "horseshoe" | "spiral";
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", power: "dash", powerLabel: "Dash", durationMs: 300, cooldownMs: 3_000, glyph: "chevron" },
   { id: "nami", name: "Nami", color: "#2563EB", power: "doubleJump", powerLabel: "Double", durationMs: 0, cooldownMs: 0, glyph: "wave" },
   { id: "kiro", name: "Kiro", color: "#22C55E", power: "shield", powerLabel: "Shield", durationMs: 1_500, cooldownMs: 5_000, glyph: "hexagon" },
   { id: "zuno", name: "Zuno", color: "#FACC15", power: "magnet", powerLabel: "Magnet", durationMs: 3_000, cooldownMs: 7_000, glyph: "horseshoe" },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", power: "phase", powerLabel: "Phase", durationMs: 800, cooldownMs: 5_000, glyph: "spiral" },
];

export const HERO_IDS: readonly HeroId[] = HEROES.map((h) => h.id);

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

/** Riko's dash adds this forward speed; Zuno's magnet reaches this far. */
export const DASH_BOOST = 8;
export const MAGNET_REACH = 6;

/** The default lead (World 6 has all colours; the shared pick decides). */
export const DEFAULT_HERO: HeroId = "riko";

const pick = createHeroPick("roll-dash");

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
