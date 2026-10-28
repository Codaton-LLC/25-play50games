// Jungle Interior (level 4): walls of foliage; a vine curtain shuts the north-east grove until the
// 1st find, another the temple courtyard until the 3rd. The chain locks the final chest.
import { fairnessSuite } from "./fairnessSuite";

const GROVE = { x: 7, z: -5 };
const TEMPLE = { x: -6, z: -7 };

fairnessSuite(4, [
   { what: "the north-east grove is shut before the 1st find", at: GROVE, found: 0, reachable: false },
   { what: "the north-east grove opens with the 1st find", at: GROVE, found: 1, reachable: true },
   { what: "the temple courtyard is shut before the 3rd find", at: TEMPLE, found: 2, reachable: false },
   { what: "the temple courtyard opens with the 3rd find", at: TEMPLE, found: 3, reachable: true },
   { what: "the jungle west of the wall is open from the start (the gap at x -6)", at: { x: -8, z: -2 }, found: 0, reachable: true },
]);
