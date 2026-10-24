"use client";

import { useMemo } from "react";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hop, squashStretch } from "@/arcade3d/core/motion";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { useGoblinParts } from "./Primitives";
import { LADDER, type CastleRun, type Goblin } from "./rules";

const TINT = {
   walker: new Color(COLORS.goblin.walker),
   shield: new Color(COLORS.goblin.shield),
   runner: new Color(COLORS.goblin.runner),
   crew: new Color(COLORS.goblin.crew),
};

export function visibleGoblin(run: CastleRun, slot: number): Goblin | undefined {
   // Each level shares the same 40-slot pool; waves contain at most 32 bodies.
   const g = run.waves[run.wave][slot];
   return g?.wave === run.wave ? g : undefined;
}
export function Goblins({ run, reduced }: { run: CastleRun; reduced: boolean }) {
   const time = useGameTime(), parts = useGoblinParts();
   const scratch = useMemo(() => ({
      p: new Vector3(), q: new Quaternion(), scale: new Vector3(), axis: new Vector3(0, 1, 0),
      motion: { y: 0, roll: 0, yaw: 0, squash: 1 }, stretch: { x: 1, y: 1, z: 1 },
      hp: new Float64Array(run.goblins.length).fill(-1), until: new Float64Array(run.goblins.length),
   }), []);
   function place(i: number, m: Matrix4, tint: Color) {
      const g = visibleGoblin(run, i);
      if (!g || g.status === "waiting" || g.status === "escaped") return false;
      const dead = g.status === "dead";
      const age = time.play - g.resolvedAt;
      if (dead && (reduced || age >= 0.35)) return false;
      const still = reduced || dead || g.status === "climb";
      hop(still ? 0 : time.now * Math.PI * 4 + g.id, 0.06, scratch.motion);
      // a little extra squash on each footfall; the hop above already supplies the step
      const step = !still && g.status === "ground" ? Math.abs(Math.sin(time.now * Math.PI * 4 + g.id)) : 0;
      squashStretch(Math.max(0.5, scratch.motion.squash * (1 - 0.05 * step)), scratch.stretch);
      // climbers are drawn larger so they stay readable on a landscape phone (no hit box: rocks hit the crew)
      const shrink = (dead ? Math.max(0, 1 - age / 0.35) : 1) * (g.status === "climb" ? LADDER.climberScale : 1);
      scratch.p.set(g.x, g.y + scratch.motion.y, g.z);
      scratch.q.setFromAxisAngle(scratch.axis, dead ? age * 12 : 0);
      scratch.scale.set(scratch.stretch.x * shrink, scratch.stretch.y * shrink, scratch.stretch.z * shrink);
      m.compose(scratch.p, scratch.q, scratch.scale);
      // no hit timestamp on the goblin: a drop in hp starts a 0.1 s white flash (instance colour, the pool has no emissive)
      let hot = false;
      if (g.id >= 0 && g.id < scratch.hp.length) {
         if (scratch.hp[g.id] < 0) scratch.hp[g.id] = g.hp;
         else if (g.hp < scratch.hp[g.id] - 1e-4) {
            scratch.hp[g.id] = g.hp;
            scratch.until[g.id] = time.now + 0.1;
         } else scratch.hp[g.id] = g.hp;
         hot = !reduced && time.now < scratch.until[g.id];
      }
      if (hot) tint.setRGB(3, 3, 3);
      else tint.copy(TINT[g.kind]);
   }
   function shield(i: number, m: Matrix4) {
      const g = visibleGoblin(run, i); if (!g || g.kind !== "shield" || g.status !== "ground") return false;
      m.makeRotationX(Math.PI / 2).setPosition(g.x, 0.92, g.z + 0.38);
   }
   function pennant(i: number, m: Matrix4) {
      const g = visibleGoblin(run, i); if (!g || g.kind !== "runner" || g.status !== "ground") return false;
      m.makeTranslation(g.x, 1.75, g.z);
   }
   function shadow(i: number, m: Matrix4) {
      const g = visibleGoblin(run, i); if (!g || g.status === "dead" || g.status === "escaped" || g.status === "waiting") return false;
      m.makeRotationX(-Math.PI / 2).setPosition(g.x, 0.025, g.z);
   }
   return <group>
      <DynamicInstancedModel asset={ASSETS.goblin} count={40} update={place} tinted fallbackParts={parts} />
      <DynamicInstanced count={40} update={shield}><cylinderGeometry args={[0.3, 0.3, 0.1, 8]} /><meshStandardMaterial color={COLORS.shieldWood} roughness={0.75} /></DynamicInstanced>
      <DynamicInstanced count={40} update={pennant}><coneGeometry args={[0.17, 0.5, 3]} /><meshStandardMaterial color={COLORS.pennant} /></DynamicInstanced>
      <DynamicInstanced count={40} update={shadow}><circleGeometry args={[0.4, 12]} /><meshBasicMaterial color="#1c1917" transparent opacity={0.18} depthWrite={false} /></DynamicInstanced>
   </group>;
}
