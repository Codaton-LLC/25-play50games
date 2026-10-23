// Wait for automatic loading, then catch the drone and suspended parcel in flight (zoomed on it).
export default [
   { wait: 4100 },
   { hold: "ArrowUp", ms: 1100 },
   { down: "ArrowRight" },
   { wait: 350 },
   { zoom: 2, at: [0.5, 0.52] },
];
