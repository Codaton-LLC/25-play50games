// Wait until the crane is on screen, then a short slew so the hook is off the mast.
export default [
   { wait: 1800 },
   { hold: "ArrowUp", ms: 700 },
   { hold: "ArrowRight", ms: 500 },
   { wait: 400 },
   { zoom: 1.35, at: [0.52, 0.42] },
];
