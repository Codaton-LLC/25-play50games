import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";

// The shared Menu 2 hero pick for this game (World 4: Zuno leads, defaultHeroFor).
export const HEROES = [
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Overcharge · twice the field, coins through glass" },
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Dash · smash cracked glass, bigger launches" },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Double jump · always on" },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield · spark floors, one hit" },
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Phase · through ghost walls" },
];
const pick = createHeroPick("magnet-coin-lab");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: M2HeroId) => pick.set(id);
