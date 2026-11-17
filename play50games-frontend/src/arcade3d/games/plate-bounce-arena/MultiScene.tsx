"use client";

// 2-4 hero balls on the same table, each on their own run (shared progress in co-op). The camera is the
// card's fixed shared table view: the orbit's table pose on the table's middle (players may still turn
// it with the camera keys).
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import TableView, { TableFrame, createTableClock } from "./TableView";
import Rollo from "./Rollo";
import { Ball, createBallAnim } from "./Ball";
import { FOV, FOV_PORTRAIT, MP_YAW, REST, TABLE_ORBIT, orbitPivot, orbitScale } from "./camera";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { PinLevel } from "./levels";

function MultiSimulation({ multi }: { multi: MultiRun }) {
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);
   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.moveX = p.moveX;
         s.moveZ = p.moveY;
         s.yaw = MP_YAW;
         s.left = p.moveX < -0.35;
         s.right = p.moveX > 0.35;
         s.jumpPressed = p.jumpPressed;
         s.jumpHeld = p.jump;
         s.actionPressed = p.actionPressed;
         s.actionHeld = p.action;
      }
      stepMulti(multi, dt * 1000, inputs);
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         players.update(i, {
            score: run.points,
            progress: progressOf(run),
            finished: run.ended === "win",
            finishMs: run.ended === "win" ? run.finishMs : null,
         });
      }
      if (multi.ended === "win") useArcadeStore.getState().end("win");
      else if (multi.ended === "timeup") useArcadeStore.getState().end("timeup");
   });
   return <PlayerInputLatch />;
}

function FixedCamera() {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   const orbit = useMemo(() => createOrbit({ ...TABLE_ORBIT, yaw: MP_YAW }), []);
   const pivot = useMemo(() => (out: { x: number; y: number; z: number }) => {
      orbitPivot(REST.x, REST.z, 0, out);
      return true;
   }, []);
   return <OrbitCamera orbit={orbit} pivot={pivot} behind={() => MP_YAW} input={{ oneFinger: false, mouseButtons: [2] }} distanceScale={orbitScale(aspect) * 1.05} />;
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PinLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const seats = usePlayers((s) => s.players);
   const mode = usePlayers((s) => s.mode);
   const multi = useMemo(() => {
      const heroes = seats.map((p) => (p.heroId as HeroId) || "zuno");
      return createMultiRun(randomSeed(), levelId, heroes.length ? heroes : ["zuno", "riko"], mode);
      // a new shell run rebuilds the group
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [runId, levelId, mode, seats.length]);
   const anims = useMemo(() => multi.runs.map(() => createBallAnim()), [multi]);
   const clock = useMemo(() => createTableClock(multi.runs[0].table), [multi]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} level={levelId} />
         <TableFrame>
            <TableView key={`t${levelId}`} run={multi.runs[0]} clock={clock} />
            {multi.runs.map((run, i) => (
               <Ball key={i} run={run} anim={anims[i]} />
            ))}
            {multi.runs[0].table.boss ? <Rollo run={multi.runs[0]} /> : null}
         </TableFrame>
         <MultiSimulation multi={multi} />
         <FixedCamera />
      </JuiceLayer>
   );
}
