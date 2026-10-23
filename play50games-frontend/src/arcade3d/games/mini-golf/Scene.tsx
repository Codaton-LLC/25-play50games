"use client";

// Mini Golf scene (the treasure-island pattern):
// - run state created once per run (GameShell remounts Scene for every run): a seeded course and a
//   plain RunState; the frame loop mutates them, never calls setState, never allocates;
// - one useRunFrame: input -> aim.ts (pull, keys, charge) -> rules.advanceRun -> syncStore, then the
//   feedback (core/fx, playSfx) on the frame's events and the preview's length;
// - visuals (Course, Windmill, Ball) only read the run and animate with useGameTime();
// - the camera: per displayed hole, the fixed whole-hole fit, or the gentle follow where the fixed
//   one would draw the ball under 10 px (looks.ts). A follow hole opens with an establishing shot
//   (the whole hole at the follow's yaw) until it has been open ESTABLISH_S of play or the player
//   touches the aim, then eases into the follow; the rig reads the offset and shift from mutable
//   arrays the frame loop writes (no setState per frame). One persistent CameraRig eases to the
//   next hole (the fly-over), cut with reduced motion. An edge arrow (core TargetMarkers) points at
//   the cup whenever it is off screen.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import type { FittedView } from "@/arcade3d/core/view";
import { createPuttAim, headingTo, resetPuttAim, stepPuttAim, worldHeading } from "./aim";
import { GolfBall, type AimView } from "./Ball";
import { HOLE_COUNT, heightAt, type Hole } from "./course";
import { Decor, Island, Sea } from "./Islands";
import { HUD_FEED } from "./hudFeed";
import { COLORS, ESTABLISH_S, FOLLOW_FRACTION, FOV, PITCH, establishView, fixedView, followViews, holeFocus, holeZ, minPxPerMetre, pickCamera } from "./looks";
import { BALL, CUP, previewLength } from "./physics";
import { TICK, advanceRun, createRun, currentHole, readiness, syncStore, type RunState } from "./rules";

const panAt = (x: number) => Math.max(-0.8, Math.min(0.8, x / 2));
const DROP_TICKS = TICK.drop * TICK.hz;
const ESTABLISH_TICKS = Math.round(ESTABLISH_S * TICK.hz);

/** The hole the camera shows: the next one once the ball has dropped (the fly-over starts). */
const shownHole = (run: RunState) => (run.phase === "holeOut" && run.outTicks >= DROP_TICKS ? Math.min(HOLE_COUNT - 1, run.hole + 1) : run.hole);

function holeName(par: number, strokes: number, pickedUp: boolean): string {
   if (pickedUp) return "Picked up";
   if (strokes === 1) return "Hole in one!";
   const d = strokes - par;
   return d <= -3 ? "Albatross" : d === -2 ? "Eagle" : d === -1 ? "Birdie" : d === 0 ? "Par" : d === 1 ? "Bogey" : `+${d}`;
}

interface CamFit {
   /** the hole this fit is for */
   hole: number;
   /** the view the camera holds (the fixed fit, or the follow) */
   view: FittedView;
   follow: boolean;
   /** a follow hole's establishing shot: the whole hole at the follow's yaw */
   establish: FittedView | null;
}

/** Fits the camera for one hole (keyed by hole: each gets its own yaw pick) and reports it. */
function HoleFit({ hole, onFit }: { hole: Hole; onFit: (fit: CamFit) => void }) {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const fixedOpts = fixedView(hole);
   const follows = followViews(hole);
   const a = follows[0];
   const b = follows[follows.length - 1];
   const fixed = useFittedView(fixedOpts);
   const followA = useFittedView(a.options);
   const followB = useFittedView(b.options);
   const pick = useMemo(
      () => pickCamera(minPxPerMetre(fixedOpts, fixed, width, height), [minPxPerMetre(a.options, followA, width, height, a.window), minPxPerMetre(b.options, followB, width, height, b.window)]),
      [fixedOpts, fixed, a, followA, b, followB, width, height]
   );
   const follow = pick === 0 ? followA : followB;
   const establish = useFittedView(establishView(hole, follow.yaw));
   useEffect(() => onFit(pick < 0 ? { hole: hole.index, view: fixed, follow: false, establish: null } : { hole: hole.index, view: follow, follow: true, establish }), [onFit, hole, pick, fixed, follow, establish]);
   return null;
}

/** Development measurements only (?perf=1, like tower-climb's probe): the run, the camera's yaw and the drawn px of the ball and the cup, for the headless playtest. */
function Probe({ run, scratch }: { run: RunState; scratch: { yaw: number; follow: boolean; est: boolean } }) {
   const camera = useThree((s) => s.camera);
   const size = useThree((s) => s.size);
   const [probe] = useState(() => ({ run, yaw: 0, follow: false, est: false, ballPx: 0, cupPx: 0, cupX: 0, cupY: 0, ball: new Vector3(), right: new Vector3(), p: new Vector3() }));
   useEffect(() => {
      const w = window as typeof window & { __miniGolf?: typeof probe };
      w.__miniGolf = probe;
      return () => {
         if (w.__miniGolf === probe) delete w.__miniGolf;
      };
   }, [probe]);
   useFrame(() => {
      probe.yaw = scratch.yaw;
      probe.follow = scratch.follow;
      probe.est = scratch.est;
      const h = currentHole(run);
      const z0 = holeZ(run.hole);
      probe.right.setFromMatrixColumn(camera.matrixWorld, 0);
      const px = (x: number, y: number, z: number, r: number) => {
         probe.ball.set(x, y, z).project(camera);
         probe.p.set(x, y, z).addScaledVector(probe.right, r).project(camera);
         return (Math.hypot((probe.p.x - probe.ball.x) * size.width, (probe.p.y - probe.ball.y) * size.height) / 2) * 2;
      };
      probe.ballPx = px(run.ball.x, run.ball.y, z0 + run.ball.z, BALL.drawnRadius);
      probe.cupPx = px(h.cup.x, heightAt(h, h.cup.x, h.cup.z) ?? 0, z0 + h.cup.z, CUP.drawnRadius);
      // the cup's centre on screen (CSS px), from the last px() projection
      probe.cupX = ((probe.ball.x + 1) / 2) * size.width;
      probe.cupY = ((1 - probe.ball.y) / 2) * size.height;
   });
   return null;
}

export default function Scene() {
   const input = useInput();
   const fx = useFx();
   // a new course every run: GameShell remounts the Scene (and its game time) on start and retry
   const [run] = useState(() => createRun(randomSeed()));
   const [aim] = useState(createPuttAim);
   const [preview] = useState<AimView>(() => ({ on: false, dx: 0, dz: -1, length: 0, power: 0.5 }));
   const [scratch] = useState(() => ({
      focus: { x: 0, y: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      // the rig's offset and lens shift, written by the frame loop (establishing shot or follow)
      offset: [0, 8, 6] as [number, number, number],
      shift: [0, 0] as [number, number],
      fit: null as CamFit | null,
      yaw: 0,
      follow: false,
      est: false,
      /** the hole whose establishing shot the player cut short (any aim input) */
      skipped: -1,
      lastThud: -1,
      aimedFor: -1,
      fitted: false,
   }));
   const [cup] = useState<MarkerTarget[]>(() => [{ x: 0, y: 0, z: 0, hidden: true }]);
   const [fit, setFit] = useState<CamFit | null>(null);
   const [cut, setCut] = useState(0);
   const hole = useArcadeStore((s) => (s.stats.hole ?? 1) - 1);
   const camHole = useArcadeStore((s) => s.stats.camHole ?? 0);
   const reduced = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
   const debug = useMemo(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1", []);
   const onFit = useCallback((f: CamFit) => setFit(f), []);
   scratch.fit = fit;
   scratch.yaw = fit?.view.yaw ?? 0;
   scratch.follow = fit?.follow ?? false;

   useEffect(() => fx.warm("sparkle", "splash", "confetti", "puff", "score"), [fx]);
   useEffect(() => {
      useArcadeStore.getState().setStat("camHole", 0);
      syncStore(run, useArcadeStore.getState());
   }, [run]);

   // the ambient loop while the run is live, the windmill's rotor on hole 4; the shell stops loops on pause, the end and mute
   const live = useArcadeStore((s) => s.phase === "countdown" || s.phase === "playing");
   const muted = useMuted();
   const windmill = !!run.course[hole]?.windmill;
   useEffect(() => {
      if (!live || muted) return;
      const ambient = startLoop("ambient", { volume: 0.15 });
      const rotor = windmill ? startLoop("rotor", { volume: 0.12, pitch: 0.5 }) : null;
      return () => {
         ambient.stop();
         rotor?.stop();
      };
   }, [live, muted, windmill]);

   // the game: aim, putt, ball, holes, score, end. Only while "playing", before every visual.
   useRunFrame((_state, dt) => {
      const h = currentHole(run);
      const b = run.ball;
      // each stroke starts aimed at the cup (a new hole, a stroke that ended)
      const strokeKey = run.hole * 100 + run.strokes;
      if (run.phase === "aim" && scratch.aimedFor !== strokeKey) {
         scratch.aimedFor = strokeKey;
         resetPuttAim(aim, headingTo(b.x, b.z, h.cup.x, h.cup.z), scratch.yaw);
      }
      // any aim input cuts the establishing shot short (a putt may be taken during it)
      const inp = input.current;
      if (scratch.est && (inp.drag.active || inp.moveX !== 0 || inp.moveY !== 0 || inp.jump || inp.action || inp.pressed.left || inp.pressed.right || inp.pressed.up || inp.pressed.down)) scratch.skipped = run.hole;
      const fire = stepPuttAim(aim, inp, dt, PITCH);
      const psi = worldHeading(aim.axes.x, scratch.yaw);
      advanceRun(run, dt, psi, aim.axes.y, fire);
      const store = useArcadeStore.getState();
      syncStore(run, store);
      store.setStat("camHole", shownHole(run));

      // the preview and the HUD
      const ready = readiness(run);
      preview.on = run.phase === "aim" && !run.pending.on;
      preview.dx = Math.sin(psi);
      preview.dz = -Math.cos(psi);
      preview.power = aim.shown;
      preview.length = preview.on ? previewLength(currentHole(run), run.ball, preview.dx, preview.dz, BALL.vMax * aim.shown) : 0;
      HUD_FEED.power = aim.shown;
      HUD_FEED.ready = ready;

      // feedback on this frame's events
      const ev = run.events;
      const at = scratch.at;
      const z0 = holeZ(run.hole);
      at.x = b.x;
      at.y = b.y;
      at.z = z0 + b.z;
      if (ev.putt > 0) {
         playSfx("click", { pitch: 0.7 + 0.8 * ev.putt, pan: panAt(b.x) });
         fx.burst("puff", at, 4);
      }
      if (ev.railHit >= 0.3 && run.time - scratch.lastThud >= 0.06) {
         scratch.lastThud = run.time;
         playSfx("thud", { pitch: 1.4, volume: Math.min(1, 0.25 + ev.railHit / 3), pan: panAt(ev.railX) });
      }
      if (ev.movingHit) playSfx("thud", { pitch: 0.8 });
      if (ev.lipOut) playSfx("click", { pitch: 1.8 });
      if (ev.pipeIn || ev.pipeOut) playSfx("whoosh", { pan: panAt(b.x) });
      if (ev.water) {
         playSfx("splash");
         fx.burst("splash", at, 14);
         at.y += 0.6;
         fx.score(at, "Water +1", { color: "#bae6fd" });
      }
      if (ev.holeOut >= 0) {
         const par = h.par;
         const s = ev.holeStrokes;
         at.x = h.cup.x;
         at.y = 0.6 + (b.y - BALL.radius);
         at.z = z0 + h.cup.z;
         fx.score(at, `${holeName(par, s, ev.pickedUp)}${ev.holeScore > 0 ? ` +${ev.holeScore}` : ""}`, { color: s < par ? "#86efac" : "#fff7d6" });
         if (!ev.pickedUp) {
            playSfx("pop");
            fx.burst("sparkle", at, 14);
            if (s < par) playSfx("combo", { pitch: Math.min(1.6, 1 + 0.15 * (par - s)) });
            else if (s === par) playSfx("chime");
         }
         if (s === 1) {
            playSfx("pickup");
            fx.burst("confetti", at, 40);
         }
         if (ev.win) playSfx("win");
      }
   });

   // the camera's look-at point, offset and shift, and the cup's arrow, before the rig moves the camera.
   // The establishing shot runs on the rules' tick clock (holeTicks: play time only, pause-safe).
   useFrame(() => {
      const d = shownHole(run);
      const h = run.course[d];
      const c = holeFocus(h);
      const f = scratch.focus;
      const est = !!scratch.fit?.establish && (d !== run.hole || (run.phase === "aim" && run.strokes === 0 && run.holeTicks < ESTABLISH_TICKS && scratch.skipped !== run.hole));
      if (est !== scratch.est) {
         scratch.est = est;
         if (reduced) setCut((k) => k + 1); // a cut, once per change, never per frame
      }
      const view = est ? scratch.fit!.establish! : scratch.fit?.view;
      if (view) {
         scratch.offset[0] = view.offset[0];
         scratch.offset[1] = view.offset[1];
         scratch.offset[2] = view.offset[2];
         scratch.shift[0] = view.shift[0];
         scratch.shift[1] = view.shift[1];
      }
      f.x = c.x;
      f.y = 0;
      f.z = holeZ(d) + c.z;
      if (scratch.follow && !est) {
         const from = d === run.hole ? run.ball : h.tee;
         f.x += FOLLOW_FRACTION * (from.x - c.x);
         f.z += FOLLOW_FRACTION * (from.z - c.z);
      }
      // the arrow to the cup (TargetMarkers draws it only while the cup is off screen)
      const now = currentHole(run);
      const t = cup[0];
      t.x = now.cup.x;
      t.y = heightAt(now, now.cup.x, now.cup.z) ?? 0;
      t.z = holeZ(run.hole) + now.cup.z;
      t.hidden = est || d !== run.hole || (run.phase !== "aim" && run.phase !== "moving");
   }, FRAME_PRIORITY.camera - 0.05);

   const shown = run.course[camHole] ?? run.course[0];
   const holes = useMemo(() => run.course.slice(hole, hole + 2), [run, hole]);
   // each hole's camera yaw (its decor keeps off the far side); a hole not fitted yet keeps 0
   const [yaws] = useState(() => new Array<number>(HOLE_COUNT).fill(0));
   if (fit) yaws[fit.hole] = fit.view.yaw;
   const yawKey = `${yaws[hole] ?? 0},${yaws[hole + 1] ?? 0}`;
   const holeYaws = useMemo(() => yawKey.split(",").map(Number), [yawKey]);
   if (fit && !scratch.fitted) {
      // the first fit: the rig starts on the shot it shows first (the establishing shot on a follow hole)
      const v = fit.establish ?? fit.view;
      scratch.offset.splice(0, 3, ...v.offset);
      scratch.shift.splice(0, 2, ...v.shift);
      scratch.fitted = true;
   }
   return (
      <>
         <HoleFit key={camHole} hole={shown} onFit={onFit} />
         {fit && (
            <CameraRig
               key={reduced ? `cut-${camHole}-${cut}` : "rig"}
               camera={{ position: scratch.offset, lookAt: [0, 0, 0], fov: FOV }}
               follow={scratch.focus}
               offset={scratch.offset}
               shift={scratch.shift}
               damping={3}
            />
         )}
         <Sea />
         {holes.map((h) => (
            <Island key={h.index} hole={h} run={run} />
         ))}
         <Decor holes={holes} yaws={holeYaws} />
         <GolfBall run={run} aim={preview} />
         <TargetMarkers targets={cup} color={COLORS.accent} />
         {debug && <Probe run={run} scratch={scratch} />}
      </>
   );
}
