// The first ticket always breaks the starting dock at six seconds.
export default [
   { wait: 6530 },
   { tap: "KeyE" },
   { wait: 80 },
   { down: "ArrowRight" },
   { wait: 240 },
];
