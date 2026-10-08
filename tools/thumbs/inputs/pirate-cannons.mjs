// tools/thumbs script for pirate-cannons (owner: Claude). Aim-drag game with a fixed camera behind the
// fort: let the first ships sail in, nudge the cannon up and to the left with the arrows (keyboard
// aim), fire with Space and take the shot with the ball in the air over its trajectory dots, the
// fort, the island and the ships in the frame.
export default [
   { wait: 2600 },
   { tap: "ArrowUp" },
   { tap: "ArrowUp" },
   { tap: "ArrowLeft" },
   { tap: "Space" },
   { wait: 420 },
   { zoom: 1.35, at: [0.5, 0.42] },
];
