"use client";
import { useEffect, useMemo } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useLevel } from "../../core/level";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { usePlayers, playersStore } from "../../menu2/multiplayer/players";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { createOrbit } from "../../menu2/camera/orbit";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import { createStepInput } from "./rules";
import type { HeroId } from "./heroes";
import type { FactoryLevel } from "./levels";
import { FACTORY_ORBIT } from "./camera";
import { effects } from "./Scene";
import { Hero } from "./Hero";
import { Course } from "./Course";
import World from "./World";
function Run({ m }: {
   m: MultiRun;
}) {
   const juice = useJuice();
   const orbit = useMemo(() => createOrbit(FACTORY_ORBIT), [m]);
   const inputs = useMemo(() => m.runs.map(createStepInput), [m]);
   const points = useMemo(() => m.runs.map((r) => ({ x: r.hero.x, y: r.hero.y, z: r.hero.z })), [m]);
   useEffect(() => { playersStore.getState().beginRun(5); }, [m]);
   useRunFrame((_, dt) => {
      for (let i = 0; i < m.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.moveX = p.moveX;
         s.moveZ = p.moveY;
         s.yaw = orbit.viewYaw;
         s.jumpPressed = p.jumpPressed;
         s.actionPressed = p.actionPressed;
         // Shared multiplayer has no Roll field: holding Jump rolls on the ground, and while falling.
         s.roll = p.jump && (m.runs[i].hero.grounded || m.runs[i].hero.vy < 0);
      }
      stepMulti(m, dt * 1000, inputs);
      for (let i = 0; i < m.runs.length; i++) {
         const r = m.runs[i];
         effects(r, juice);
         const offset = m.mode.id === "versus" ? (i - (m.runs.length - 1) / 2) * 22 : 0;
         points[i].x = r.hero.x + offset;
         points[i].y = r.hero.y;
         points[i].z = r.hero.z;
         const ps = playersStore.getState();
         ps.setPosition(i, points[i].x, r.hero.y, r.hero.z);
         const prev = ps.players.find((p) => p.index === i);
         if (prev && (prev.score !== r.orbs || prev.progress !== r.board.charged || prev.finished !== (r.ended === "win") || prev.lives !== r.hearts))
            ps.update(i, { score: r.orbs, progress: r.board.charged, lives: r.hearts, finished: r.ended === "win", finishMs: r.ended === "win" ? r.finishMs : null });
      }
      if (m.ended)
         useArcadeStore.getState().end(m.ended);
   });
   return <><PlayerInputLatch /><World multi={m.mode.id === "versus"}/>
     {m.runs.map((r, i) => { const offset = m.mode.id === "versus" ? (i - (m.runs.length - 1) / 2) * 22 : 0; return <group key={i} position-x={offset}>{(i === 0 || m.mode.id === "versus") && <Course run={r} versus={m.mode.id === "versus"}/>}<Hero run={r}/></group>; })}
     {m.mode.id === "versus" && <mesh position={[0, -0.1, 5]}><boxGeometry args={[m.runs.length * 22, 0.14, 1]}/><meshStandardMaterial color="#ab6544" emissive="#5c261b"/></mesh>}
     <OrbitDriver orbit={orbit}/><SharedCamera points={points} orbit={orbit} minSpan={18} maxSpan={90} padding={2} pitch={0.76}/>
   </>;
}
export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<FactoryLevel>();
   const mode = usePlayers((s) => s.mode);
   // Snapshot roster per shell run; progress updates must not remake the simulation.
   const m = useMemo(() => createMultiRun(20261028, config?.id ?? 1, playersStore.getState().players.map((p) => p.heroId as HeroId), mode), [runId, config?.id, mode]);
   return <JuiceLayer><Run m={m}/></JuiceLayer>;
}
