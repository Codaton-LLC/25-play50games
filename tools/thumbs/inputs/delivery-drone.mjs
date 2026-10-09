// Wait for automatic loading, then catch the drone and suspended parcel in flight.
export default [
   { wait: 4100 },
   { hold: "ArrowUp", ms: 1100 },
   { down: "ArrowRight" },
   { wait: 350 },
];
