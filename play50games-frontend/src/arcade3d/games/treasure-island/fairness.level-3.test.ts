// Rocky Cove (level 3): the ravine splits the east headland off; the rope bridge is the only way
// across. The clue -> map -> chest chain locks the final chest until the map is whole.
import { fairnessSuite } from "./fairnessSuite";

const ROPE_BRIDGE = { x: 4.8, z: -2.0, hx: 2.4, hz: 0.9 };
const HEADLAND = { x: 9, z: -0.5 };

fairnessSuite(3, [
   { what: "the east headland is reachable over the rope bridge", at: HEADLAND, found: 0, reachable: true },
   { what: "without the rope bridge the ravine shuts the east headland off", at: HEADLAND, found: 0, blocks: [ROPE_BRIDGE], reachable: false },
]);
