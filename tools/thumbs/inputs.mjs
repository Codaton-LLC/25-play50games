// Per-game input scripts for tools/thumbs/capture.mjs.
// Each script runs once, right after the 3-2-1 countdown, while the game is playing; the shot is
// taken right after the last step (keys still held with { down } are released after the shot,
// so end on a held key or a fresh jump to catch the character mid-move).
// Tune freely: add/remove steps, change durations.
//
// Step shapes:
//   { wait: 500 }                    pause, ms
//   { tap: "Space" }                 short key press (keys: ArrowLeft/Up/Right/Down, Space, KeyE, Enter)
//   { hold: "ArrowLeft", ms: 900 }   key held down for ms, then released
//   { down: "ArrowUp" }              key pressed and kept down (released by { up } or after the shot)
//   { up: "ArrowUp" }                release a key pressed with { down }
//   { click: [0.5, 0.4] }            mouse tap on the canvas, x/y as fractions of canvas size

export const INPUT_SCRIPTS = {
   // joystick: drive the robot around; the shot catches it walking
   "robot-collector": [
      { hold: "ArrowLeft", ms: 900 },
      { hold: "ArrowUp", ms: 500 },
      { down: "ArrowRight" },
      { wait: 800 },
   ],

   // held left / right moves the chef; the shot catches it running for the food
   "food-catcher": [
      { hold: "ArrowLeft", ms: 500 },
      { hold: "ArrowRight", ms: 900 },
      { down: "ArrowLeft" },
      { wait: 450 },
   ],

   // runner (auto-run): change lanes, then the shot lands near the top of a leap (JUMP_MS 700)
   "office-escape": [
      { wait: 600 },
      { tap: "ArrowLeft" },
      { wait: 800 },
      { tap: "ArrowRight" },
      { wait: 700 },
      { tap: "Space" },
      { wait: 180 },
   ],

   // hop: one hop per arrow press (Space does nothing), ignored during the 3 s road preview
   // (PREVIEW_MS 3050); the shot lands mid-hop (HOP_MS 550)
   "pigeon-crossing": [
      { wait: 3200 },
      { tap: "ArrowUp" },
      { wait: 700 },
      { tap: "ArrowLeft" },
      { wait: 700 },
      { tap: "ArrowUp" },
      { wait: 120 },
   ],

   // tap-target: aim with the arrows, Space shoots; the shot lands with the ball in the air
   // (run-up 700 ms, flight 500 ms)
   "penalty-hero": [
      { wait: 300 },
      { tap: "ArrowLeft" },
      { wait: 150 },
      { tap: "ArrowUp" },
      { wait: 250 },
      { tap: "Space" },
      { wait: 850 },
   ],

   // joystick: weave through the warehouse aisles, walking at the shot
   "warehouse-rush": [
      { hold: "ArrowUp", ms: 1100 },
      { hold: "ArrowRight", ms: 600 },
      { down: "ArrowUp" },
      { wait: 700 },
   ],

   // platformer: run right, jump, come back left and shoot mid-jump
   "tower-climb": [
      { hold: "ArrowRight", ms: 800 },
      { tap: "Space" },
      { wait: 450 },
      { down: "ArrowLeft" },
      { wait: 350 },
      { tap: "Space" },
      { wait: 200 },
   ],

   // joystick: sweep the streets for litter, walking at the shot
   "clean-city": [
      { hold: "ArrowUp", ms: 900 },
      { hold: "ArrowLeft", ms: 700 },
      { down: "ArrowUp" },
      { wait: 700 },
   ],

   // WASD / arrows walk the runner around the room (a click only inspects a badge)
   "escape-room": [
      { hold: "ArrowUp", ms: 900 },
      { hold: "ArrowRight", ms: 600 },
      { down: "ArrowUp" },
      { wait: 600 },
   ],

   // platformer: run straight up the course and shoot mid-leap (a sidestep falls into the pool)
   "obstacle-race": [
      { down: "ArrowUp" },
      { wait: 900 },
      { tap: "Space" },
      { wait: 250 },
   ],
};
