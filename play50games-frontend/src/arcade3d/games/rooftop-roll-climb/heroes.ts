// The five Color Roll Heroes (CLAUDE.md decision 5). One mesh (Riko); the other colours are a
// material tint. Powers and cooldowns are the plan's table. The picked hero is a run option: the
// overlay writes it here and the next createRun copies it. Not localStorage.
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

/** How long each power stays up after it fires (ms). The cooldown is heroById().cooldownMs and starts as it fires. */
export const POWER_MS = { dash: 280, shield: 2500, magnet: 2500, phase: 1200 } as const;

/** Dash speed (m/s). Above V_RUN; the height bound does not use it (a dash is horizontal). */
export const V_DASH = 12.5;

/** Orb pickup radius while Zuno's magnet is up (m). */
export const MAGNET_REACH = 4.2;

let picked: HeroId = "riko";

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
