import { describe, expect, it } from "vitest";
import { LOOKS } from "./appearance";
import { ARENA } from "./rules";

const IDS = [2, 3, 4, 5] as const;

describe("warehouse level scenery", () => {
   it("leaves the live training depot untouched", () => {
      expect(LOOKS[1]).toBeUndefined();
   });

   it.each(IDS)("gives level %i its own look outside the play area", (id) => {
      const look = LOOKS[id]!;
      expect(look.props.length).toBeGreaterThan(0);
      for (const prop of look.props) {
         expect(Math.abs(prop.x) - prop.hx > ARENA.halfX || Math.abs(prop.z) - prop.hz > ARENA.halfZ).toBe(true);
      }
      expect(new Set(IDS.map((n) => JSON.stringify(LOOKS[n]!.props))).size).toBe(4);
      expect(new Set(IDS.map((n) => LOOKS[n]!.floor)).size).toBe(4);
      expect(look.environment!.fog![2]).toBeGreaterThan(look.environment!.fog![1]);
   });
});
