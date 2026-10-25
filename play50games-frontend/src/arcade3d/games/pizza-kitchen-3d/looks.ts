import type { PizzaLevel } from "./levels";
import { stations } from "./rules";
export const COLORS = {
   tile: "#f5f5f4", grout: "#d6d3d1", wood: "#a16207", darkWood: "#713f12", oven: "#292524", steel: "#a8a29e",
   glow: "#f97316", accent: "#ef4444", dough: "#e7b76f", sauce: "#dc2626", cheese: "#facc15", pepperoni: "#b91c1c",
   mushroom: "#d6c3a6", olive: "#3f6212", tomato: "#f43f5e", onion: "#c084fc", green: "#86efac", skin: "#d6a277",
};
export function kitchenWidth(l: PizzaLevel) { return stations(l).length * 1.6 + 0.8; }
export function environment(l: PizzaLevel) { return { background: l.background, lighting: l.lighting, fog: [l.background, 24, 70] as [string, number, number] }; }
