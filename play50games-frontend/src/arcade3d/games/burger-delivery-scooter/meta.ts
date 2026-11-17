import type { ArcadeGameMeta, LevelMeta, ScoringRules } from "../../types";

// Plain data. The numbers are proven in README "Server limits and why they hold" (levels.test.ts recomputes
// each level's bound, limits.levels-*.test.ts runs the bots), and arcade-games.json carries the same five.
// A level clears only on a win (every order delivered, average quality at the line).
const PTS = { kind: "points", unitLabel: "pts", display: "int" } as const;

export const LIMITS: readonly ScoringRules[] = [
   { ...PTS, maxScore: 810, minDurationMs: 4000, maxDurationMs: 120_000, base: 420, maxPointsPerSec: 15 },
   { ...PTS, maxScore: 1000, minDurationMs: 4000, maxDurationMs: 150_000, base: 560, maxPointsPerSec: 10 },
   { ...PTS, maxScore: 1230, minDurationMs: 4000, maxDurationMs: 180_000, base: 700, maxPointsPerSec: 10 },
   { ...PTS, maxScore: 1270, minDurationMs: 4000, maxDurationMs: 180_000, base: 840, maxPointsPerSec: 6 },
   { ...PTS, maxScore: 1580, minDurationMs: 4000, maxDurationMs: 210_000, base: 1120, maxPointsPerSec: 5 },
];

const LEVELS: readonly LevelMeta[] = [
   { id: 1, title: "Neighborhood", scoring: LIMITS[0] },
   { id: 2, title: "City Center", scoring: LIMITS[1] },
   { id: 3, title: "Park District", scoring: LIMITS[2] },
   { id: 4, title: "Rainy City", scoring: LIMITS[3] },
   { id: 5, title: "Night Delivery", scoring: LIMITS[4] },
];

export const burgerDeliveryScooterMeta: ArcadeGameMeta = {
   slug: "burger-delivery-scooter",
   title: "Burger Delivery Scooter",
   tagline: "Fresh burgers. Smooth corners. Happy doors.",
   description: "Load an order at the burger shop, ride the scooter through town, hop the barriers and stop at the glowing door before the burger goes cold.",
   order: 33,
   status: "dev",
   collection: "skill",
   difficulty: 2,
   orientation: "any",
   controls: {
      scheme: "steer",
      keyboard: "W / Up accelerate, S / Down brake or reverse, A / D steer, Space hop",
      touch: "Joystick to accelerate, brake and steer. Hop clears barriers.",
   },
   howTo: {
      keys: [
         { id: "gas", keys: ["W", "Up"], label: "Accelerate", main: true, role: "move" },
         { id: "brake", keys: ["S", "Down"], label: "Brake / reverse", role: "move" },
         { id: "steer", keys: ["A/D", "Left/Right"], label: "Steer", role: "move" },
         { id: "hop", keys: ["Space"], label: "Hop", main: true },
      ],
      touch: [
         { id: "joystick", control: "joystick", label: "Drive & steer" },
         { id: "hop", control: "jump", label: "Hop" },
      ],
      steps: [
         { title: "Goal", text: "Pick up burgers at the shop and deliver them hot to the green door rings." },
         {
            title: "Ride",
            text: "W or Up accelerates, S or Down brakes and reverses, A / D steer.",
            touchText: "Push the joystick up to go, down to brake, left and right to steer.",
            keys: ["gas", "brake", "steer"],
            touch: ["joystick"],
         },
         {
            title: "Stop to load and drop",
            text: "Stop on the pink ring at the shop to load, then stop inside the green door ring for 0.45 s.",
            keys: ["brake"],
            touch: ["joystick"],
         },
         {
            title: "Hop",
            text: "Press Space to hop over barriers. Hits and dark wet patches spoil quality: three spoiled orders end the run.",
            touchText: "Tap Hop to clear barriers. Hits and dark wet patches spoil quality: three spoiled orders end the run.",
            keys: ["hop"],
            touch: ["hop"],
         },
         {
            title: "Tips",
            text: "Fast drops score more: +40 quality within 25 seconds. Esc or P pauses.",
            touchText: "Fast drops score more: +40 quality within 25 seconds. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: LIMITS[0],
   levels: LEVELS,
   thumbnail: "/images/3d/burger-delivery-scooter.webp",
   accent: "#fb7185",
   owner: "claude",
};
