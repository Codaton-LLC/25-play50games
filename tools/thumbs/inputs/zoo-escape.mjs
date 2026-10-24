// tools/thumbs script for zoo-escape (owner: Claude).
// Waddle north out of the enclosure's corner, then tiptoe (Sneak held) towards the keeper's cone,
// so the shot shows the panda mid-step, crouched, with a flashlight fan on the grass.
export default [
   { hold: "ArrowUp", ms: 1400 },
   { hold: "ArrowRight", ms: 450 },
   { down: "Space" },
   { down: "ArrowUp" },
   { wait: 500 },
   { zoom: 1.3, at: [0.5, 0.55] },
];
