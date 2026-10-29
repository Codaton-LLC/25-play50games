// Pirate Peak (level 5): the final chest sits on the summit inside a ring of rocks; the rockfall on
// the south-west path clears when the map is whole (the 5th find).
import { fairnessSuite } from "./fairnessSuite";

const SUMMIT = { x: 2, z: -3.6 };

fairnessSuite(5, [
   { what: "the summit is shut before the map is whole", at: SUMMIT, found: 4, reachable: false },
   { what: "the rockfall clears with the 5th find", at: SUMMIT, found: 5, reachable: true },
   { what: "the wreck's beach is open from the start", at: { x: -9.5, z: 2.5 }, found: 0, reachable: true },
]);
