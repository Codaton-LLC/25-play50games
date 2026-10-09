// Place two slabs of the house, then lift a pillar so it hangs from the hook. Keyboard only:
// Left / Right turn the jib, Up / Down run the trolley, E picks over a pile, Space drops.
// E and Space repeat: a press off the pile or outside the drop gate is ignored, not a miss.
const pick = [{ tap: "KeyE" }, { wait: 250 }, { tap: "KeyE" }, { wait: 250 }, { tap: "KeyE" }, { wait: 400 }];
const drop = [{ tap: "Space" }, { wait: 250 }, { tap: "Space" }, { wait: 250 }, { tap: "Space" }, { wait: 300 }];
export default [
   { wait: 1500 },
   { hold: "ArrowLeft", ms: 465 },
   { hold: "ArrowUp", ms: 1000 },
   { wait: 600 },
   ...pick,
   { hold: "ArrowUp", ms: 1000 },
   { wait: 1300 },
   ...drop,
   { hold: "ArrowDown", ms: 1000 },
   { wait: 600 },
   ...pick,
   { hold: "ArrowRight", ms: 400 },
   { hold: "ArrowUp", ms: 1000 },
   { wait: 1300 },
   ...drop,
   { hold: "ArrowDown", ms: 1000 },
   { wait: 600 },
   ...pick,
   { hold: "ArrowUp", ms: 550 },
   { wait: 250 },
   { zoom: 1.2, at: [0.47, 0.38] },
];
