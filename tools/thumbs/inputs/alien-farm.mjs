// tools/thumbs script for alien-farm (owner: Claude, P-18 takeover).
// Walk north from the start to the centre bed while the first crops swell and their rings fill,
// then step towards the west bed so the shot catches the farmer mid-stride beside a glowing crop.
export default [
   { hold: "ArrowUp", ms: 1150 },
   { wait: 900 },
   { down: "ArrowLeft" },
   { wait: 180 },
   { zoom: 1.3, at: [0.5, 0.55] },
];
