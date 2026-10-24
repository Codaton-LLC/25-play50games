"use client";

// One simulation step per playing frame. Visuals read the run; they never call setState.
import { useEffect, useRef, useState } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";
import { aimFired } from "@/arcade3d/core/aim";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import { useFx, type FxApi } from "@/arcade3d/core/fx/FxLayer";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { markerBounds, placeMarker, type MarkerPlacement } from "@/arcade3d/core/hud/markerPlacement";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useSafeArea, type SafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { TEAM } from "./assets";
import Balls from "./Balls";
import { FIT, FOLLOW_Y, LOOK_AT } from "./camera";
import Kids from "./Kids";
import { createRun, pickTap, stepRun, type Run, type SimEvent, type StepInput } from "./rules";
import Yard from "./Yard";

const RAY = new Raycaster();
const NDC = new Vector2();
const LOOK = new Vector3();
const PROJ = new Vector3();
const PLACE: MarkerPlacement = { visible: false, x: 0, y: 0, angle: 0 };
const FX_POS = { x: 0, y: 0, z: 0 };
const TAP = [
   { id: 1, x: 0, y: 0, live: false },
   { id: 2, x: 0, y: 0, live: false },
   { id: 3, x: 0, y: 0, live: false },
   { id: 1, x: 0, y: 0, live: false },
   { id: 2, x: 0, y: 0, live: false },
   { id: 3, x: 0, y: 0, live: false },
];

function coarsePointer(): boolean {
   return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

function fillTaps(state: RootState, area: SafeArea, run: Run): void {
   const w = state.size.width;
   const h = state.size.height;
   const bounds = markerBounds({ ...area, width: w, height: h });
   state.camera.getWorldDirection(LOOK);
   const cam = state.camera.position;
   for (let i = 1; i <= 3; i++) {
      const kid = run.kids[i];
      const body = TAP[i - 1];
      const arrow = TAP[i + 2];
      body.live = false;
      arrow.live = false;
      if (!kid.present || !kid.alive) continue;
      const behind = (kid.x - cam.x) * LOOK.x + (FOLLOW_Y - cam.y) * LOOK.y + (kid.z - cam.z) * LOOK.z <= 0;
      PROJ.set(kid.x, FOLLOW_Y, kid.z).project(state.camera);
      body.x = ((PROJ.x + 1) / 2) * w;
      body.y = ((1 - PROJ.y) / 2) * h;
      body.live = !behind;
      placeMarker(PROJ.x, PROJ.y, behind, w, h, bounds, PLACE);
      if (PLACE.visible) {
         arrow.x = PLACE.x;
         arrow.y = PLACE.y;
         arrow.live = true;
      }
   }
}

function playEvent(fx: FxApi, e: SimEvent): void {
   FX_POS.x = e.x;
   FX_POS.y = e.y;
   FX_POS.z = e.z;
   if (e.kind === "tag") {
      playSfx("chime");
      fx.burst("puff", FX_POS, 10);
      FX_POS.y = 1.7;
      fx.score(FX_POS, e.n >= 400 ? "+400" : "+100", { color: "#f8fafc" });
   } else if (e.kind === "hurt") {
      playSfx("hit");
      fx.shake(0.35);
      fx.burst("snow", FX_POS, 8);
   } else if (e.kind === "throw") {
      playSfx("whoosh");
   } else if (e.kind === "scoop") {
      playSfx("thud", { pitch: 0.7 });
   } else if (e.kind === "crumble") {
      playSfx("thud", { pitch: 0.5 });
      fx.shake(0.2);
      fx.burst("snow", FX_POS, 12);
   } else if (e.kind === "splat" || e.kind === "down") {
      fx.burst("puff", FX_POS, 8);
   }
}

export default function Scene() {
   const view = useFittedView(FIT);
   const input = useInput();
   const area = useSafeArea();
   const areaRef = useRef(area);
   areaRef.current = area;
   const coarse = useState(coarsePointer)[0];
   const run = useState(() => createRun(randomSeed(), coarse))[0];
   const step = useRef<StepInput>({ moveX: 0, moveY: 0, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: Math.PI }).current;
   const aim = useRef({ moved: false, px: 0, py: 0 }).current;
   const follow = useRef({ x: 0, y: FOLLOW_Y, z: 6.2 }).current;
   const fx = useFx();
   const fxRef = useRef(fx);
   fxRef.current = fx;
   const won = useRef(false);
   const markers = useState<MarkerTarget[]>(() => [1, 2, 3].map((id) => ({ x: 0, y: 1.15, z: 0, hidden: true, color: TEAM[id] })))[0];
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);

   useEffect(() => { fx.warm("puff", "snow", "confetti", "score"); }, [fx]);

   useEffect(() => {
      if (phase !== "playing") return;
      const loop = startLoop("ambient", { volume: 0.12 });
      return () => loop.stop();
   }, [phase, muted]);

   useRunFrame((state, dt) => {
      const live = input.current;
      step.moveX = live.moveX;
      step.moveY = live.moveY;
      step.camYaw = view.yaw;
      step.scoop = live.action;
      step.fire = !run.coarse && aimFired(live, { jump: true });
      step.tapId = -1;
      const p = live.pointer;
      if (p.x !== aim.px || p.y !== aim.py) aim.moved = true;
      aim.px = p.x;
      aim.py = p.y;
      const player = run.kids[0];
      if (!run.coarse && aim.moved) {
         NDC.set(p.x, p.y);
         RAY.setFromCamera(NDC, state.camera);
         const origin = RAY.ray.origin;
         const dir = RAY.ray.direction;
         if (Math.abs(dir.y) > 1e-4) {
            const t = -origin.y / dir.y;
            if (t > 0) step.aimYaw = Math.atan2(origin.x + dir.x * t - player.x, origin.z + dir.z * t - player.z);
         }
      } else step.aimYaw = player.yaw;
      if (run.coarse && live.tapDown) {
         fillTaps(state, areaRef.current, run);
         const sx = ((live.tapDown.x + 1) / 2) * state.size.width;
         const sy = ((1 - live.tapDown.y) / 2) * state.size.height;
         step.tapId = pickTap(sx, sy, TAP);
      }
      stepRun(run, dt, step);
      const store = useArcadeStore.getState();
      if (run.scoreDelta) {
         store.addScore(run.scoreDelta);
         run.scoreDelta = 0;
      }
      store.setStat("time", Math.ceil(Math.max(0, 90 - run.time)));
      store.setStat("ammo", player.ammo);
      let rivals = 0;
      for (let i = 1; i < 4; i++) if (run.kids[i].present && run.kids[i].alive) rivals += 1;
      store.setStat("rivals", rivals);
      store.setStat("health", 5 - run.playerTags);
      const api = fxRef.current;
      for (let i = 0; i < run.eventCount; i++) playEvent(api, run.events[i]);
      run.eventCount = 0;
      for (let i = 1; i < 4; i++) {
         const kid = run.kids[i];
         const mark = markers[i - 1];
         mark.x = kid.x;
         mark.y = 1.15;
         mark.z = kid.z;
         mark.hidden = !kid.present || !kid.alive;
      }
      follow.x = player.x;
      follow.y = FOLLOW_Y;
      follow.z = player.z;
      if (run.endReason === "win" && !won.current) {
         won.current = true;
         FX_POS.x = player.x;
         FX_POS.y = 1.5;
         FX_POS.z = player.z;
         api.burst("confetti", FX_POS, 28);
      }
      if (run.endReason && store.phase === "playing") {
         store.setScore(run.score);
         store.end(run.endReason);
      }
   });

   useFrame(() => {
      follow.x = run.kids[0].x;
      follow.y = FOLLOW_Y;
      follow.z = run.kids[0].z;
   });

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, lookAt: LOOK_AT, fov: 45 }}
            follow={follow}
            followFraction={1}
            damping={5}
            offset={view.offset}
            shift={view.shift}
         />
         <Yard run={run} view={view} />
         <Kids run={run} />
         <Balls run={run} />
         <TargetMarkers targets={markers} />
      </>
   );
}
