// tools/thumbs script for museum-guard. The eye is fixed: turn so a pedestal and the beam
// sit in frame, then hold for the capture.
export default [
   { hold: "ArrowRight", ms: 420 },
   { wait: 280 },
   { down: "ArrowRight" },
   { wait: 240 },
   { zoom: 1.4, at: [0.5, 0.45] },
];
