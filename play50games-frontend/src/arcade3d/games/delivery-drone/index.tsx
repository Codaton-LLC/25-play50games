"use client";

import type { GameDefinition } from "@/arcade3d/core/types";
import Scene from "./Scene";
import Hud from "./Hud";
import { ASSETS } from "./assets";
import { FOV } from "./camera";
import { ROUTE } from "./rules";

const definition: GameDefinition = {
   slug: "delivery-drone",
   Scene,
   Hud,
   assets: ASSETS,
   camera: { position: [0, 14, 9], fov: FOV, lookAt: [0, 3, 0] },
   environment: { background: "#dbeafe", lighting: "day" },
   touchControls: ["joystick", "action"],
   touchLabels: { action: "Drop" },
   hudStats: [{ key: "deliveries", label: "Deliveries", max: ROUTE.count }, { key: "distance", label: "Target m" }],
   resultDelayMs: 1200,
   instructions: ["Hover at the depot for 4 seconds to load a parcel.", "Fly to the blue rooftop; brake early and line up the landing cross.", "Space, E, Enter or Drop releases. Complete 12 deliveries before the battery runs flat."],
};

export default definition;
