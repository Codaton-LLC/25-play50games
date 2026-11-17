"use client";

// Clarity layer (visual only): a beacon on the nearest piece to collect (or the start ring while
// delivering), the "+N" pop at every pickup (gold when the combo bonus came with it) and the hint
// line. It reads the run after the simulation and never writes it.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useActionPop } from "@/arcade3d/core/fx";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { GUIDE, emptyGoal, gained, hintCode, hintFor, nextGoal } from "./guide";
import type { CleanRun } from "./rules";

/** The "+N" pop starts just over the 1.75 cleaner's head. */
const AT = { x: 0, y: 2.0, z: 0 };

export function Cues({ run }: { run: CleanRun }) {
   const pop = useActionPop();
   const goal = useRef(emptyGoal()).current;
   const code = useRef(-1);
   const score = useRef(run.score);
   const pick = useRef({ x: 0, y: 0.3, z: 0, hidden: true }).current;
   const drop = useRef({ x: 0, y: 0.5, z: 0, hidden: true }).current;

   useEffect(() => {
      nextGoal(run, goal);
      code.current = hintCode(run, goal);
      GUIDE.set(hintFor(run, goal));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useFrame(() => {
      const delta = gained(run, score.current);
      if (delta > 0 && !run.ended) {
         AT.x = run.runner.x;
         AT.z = run.runner.z;
         if (delta > run.level.points) pop.good(AT, `+${delta} combo`);
         else pop.good(AT, `+${delta}`);
      }
      score.current = run.score;
      nextGoal(run, goal);
      pick.hidden = goal.kind !== "litter";
      drop.hidden = goal.kind !== "pad";
      const live = goal.kind === "pad" ? drop : pick;
      live.x = goal.x;
      live.z = goal.z;
      const next = hintCode(run, goal);
      if (next !== code.current) {
         code.current = next;
         GUIDE.set(hintFor(run, goal));
      }
   });

   return (
      <>
         <TargetBeacon target={pick} variant="pick" color="#4ade80" radius={0.6} height={0.9} />
         <TargetBeacon target={drop} variant="drop-here" radius={1.1} height={1.0} label="RING" />
      </>
   );
}
