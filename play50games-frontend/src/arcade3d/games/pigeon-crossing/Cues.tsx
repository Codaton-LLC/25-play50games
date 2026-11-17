"use client";

// Clarity layer (visual only): the "+N" pop at every new row or street and the red pop when traffic
// hits the pigeon. It reads the run after the simulation and never writes it.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useActionPop } from "@/arcade3d/core/fx";
import { NONE, type PigeonRun } from "./rules";

const AT = { x: 0, y: 1.6, z: 0 };

export function Cues({ run }: { run: PigeonRun }) {
   const pop = useActionPop();
   const score = useRef(run.score);
   const hit = useRef(false);
   useFrame(() => {
      const p = run.player;
      AT.x = p.x;
      AT.z = p.z;
      if (run.score > score.current && run.hitAtMs === NONE) {
         const delta = run.score - score.current;
         if (delta >= 100) pop.good(AT, `+${delta} street`);
         else pop.good(AT, `+${delta}`);
      }
      score.current = run.score;
      if (run.hitAtMs !== NONE && !hit.current) {
         hit.current = true;
         pop.fail(AT, "Splat! Hit by traffic", { shake: 0 });
      }
   });
   return null;
}
