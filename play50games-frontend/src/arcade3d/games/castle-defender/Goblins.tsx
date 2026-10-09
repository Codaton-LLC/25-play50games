"use client";

import { useMemo } from "react";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hop, squashStretch } from "@/arcade3d/core/motion";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { GOBLIN_TINTS, useGoblinParts } from "./Primitives";
import type { CastleRun, Goblin } from "./rules";

const WAVE_IDS = [0, 8, 22, 42, 68];
export function visibleGoblin(run: CastleRun, slot: number): Goblin | undefined {
   // IDs for each wave occupy one contiguous segment, with at most30 in the40-slot pool.
   const g = run.goblins[WAVE_IDS[run.wave] + slot];
   return g?.wave === run.wave ? g : undefined;
}
export function Goblins({ run, reduced }: { run: CastleRun; reduced: boolean }) {
   const time = useGameTime(), parts = useGoblinParts();
   const scratch = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), scale: new Vector3(), axis: new Vector3(0, 1, 0), motion: { y: 0, roll: 0, yaw: 0, squash: 1 }, stretch: { x: 1, y: 1, z: 1 } }), []);
   function place(i: number, m: Matrix4, tint: Color) {
      const g = visibleGoblin(run, i);
      if (!g || g.status === "waiting" || g.status === "escaped") return false;
      const dead = g.status === "dead";
      const age = time.play - g.resolvedAt;
      if (dead && (reduced || age >= 0.35)) return false;
      hop(reduced || dead || g.status === "climb" ? 0 : time.now * Math.PI * 4 + g.id, 0.06, scratch.motion);
      squashStretch(scratch.motion.squash, scratch.stretch);
      const shrink = dead ? Math.max(0, 1 - age / 0.35) : 1;
      scratch.p.set(g.x, g.y + scratch.motion.y, g.z);
      scratch.q.setFromAxisAngle(scratch.axis, dead ? age * 12 : 0);
      scratch.scale.set(scratch.stretch.x * shrink, scratch.stretch.y * shrink, scratch.stretch.z * shrink);
      m.compose(scratch.p, scratch.q, scratch.scale); tint.copy(GOBLIN_TINTS[g.kind]);
   }
   function shield(i: number, m: Matrix4) {
      const g = visibleGoblin(run, i); if (!g || g.kind !== "shield" || g.status !== "ground") return false;
      m.makeTranslation(g.x, 0.8, g.z + 0.38);
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
      <DynamicInstanced count={40} update={shield}><boxGeometry args={[0.55, 0.7, 0.12]} /><meshStandardMaterial color="#3b82f6" metalness={0.3} /></DynamicInstanced>
      <DynamicInstanced count={40} update={pennant}><coneGeometry args={[0.17, 0.5, 3]} /><meshStandardMaterial color="#fb923c" /></DynamicInstanced>
      <DynamicInstanced count={40} update={shadow}><circleGeometry args={[0.4, 12]} /><meshBasicMaterial color="#1c1917" transparent opacity={0.18} depthWrite={false} /></DynamicInstanced>
   </group>;
}
