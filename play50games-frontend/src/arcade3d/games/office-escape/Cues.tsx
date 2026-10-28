"use client";

// Clarity layer (visual only): the hint line for the first rows, the crash pop naming what was hit and
// a "+50" pop at every coin. It reads the run after the simulation and never writes it.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useActionPop } from "@/arcade3d/core/fx";
import { GUIDE, hintCode, hintFor, obstacleName } from "./guide";
import { COIN, type OfficeRun } from "./rules";

const AT = { x: 0, y: 1.8, z: 0 };

export function Cues({ run }: { run: OfficeRun }) {
   const pop = useActionPop();
   const code = useRef(-1);
   const coins = useRef(run.coins);
   const over = useRef(false);

   useEffect(() => {
      code.current = hintCode(run);
      GUIDE.set(hintFor(code.current, run));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   useFrame(() => {
      AT.x = run.x / 1000;
      if (run.coins > coins.current) pop.good(AT, `+${(run.coins - coins.current) * COIN.points}`);
      coins.current = run.coins;
      if (run.over && !over.current) {
         over.current = true;
         if (run.endReason === "lose") pop.fail(AT, `Crashed into a ${obstacleName(run.events.hitType)}`, { shake: 0 });
      }
      const next = hintCode(run);
      if (next !== code.current) {
         code.current = next;
         GUIDE.set(hintFor(next, run));
      }
   });

   return null;
}
