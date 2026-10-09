"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { CAMERA, FOCUS, VIEW } from "./camera";
import { Castle } from "./Castle";
import { Cannon } from "./Cannon";
import { Goblins } from "./Goblins";
import { Markers } from "./Markers";
import { STARTS, TUNING, createInput, createRun, stepRun, threatenedCrew, type CastleRun } from "./rules";

const CLEAR_POINT = { x: 0, y: 0.3, z: -1.5 };

function setStat(key: string, value: number): void {
   const store = useArcadeStore.getState(); if (store.stats[key] !== value) store.setStat(key, value);
}
function publish(run: CastleRun): void {
   setStat("hp", run.hp); setStat("maxHP", run.maxHP); setStat("wave", run.wave + 1);
   setStat("reload", Math.ceil(Math.max(0, run.ready - run.time) * 10));
   setStat("rock", Math.ceil(Math.max(0, run.rock.ready - run.time) * 10));
   setStat("offer", run.offer ? 1 : 0); setStat("card1", run.cards[0]); setStat("card2", run.cards[1]);
   setStat("chosen", run.chosen + 1); setStat("banner", run.time - STARTS[run.wave] < TUNING.banner ? 1 : 0);
   const c = threatenedCrew(run); setStat("climb", c >= 0 ? Math.min(100, Math.ceil((run.time - run.crews[c].erected) * 50)) : 0);
   const s = useArcadeStore.getState(); if (s.level !== run.wave + 1) s.setLevel(run.wave + 1);
}
export default function Scene() {
   const [run] = useState(() => createRun(randomSeed())), [command] = useState(createInput);
   const input = useInput(), fx = useFx(), view = useFittedView(VIEW), { camera } = useThree();
   const phase = useArcadeStore((s) => s.phase), muted = useMuted();
   const [preferences] = useState(() => ({ coarse: typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }));
   const scratch = useMemo(() => ({ ray: new Raycaster(), uv: new Vector2(), p: new Vector3(), score: new Vector3(), plane: new Plane(new Vector3(0, 1, 0), 0) }), []);
   useEffect(() => { fx.warm("puff", "debris", "confetti", "score"); }, [fx]);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const loop = startLoop("ambient", { volume: 0.08 }); return () => loop.stop();
   }, [phase, muted]);
   useRunFrame((_state, dt) => {
      const i = input.current, s = useArcadeStore.getState();
      command.coarse = preferences.coarse; command.moveX = i.moveX; command.moveY = i.moveY;
      command.pressed.left = i.pressed.left; command.pressed.right = i.pressed.right;
      command.pressed.up = i.pressed.up; command.pressed.down = i.pressed.down;
      command.point = false; command.fire = i.jumpPressed; command.rock = i.actionPressed;
      command.choice = s.stats.pick || i.digit || 0; if (s.stats.pick) setStat("pick", 0);
      if (i.tapDown) {
         scratch.uv.set(i.tapDown.x, i.tapDown.y); scratch.ray.setFromCamera(scratch.uv, camera);
         if (scratch.ray.ray.intersectPlane(scratch.plane, scratch.p)) {
            command.point = true; command.x = scratch.p.x; command.z = scratch.p.z; command.fire = true;
         }
      }
      const score = run.score, killed = run.killed, impacts = run.impacts, launches = run.launches, damage = run.damageEvents, wave = run.wave, drops = run.drops;
      const erections = run.erections, upgrades = run.upgrades, spawns = run.spawns, cleared = run.cleared;
      const rockActive = run.rock.active;
      stepRun(run, command, dt); if (run.score !== score) s.addScore(run.score - score); publish(run);
      if (run.launches !== launches) playSfx("boom", { volume: 0.35 });
      if (run.drops !== drops) playSfx("whoosh", { volume: 0.25 });
      if (run.spawns !== spawns) playSfx("pop", { pitch: 1.5, volume: 0.08 });
      if (run.erections !== erections) playSfx("hit", { volume: 0.2 });
      if (run.upgrades !== upgrades) playSfx("chime", { volume: 0.3 });
      if (run.cleared !== cleared) fx.score(CLEAR_POINT, "+200");
      if (run.impacts !== impacts) { fx.burst("puff", run.lastImpact, 16); playSfx("thud", { volume: 0.25 }); }
      if (rockActive && !run.rock.active && run.crews[run.rock.crew].destroyed) fx.burst("debris", run.lastImpact, 12);
      if (run.killed !== killed) { scratch.score.set(run.lastImpact.x, 0.3, run.lastImpact.z); fx.score(scratch.score, "+20"); }
      if (run.damageEvents !== damage) { fx.shake(0.15); fx.burst("debris", run.lastDamage, 12); playSfx("hit", { volume: 0.25 }); }
      if (run.wave !== wave) playSfx("go", { pitch: 0.6, volume: 0.3 });
      if (run.end) {
         if (run.end === "win") { s.setScore(run.score); if (!preferences.reduced) fx.burst("confetti", FOCUS, 36); }
         if (run.end === "lose") fx.burst("debris", FOCUS, 16);
         s.end(run.end);
      }
   });
   return <>
      <CameraRig camera={CAMERA} follow={FOCUS} offset={view.offset} shift={view.shift} damping={5} />
      <Castle run={run} /><Goblins run={run} reduced={preferences.reduced} /><Cannon run={run} reduced={preferences.reduced} /><Markers run={run} />
   </>;
}
