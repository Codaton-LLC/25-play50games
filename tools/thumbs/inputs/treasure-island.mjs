// tools/thumbs script for treasure-island (owner: Claude). Joystick game with a follow camera that
// keeps the explorer near the middle of the canvas: walk inland from the dock, then turn back
// towards the camera so the shot catches the explorer mid-stride, face and hat in view, with the
// detector ring on the sand around it.
export default [
   { hold: "ArrowUp", ms: 1100 },
   { hold: "ArrowLeft", ms: 300 },
   { down: "ArrowDown" },
   { wait: 350 },
   { zoom: 1.6, at: [0.5, 0.5] },
];
