import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";

// The shared Menu 2 hero pick (World 6: all colours, no lead; defaultHeroFor keeps the player's last
// pick). The pick is the hero you start as: Tag swaps to any of the five during the run.
export const HEROES = [
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Dash · 3 cells, smash cracked rock · walks red" },
   { id: "nami" as const, name: "Nyla", color: "#3b82f6", powerLabel: "Leap · 2 cells · walks blue" },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Magnet · pull a prism · walks yellow" },
   { id: "vexa" as const, name: "Vexa", color: "#a855f7", powerLabel: "Phase · any light 1.5 s · walks purple" },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield · blocks a beam · walks green" },
];
const pick = createHeroPick("color-bridge-builder");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: M2HeroId) => pick.set(id);
