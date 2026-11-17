"use client";

// 2-4 heroes in the same arena against the same orbs (seat 0 owns them). The camera is the arena view,
// fixed on the beacon (players may still turn it with the camera keys).
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
import ArenaView from "./ArenaView";
import Mortar from "./Mortar";
import { Hero, createHeroAnim } from "./Hero";
import { ARENA_ORBIT, FOV, FOV_PORTRAIT, MP_YAW, orbitScale } from "./camera";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { DefenseLevel } from "./levels";

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
         s.jumpPressed = p.jumpPressed;
         s.actionPressed = p.actionPressed;
      }
      stepMulti(multi, dt * 1000, inputs);
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         players.update(i, { score: run.score, progress: run.score, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
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
   const orbit = useMemo(() => createOrbit({ ...ARENA_ORBIT, yaw: MP_YAW }), []);
   const pivot = useMemo(() => (out: { x: number; y: number; z: number }) => {
      out.x = 0;
      out.y = 0.5;
      out.z = -0.5;
      return true;
   }, []);
   return <OrbitCamera orbit={orbit} pivot={pivot} behind={() => MP_YAW} input={{ oneFinger: false, mouseButtons: [2] }} distanceScale={orbitScale(aspect) * 1.05} />;
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<DefenseLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const seats = usePlayers((s) => s.players);
   const mode = usePlayers((s) => s.mode);
   const multi = useMemo(() => {
      const heroes = seats.map((p) => (p.heroId as HeroId) || "riko");
      return createMultiRun(randomSeed(), levelId, heroes.length ? heroes : ["riko", "nami"], mode);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [runId, levelId, mode, seats.length]);
   const anims = useMemo(() => multi.runs.map(() => createHeroAnim()), [multi]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} arena={multi.runs[0].arena} level={levelId} />
         <ArenaView key={`a${levelId}`} run={multi.runs[0]} level={levelId} />
         {multi.runs[0].arena.boss ? <Mortar run={multi.runs[0]} /> : null}
         {multi.runs.map((run, i) => (
            <Hero key={i} run={run} anim={anims[i]} />
         ))}
         <MultiSimulation multi={multi} />
         <FixedCamera />
      </JuiceLayer>
   );
}
