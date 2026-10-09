// tools/thumbs script for rocket-landing: tilt a little, fire the engine so the flame shows, and
// shoot a window zoomed on the flight (the camera keeps the rocket and the pad in its box, centred).
export default [
   { wait: 1400 },
   { hold: "ArrowLeft", ms: 180 },
   { down: "Space" },
   { wait: 180 },
   { zoom: 1.25, at: [0.5, 0.55] },
];
