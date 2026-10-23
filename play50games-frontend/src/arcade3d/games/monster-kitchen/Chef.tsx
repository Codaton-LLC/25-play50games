// The chef: the reused food-catcher humanoid behind the wheel, driven by poses.ts (never the T-pose:
// the pose driver writes idle / reach-and-throw / cheer every frame at the pose priority). Stands at
// CHEF_POS facing the cauldron; feet stay on the floor (the model applies the pose lift itself).
import { useState } from "react";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { BlobShadow } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS } from "./assets";
import { TOSS } from "./rules";
import { ChefPrimitive } from "./Primitives";
import { chefPose, CHEF_POS, CHEF_YAW, type ChefLook } from "./poses";

/** The throw animation's length: the flight plus a short follow-through. */
const THROW_S = TOSS.flightS + 0.2;

/** What the driver reads: tossAt / cheerUntil in the time.now domain, written by the Scene. */
export interface ChefShared {
   tossAt: number;
   cheerUntil: number;
}

export function Chef({ shared }: { shared: ChefShared }) {
   const time = useGameTime();
   const [look] = useState<ChefLook>(() => ({ throwK: -1, cheer: 0 }));
   const [reach] = useState(createPose);
   const [carry] = useState(createPose);
   const [cheer] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const since = time.now - shared.tossAt;
      look.throwK = since >= 0 && since < THROW_S ? since / THROW_S : -1;
      look.cheer += ((shared.cheerUntil > time.now ? 1 : 0) - look.cheer) * (1 - Math.exp(-6 * time.delta));
      chefPose(look, time.now, p, reach, carry, cheer);
   });

   return (
      <group name="chef" position={[CHEF_POS.x, CHEF_POS.y, CHEF_POS.z]} rotation-y={CHEF_YAW}>
         <BlobShadow radius={0.34} />
         <HumanoidModel asset={ASSETS.chef} pose={pose} fallback={<ChefPrimitive />} />
      </group>
   );
}
