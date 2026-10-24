// Thumbnail script: Space grabs the first torso as it reaches the claw, then the power cell; the
// shot lands while the claw carries the cell to the cradle (blueprint board, rim-lit belt and the
// ringed next part in view).
export default [
   { wait: 1300 },
   { tap: "Space" },
   { wait: 1750 },
   { tap: "Space" },
   { wait: 160 },
   { zoom: 1.35, at: [0.5, 0.48] },
];
