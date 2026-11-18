import type { ArcadeGameMeta, ScoringRules } from "@/arcade3d/types";

// Plain data only (server-safe). scoring must match WP includes/arcade-games.json.
// Limits proven in README.md "Server limits and why they hold", one proof per level; they equal
// rules.ts PROPOSED_LEVEL_LIMITS (levels.test.ts) and arcade-games.json levels (registry.sync.test.ts).
const SCORING: ScoringRules = {
   kind: "points",
   maxScore: 7130,
   minDurationMs: 39000,
   maxDurationMs: 140000,
   base: 480,
   maxPointsPerSec: 56,
   unitLabel: "pts",
   display: "int",
};

export const castleDefenderMeta: ArcadeGameMeta = {
   slug: "castle-defender",
   title: "Castle Defender",
   tagline: "Hold the wall.",
   description: "Hold the castle wall against waves of bumbling cartoon goblins: tap to fire the wall cannon, drop rocks on ladders and keep the gate standing.",
   order: 24,
   status: "live",
   collection: "skill",
   difficulty: 3,
   orientation: "any",
   controls: {
      scheme: "tap-target",
      keyboard: "Click the field to fire; arrows / WASD aim, Space fires; E / Enter drops a rock; 1 / 2 chooses an upgrade",
      touch: "Tap the field to fire, tap Rock to clear a ladder, tap an upgrade card to choose",
   },
   howTo: {
      keys: [
         { id: "click", keys: ["Mouse"], label: "Click to fire", main: true, role: "pointer" },
         { id: "aim", keys: ["Arrows", "WASD"], label: "Aim", role: "move" },
         { id: "fire", keys: ["Space"], label: "Fire", main: true },
         { id: "rock", keys: ["E", "Enter"], label: "Drop a rock" },
         { id: "upgrade", keys: ["1/2"], label: "Pick upgrade" },
      ],
      touch: [
         { id: "tap", control: "tap", label: "Tap the field to fire" },
         { id: "rock", control: "action", label: "Drop a rock" },
      ],
      steps: [
         { title: "Goal", text: "Hold the castle gate through every goblin wave." },
         {
            title: "Fire",
            text: "Click the field to fire, or aim with the arrows / WASD and press Space.",
            touchText: "Tap the field to fire: the shot snaps to the nearest goblin.",
            keys: ["click", "aim", "fire"],
            touch: ["tap"],
         },
         {
            title: "Drop a rock",
            text: "E or Enter drops a rock on an erected ladder. It reloads in 8 seconds.",
            touchText: "Tap Rock to clear an erected ladder. It reloads in 8 seconds.",
            keys: ["rock"],
            touch: ["rock"],
         },
         {
            title: "Upgrades",
            text: "Between waves choose an upgrade with 1 or 2. Hit shields from behind.",
            touchText: "Between waves tap an upgrade card. Hit shields from behind.",
            keys: ["upgrade"],
            touch: ["tap"],
         },
         {
            title: "Tips",
            text: "Runners are fast: shoot them first. Esc or P pauses.",
            touchText: "Runners are fast: shoot them first. Tap Pause, top right, to stop.",
            keys: ["pause"],
            touch: ["pause"],
         },
      ],
   },
   scoring: SCORING,
   // a level clears on a win (every wave survived); no clearScore
   levels: [
      { id: 1, title: "Outer Wall", scoring: SCORING },
      { id: 2, title: "Main Gate", scoring: { ...SCORING, maxScore: 7370, minDurationMs: 33000, maxDurationMs: 135000, base: 600, maxPointsPerSec: 61 } },
      { id: 3, title: "Twin Towers", scoring: { ...SCORING, maxScore: 9130, minDurationMs: 36000, maxDurationMs: 156000, base: 480, maxPointsPerSec: 65 } },
      { id: 4, title: "Night Siege", scoring: { ...SCORING, maxScore: 10710, minDurationMs: 35000, maxDurationMs: 178500, base: 480, maxPointsPerSec: 66 } },
      { id: 5, title: "Royal Defense", scoring: { ...SCORING, maxScore: 11570, minDurationMs: 30000, maxDurationMs: 200500, base: 480, maxPointsPerSec: 63 } },
   ],
   thumbnail: "/images/3d/castle-defender.webp",
   accent: "#94a3b8",
   owner: "codex",
};
