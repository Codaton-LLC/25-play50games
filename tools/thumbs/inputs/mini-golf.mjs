// tools/thumbs script for mini-golf (owner: Claude). Aim-drag putting game with a fixed camera per
// hole: on hole 1, nudge the aim and the power up with the arrows so the preview dots run towards
// the cup and take the shot with the ball, the dots, the cup and the flag in the frame.
export default [
   { wait: 900 },
   { tap: "ArrowUp" },
   { tap: "ArrowUp" },
   { tap: "ArrowUp" },
   { wait: 300 },
   { zoom: 1.25, at: [0.5, 0.5] },
];
