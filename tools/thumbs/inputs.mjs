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
//   { zoom: 1.8, at: [0.5, 0.4] }    frame for the shot, not an action: a canvas-shaped window
//                                    1/zoom of the canvas around `at` (fractions, kept inside the
//                                    canvas), zoom 1..2. The desktop camera of a top-down game
//                                    shows the whole board, so its hero is only 10-25 px tall
//                                    without it. The hero must end the script inside the window.

export const INPUT_SCRIPTS = {
   // joystick: a short walk up from the start pad, then towards the camera (visor in view)
   "robot-collector": [
      { hold: "ArrowUp", ms: 600 },
      { hold: "ArrowLeft", ms: 250 },
      { down: "ArrowDown" },
      { wait: 400 },
      { zoom: 2, at: [0.47, 0.44] },
   ],

   // held left / right moves the chef (fast: 9 u/s); let some food fall first, run to the left,
   // then back right so the shot catches it mid-stride near the middle of the counter (the OG
   // card keeps only the middle of the shot)
   "food-catcher": [
      { wait: 1500 },
      { hold: "ArrowLeft", ms: 450 },
      { down: "ArrowRight" },
      { wait: 200 },
      { zoom: 1.4, at: [0.5, 0.62] },
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
   // (PREVIEW_MS 3050), whose traffic is clear. Wait on the start grass until cars come, then
   // a sideways hop (still on grass, so never run over); the shot lands mid-hop (HOP_MS 550)
   "pigeon-crossing": [
      { wait: 8500 },
      { tap: "ArrowLeft" },
      { wait: 150 },
      { zoom: 1.5, at: [0.47, 0.45] },
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

   // joystick: out of the rack gap and left past the top pallets, walking at the shot
   "warehouse-rush": [
      { hold: "ArrowUp", ms: 400 },
      { down: "ArrowLeft" },
      { wait: 350 },
      { zoom: 1.8, at: [0.45, 0.42] },
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
      { zoom: 2, at: [0.47, 0.6] },
   ],

   // joystick: up the path from the start pad, then left towards the litter, walking at the shot
   "clean-city": [
      { hold: "ArrowUp", ms: 600 },
      { down: "ArrowLeft" },
      { wait: 400 },
      { zoom: 2, at: [0.43, 0.62] },
   ],

   // WASD / arrows walk the runner around the room (a click only inspects a badge)
   "escape-room": [
      { hold: "ArrowUp", ms: 900 },
      { hold: "ArrowRight", ms: 600 },
      { down: "ArrowUp" },
      { wait: 600 },
      { zoom: 1.6, at: [0.5, 0.52] },
   ],

   // platformer: run straight up the course and shoot mid-leap (a sidestep falls into the pool)
   "obstacle-race": [
      { down: "ArrowUp" },
      { wait: 900 },
      { tap: "Space" },
      { wait: 250 },
   ],
};
