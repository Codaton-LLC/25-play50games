// tools/thumbs script for monster-kitchen. Static camera game: let the first monster walk in and show
// its order, spin the wheel once, toss (the arc and the splash read mid-flight), then settle the shot.
export default [
   { wait: 1500 },
   { hold: "ArrowLeft", ms: 240 },
   { hold: "ArrowRight", ms: 240 },
   { hold: "Space", ms: 60 },
   { wait: 320 },
   { zoom: 1.4, at: [0.45, 0.5] },
];
