// The six Menu 2 worlds and their 50 games (docs/menu2-super/00-framework.md "The six worlds",
// approved 2026-10-27). Plain data, server-safe. A game's slug is its title in kebab case, the same
// slug its games/<slug>/meta.ts uses once it is built.
import type { M2HeroId } from "../heroModels";

export type WorldId = 1 | 2 | 3 | 4 | 5 | 6;

export interface WorldGame {
   /** the game's number in the Menu 2 list of 50 */
   index: number;
   title: string;
   slug: string;
}

export interface World {
   id: WorldId;
   name: string;
   colourName: string;
   /** the world's restored colour */
   colour: string;
   /** a second tone for the map's gradient */
   glow: string;
   /** the lead hero (W6: all five) */
   hero: M2HeroId | null;
   feel: string;
   /** in unlock order */
   games: readonly WorldGame[];
}

export const toSlug = (title: string): string =>
   title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

const g = (index: number, title: string): WorldGame => ({ index, title, slug: toSlug(title) });

export const WORLDS: readonly World[] = [
   {
      id: 1,
      name: "Ember Heights",
      colourName: "Red",
      colour: "#ef4444",
      glow: "#fb923c",
      hero: "riko",
      feel: "Fire, city, factories and mines at full speed.",
      games: [
         g(2, "Rooftop Roll Climb"),
         g(4, "Lava Pillar Jump"),
         g(12, "Mine Tunnel Run"),
         g(13, "Robot Factory Run"),
         g(14, "Dragon Cave Rush"),
         g(15, "Color City Sprint"),
         g(43, "Roll Cannon Jump"),
         g(46, "Color Door Sprint"),
      ],
   },
   {
      id: 2,
      name: "Sky & Sea",
      colourName: "Blue",
      colour: "#3b82f6",
      glow: "#22d3ee",
      hero: "nami",
      feel: "Air, wind, water and height.",
      games: [
         g(1, "Sky Tower Jump"),
         g(3, "Flooded Ruins Escape"),
         g(5, "Cloud Hopper"),
         g(27, "Ring Jump Challenge"),
         g(37, "Plate Surf"),
         g(41, "Wind Tunnel Escape"),
         g(45, "Sky Hook Swing"),
         g(49, "Zipline Rush"),
      ],
   },
   {
      id: 3,
      name: "Wild Temples",
      colourName: "Green",
      colour: "#22c55e",
      glow: "#a3e635",
      hero: "kiro",
      feel: "Jungle, ancient stone ruins, rhythm and balance.",
      games: [
         g(6, "Temple Lantern Jump"),
         g(8, "Jungle Vine Jump"),
         g(16, "Temple Coin Rush"),
         g(31, "Wall Run Temple"),
         g(34, "Spin Pole Climb"),
         g(36, "Temple Gong Timing"),
         g(40, "Disc Target Throw"),
         g(47, "Tightrope Path"),
      ],
   },
   {
      id: 4,
      name: "Frost & Sweets",
      colourName: "Yellow",
      colour: "#facc15",
      glow: "#f9a8d4",
      hero: "zuno",
      feel: "Ice, snow, candy and toys to collect.",
      games: [
         g(9, "Ice Peak Jumper"),
         g(18, "Toy Room Run"),
         g(19, "Candy World Runner"),
         g(20, "Snow Slide Dash"),
         g(23, "Gem Collector 3D"),
         g(32, "Plate Bounce Arena"),
         g(35, "Color Rail Grind"),
         g(42, "Magnet Coin Lab"),
      ],
   },
   {
      id: 5,
      name: "Neon Cosmos",
      colourName: "Purple",
      colour: "#a855f7",
      glow: "#e879f9",
      hero: "vexa",
      feel: "Neon, space, portals, crystals and mind games.",
      games: [
         g(7, "Neon Cube Jump"),
         g(10, "Space Pod Jump"),
         g(17, "Alien Lane Escape"),
         g(24, "Portal Hop"),
         g(28, "Crystal Tower"),
         g(33, "Mirror Dash"),
         g(38, "Laser Maze Run"),
         g(44, "Crystal Cave Switch"),
      ],
   },
   {
      id: 6,
      name: "Prism Fortress",
      colourName: "All colours",
      colour: "#f472b6",
      glow: "#60a5fa",
      hero: null,
      feel: "Shadow Plates' fortress: colour switches, arenas and the finale.",
      games: [
         g(11, "Roll Dash"),
         g(21, "Color Match Jump"),
         g(22, "Switch Color Hero"),
         g(25, "Paint the Platforms"),
         g(26, "Color Arena Survival"),
         g(29, "Energy Core Hunt"),
         g(39, "Color Bridge Builder"),
         g(48, "Color Orb Defense"),
         g(30, "Color Boss Tower"),
         g(50, "Ultimate Color Trial"),
      ],
   },
];

export function worldOfSlug(slug: string): World | undefined {
   return WORLDS.find((w) => w.games.some((game) => game.slug === slug));
}
