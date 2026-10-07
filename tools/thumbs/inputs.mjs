// Per-game input scripts for tools/thumbs/capture.mjs.
// Each script runs once, right after the 3-2-1 countdown, while the game is playing.
// Tune freely: add/remove steps, change durations.
//
// Step shapes:
//   { wait: 500 }                    pause, ms
//   { tap: "Space" }                 short key press (keys: ArrowLeft/Up/Right/Down, Space, KeyE, Enter)
//   { hold: "ArrowLeft", ms: 900 }   key held down for ms
//   { click: [0.5, 0.4] }            mouse tap on the canvas, x/y as fractions of canvas size

export const INPUT_SCRIPTS = {
   // joystick: drive the robot around, then a jump for a lively pose
   "robot-collector": [
      { hold: "ArrowLeft", ms: 900 },
      { hold: "ArrowUp", ms: 500 },
      { hold: "ArrowRight", ms: 900 },
      { tap: "Space" },
      { wait: 250 },
   ],

   // lanes: dash left-right between the catch lanes
   "food-catcher": [
      { tap: "ArrowLeft" },
      { wait: 450 },
      { tap: "ArrowRight" },
      { wait: 450 },
      { tap: "ArrowRight" },
      { wait: 450 },
      { tap: "ArrowLeft" },
      { wait: 400 },
   ],

   // runner: sprint forward, leap an obstacle, keep sprinting
   "office-escape": [
      { hold: "ArrowUp", ms: 1400 },
      { tap: "Space" },
      { wait: 350 },
      { hold: "ArrowUp", ms: 900 },
   ],

   // hop: pigeon hops forward across the road
   "pigeon-crossing": [
      { tap: "Space" },
      { wait: 650 },
      { tap: "Space" },
      { wait: 650 },
      { tap: "Space" },
      { wait: 500 },
   ],

   // tap-target: two shots at the goal (canvas fractions)
   "penalty-hero": [
      { click: [0.35, 0.45] },
      { wait: 900 },
      { click: [0.65, 0.35] },
      { wait: 900 },
   ],

   // joystick: weave through the warehouse aisles
   "warehouse-rush": [
      { hold: "ArrowUp", ms: 1100 },
      { hold: "ArrowRight", ms: 600 },
      { hold: "ArrowUp", ms: 1000 },
   ],

   // platformer: run right, jump, come back left, jump again
   "tower-climb": [
      { hold: "ArrowRight", ms: 800 },
      { tap: "Space" },
      { wait: 350 },
      { hold: "ArrowLeft", ms: 600 },
      { tap: "Space" },
      { wait: 300 },
   ],

   // joystick: sweep the streets for litter
   "clean-city": [
      { hold: "ArrowUp", ms: 900 },
      { hold: "ArrowLeft", ms: 700 },
      { hold: "ArrowDown", ms: 600 },
      { hold: "ArrowRight", ms: 700 },
   ],

   // point-and-move: click around the room, the runner investigates
   "escape-room": [
      { click: [0.68, 0.38] },
      { wait: 700 },
      { click: [0.3, 0.6] },
      { wait: 700 },
      { click: [0.5, 0.32] },
      { wait: 600 },
   ],

   // runner: sprint, leap, sidestep, leap again
   "obstacle-race": [
      { hold: "ArrowUp", ms: 1300 },
      { tap: "Space" },
      { wait: 300 },
      { hold: "ArrowRight", ms: 450 },
      { tap: "Space" },
      { hold: "ArrowUp", ms: 700 },
   ],
};
