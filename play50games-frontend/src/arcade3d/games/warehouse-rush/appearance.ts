// Visual layouts only. All solid scenery is beyond the arena wall; rules and score proofs
// remain shared. Level 1 deliberately has no override.
import type { LevelId } from "../../types";
import type { LevelSpec } from "../../core/types";
import type { FloorRect } from "./levels";

interface WarehouseLook {
   floor: string;
   wall: string;
   trim: string;
   accent: string;
   environment: LevelSpec["environment"];
   props: readonly (FloorRect & { kind: "rack" | "pallet" })[];
   pools: readonly { x: number; z: number }[];
}

export const LOOKS: Partial<Record<LevelId, WarehouseLook>> = {
   2: {
      floor: "#879eac", wall: "#c3d4df", trim: "#234b68", accent: "#60a5fa",
      environment: { background: "#102433", lighting: "day", fog: ["#102433", 95, 180] },
      props: [-4, 4].map((x) => ({ x, z: -6.95, hx: 0.6, hz: 0.6, kind: "pallet" })),
      pools: [],
   },
   3: {
      floor: "#9b8269", wall: "#b49c83", trim: "#77452c", accent: "#fdba74",
      environment: { background: "#302319", lighting: "sunset", fog: ["#302319", 95, 170] },
      props: [-4.5, -1.5, 1.5, 4.5].map((x) => ({ x, z: -6.95, hx: 0.9, hz: 0.45, kind: "rack" })),
      pools: [],
   },
   4: {
      floor: "#787d88", wall: "#8f94a1", trim: "#653b28", accent: "#fbbf24",
      environment: { background: "#171b2b", lighting: "indoor", fog: ["#171b2b", 90, 165] },
      props: [-3, 0, 3].map((z) => ({ x: 11.15, z, hx: 0.6, hz: 0.6, kind: "pallet" })),
      pools: [{ x: 5.5, z: 1.55 }],
   },
   5: {
      floor: "#485b78", wall: "#526580", trim: "#203653", accent: "#67e8f9",
      environment: { background: "#080f21", lighting: "night", fog: ["#182d4b", 85, 150] },
      props: [-4, 0, 4].flatMap((x) => ([-1, 1] as const).map((side) => ({ x, z: side * 6.95, hx: 0.9, hz: 0.45, kind: "rack" as const }))),
      pools: [{ x: -5.5, z: 0 }, { x: 5.5, z: 0 }, { x: 0, z: -3.4 }, { x: 0, z: 3.4 }],
   },
};
