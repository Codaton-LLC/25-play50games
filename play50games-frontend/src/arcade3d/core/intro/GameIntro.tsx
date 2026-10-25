"use client";

// The intro's camera. Mount inside the Scene. It writes the camera only while the intro runs,
// at a priority just after CameraRig, into vectors allocated once. No postprocessing, and the
// quality tier does not change the timeline (introDurations ignores it).
// A skip sets the phase to done between frames: the session listener places the play camera in
// that same turn, so the pose is already there if the shell unmounts this component when `ready`.
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { FRAME_PRIORITY, clampFrameDt } from "../frameLoop";
import {
   cameraProgress,
   heroProgress,
   sampleIntroCamera,
   createIntroSpline,
   type IntroCameraPose,
   type IntroKeyframe,
   type IntroSession,
} from "./introMachine";

/** After CameraRig (-0.25), before the shake pass (-0.2) and pose drivers (-0.125). */
const INTRO_CAMERA_PRIORITY = FRAME_PRIORITY.camera + 0.02;

export interface GameIntroProps {
   session: IntroSession;
   /** World-space shots. Keep the array stable across renders. The spline ends on `playCamera`. */
   keyframes: readonly IntroKeyframe[];
   /** The pose the play camera has when the run starts. `t = 1` copies these numbers. */
   playCamera: IntroKeyframe;
   /** Written every frame with the landing timeline, 0..1. Read it from a pose driver. */
   hero?: MutableRefObject<number>;
   /** Called when the landing timeline changes. The game moves its own hero. */
   onHero?: (progress: number) => void;
}

export function GameIntro({ session, keyframes, playCamera, hero, onHero }: GameIntroProps) {
   const camera = useThree((state) => state.camera);
   const spline = useMemo(() => createIntroSpline(keyframes, playCamera), [keyframes, playCamera]);
   const pose = useMemo<IntroCameraPose>(() => ({ position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } }), []);
   const look = useMemo(() => new Vector3(), []);
   const heroSent = useRef(Number.NaN);
   const settled = useRef(false);
   const heroRef = useRef(hero);
   const onHeroRef = useRef(onHero);
   heroRef.current = hero;
   onHeroRef.current = onHero;

   const place = (t: number) => {
      sampleIntroCamera(spline, session.state.variant, t, pose);
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      look.set(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      camera.lookAt(look);
      const landing = heroProgress(session.state);
      const heroSlot = heroRef.current;
      if (heroSlot) heroSlot.current = landing;
      const notify = onHeroRef.current;
      if (notify && landing !== heroSent.current) {
         heroSent.current = landing;
         notify(landing);
      }
   };

   // Skip runs outside the frame loop. Place the play camera before React paints the unmount.
   useLayoutEffect(() => {
      settled.current = false;
      return session.subscribe(() => {
         if (session.state.phase !== "done" || settled.current) return;
         settled.current = true;
         place(1);
      });
      // place reads refs and the memoised pose; spline/camera/session identity is the subscription.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [session, camera, spline]);

   useFrame((_, delta) => {
      if (settled.current) return;
      if (session.state.phase !== "done") session.advance(clampFrameDt(delta) * 1000);
      // advance() publishes done, and the listener above already placed the play camera
      if (settled.current) return;
      place(cameraProgress(session.state));
      if (session.state.phase === "done") settled.current = true;
   }, INTRO_CAMERA_PRIORITY);

   return null;
}
