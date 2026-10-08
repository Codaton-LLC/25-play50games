// tools/thumbs script for shopping-cart (owner: Antigravity).
// Steer up through aisle 1, drift right into the cross walkway while riding.
export default [
   { hold: "ArrowUp", ms: 900 },
   { down: "Space" },
   { hold: "ArrowRight", ms: 600 },
   { wait: 350 },
   { zoom: 1.5, at: [0.5, 0.5] },
];
