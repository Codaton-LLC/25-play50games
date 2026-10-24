"use client";

// The explorer's shovel: one <Model> mounted on the runner's right-hand anchor while digging (the
// blade reaches the sand, slid along its shaft with the scoop and the dig's progress) and on its
// chest anchor, on the back, while walking (core/rig attach). Placements: held.ts. The GLB's
// fallback is the stick and blade of ShovelPrimitive.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS } from "./assets";
import { BACK_HOLD, DIG_HOLD, digPlacement } from "./held";
import { DIG_RATE, type ExplorerLook } from "./poses";
import { ShovelPrimitive } from "./Primitives";
import { DIG, type RunState } from "./rules";

const TAU = Math.PI * 2;
/** The shovel moves from the back to the hand once this much of the dig crouch is in. */
export const HAND_FROM = 0.35;

/** `hand`: held in the right hand while digging, `back`: carried on the back the rest of the time. */
export function ExplorerShovel({ mode, run, look }: { mode: "hand" | "back"; run: RunState; look: ExplorerLook }) {
   const time = useGameTime();
   const group = useRef<Group>(null);
   const hold = mode === "hand" ? DIG_HOLD : BACK_HOLD;
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const inHand = look.dig >= HAND_FROM;
      g.visible = mode === "hand" ? inHand : !inHand;
      if (!g.visible || mode !== "hand") return;
      // the scoop's phase is the dig pose's own (poses.ts digPose: sin(t x DIG_RATE x 2 pi), t = play time now)
      digPlacement(Math.sin(time.now * DIG_RATE * TAU), run.dig.held / DIG.holdS, look.dig, g.position, g.quaternion);
   });
   return (
      <group ref={group} name={`explorer-shovel-${mode}`} quaternion={hold.quaternion} position={hold.position} visible={mode === "back"}>
         <Model asset={ASSETS.shovel} fallback={<ShovelPrimitive />} />
      </group>
   );
}
