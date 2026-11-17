import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";

// The shared Menu 2 hero pick for this game (World 5: Vexa leads, defaultHeroFor).
export const HEROES = [
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Phase · both bodies pass 0.8 s, ghost glass" },
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Dash · breaks cracked blocks on both runways" },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Double jump · copied by the reflection" },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield · covers both bodies 1 s" },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Magnet · orbs from both runways" },
];
const pick = createHeroPick("mirror-dash");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: M2HeroId) => pick.set(id);
