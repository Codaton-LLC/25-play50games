// The five Color Roll Heroes (CLAUDE.md decision 5) and what each one does in Cloud Hopper (the
// card's hero roles, docs/menu2-super/world-2-sky-and-sea.md). Each hero is its own GLB
// (menu2/heroModels.ts); the colour here is the picker swatch. The picked hero is a run option: the
// overlay writes it here and the next createRun copies it. Not localStorage.
//
// - Riko: an air dash (one per flight) that spends 1 s of glide for a 6 m burst; it breaks storm-cloud walls.
// - Nami: a second jump in the air, refreshed once per glide: hopping out of a glide re-launches it.
// - Kiro: a shield: thunderheads, rim strikes and hail do not drop him.
// - Zuno: a magnet: feathers and orbs come from 6 m, and hidden orb trails in the rain columns show.
// - Vexa: a phase: she slips through ghost-cloud walls into the night path (and past hazards).
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

/** Riko's air dash: 12 m/s for 500 ms (6 m), costing this much glide (ms). Wind does not touch a dash. */
export const V_DASH = 12;
export const DASH_GLIDE_MS = 1000;

/** Pickup reach while Zuno's magnet is up (m): orbs, feathers and the hidden trails. */
export const MAGNET_REACH = 6;

/** World 2's lead hero is preselected (the coordinator's rule: each Menu 2 game starts on its world's lead). */
export const DEFAULT_HERO: HeroId = "nami";

let picked: HeroId = DEFAULT_HERO;

/** The hero the next run starts as. The overlay sets it; Scene passes it into createRun. */
export function pickedHero(): HeroId {
   return picked;
}

const listeners = new Set<() => void>();

/** Calls `fn` whenever the pick changes (the Scene re-makes its run, so the intro shows the picked hero). */
export function subscribeHero(fn: () => void): () => void {
   listeners.add(fn);
   return () => {
      listeners.delete(fn);
   };
}

export function selectHero(id: HeroId): void {
   if (picked === id) return;
   picked = id;
   for (const fn of listeners) fn();
}
