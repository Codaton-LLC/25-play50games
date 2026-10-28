// Palm Grove (level 2): the stream splits the grove; two bridges cross it, the east one under a fallen
// palm until the 2nd find. fairnessSuite.ts has the shared checks.
import { fairnessSuite } from "./fairnessSuite";

const WEST_BRIDGE = { x: -6, z: -2.6, hx: 1.2, hz: 1.9 };
const NORTH_BANK = { x: -2, z: -5 };

fairnessSuite(2, [
   { what: "the north bank is reachable from the start over the west bridge", at: NORTH_BANK, found: 0, reachable: true },
   { what: "with the west bridge gone, the fallen palm shuts the east bridge until the 2nd find", at: NORTH_BANK, found: 1, blocks: [WEST_BRIDGE], reachable: false },
   { what: "with the west bridge gone, the east bridge carries you across after the 2nd find", at: NORTH_BANK, found: 2, blocks: [WEST_BRIDGE], reachable: true },
]);
