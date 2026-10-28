"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstanced } from "../../core/render/DynamicInstanced";
import { Instanced } from "../../core/render/Instanced";
import { Model, InstancedModel, DynamicInstancedModel } from "../../core/assets";
import { ASSETS } from "./assets";
import { LEVELS } from "./levels";
import { JUNCTION_X, ORBS, pressState, laserOn, type FactoryRun } from "./rules";
function Plates({ run, versus }: {
   run: FactoryRun;
   versus: boolean;
}) {
   const spots = useMemo(() => [...run.board.turns.map((_, i) => ({ x: JUNCTION_X[i], z: 2, index: i })), { x: 6, z: 4, index: 4 }, { x: 0, z: -2, index: 5 }, ...(versus ? [{ x: 0, z: 5, index: 6 }] : [])], [run, versus]);
   const flat = useMemo(() => new Matrix4().makeRotationX(-Math.PI / 2), []);
   const wire = useMemo(() => run.board.turns.map((_, i) => ({ x: JUNCTION_X[i], y: 0.015, z: 1 })), [run]);
   return <>
     <Instanced spots={wire}><boxGeometry args={[0.035, 0.02, 2]}/><meshBasicMaterial color="#9b4b43"/></Instanced>
     <DynamicInstanced count={spots.length} tinted update={(i, m, c) => {
         const p = spots[i];
         m.copy(flat);
         m.setPosition(p.x, 0.035, p.z);
         const hint = run.simMs - run.lastUseful > 10000 && p.index < run.board.turns.length && run.board.turns[p.index] !== 0;
         c.set(p.index >= 5 ? "#facc15" : run.board.jamUntil[p.index] > run.simMs ? "#64748b" : hint && Math.sin(run.simMs / 150) > 0 ? "#ffe7bc" : "#ff6854");
      }}><ringGeometry args={[0.39, 0.59, 20]}/><meshBasicMaterial /></DynamicInstanced>
     <DynamicInstanced count={spots.length} update={(i, m) => {
         const p = spots[i];
         const turn = p.index < 4 ? run.board.turns[p.index] : run.board.secretTurn;
         m.makeRotationY(-(turn + 2) * Math.PI / 2);
         m.multiply(flat);
         m.setPosition(p.x, 0.055, p.z);
      }}><circleGeometry args={[0.24, 3]}/><meshBasicMaterial color="#fff1d6"/></DynamicInstanced>
   </>;
}
export function Course({ run, offset = 0, versus = false }: {
   run: FactoryRun;
   offset?: number;
   versus?: boolean;
}) {
   const cfg = LEVELS[run.level];
   const press = useRef<Group>(null);
   const pressRing = useRef<Mesh>(null);
   const cracked = useRef<Group>(null);
   const beam = useRef<Mesh>(null);
   const otherBeam = useRef<Mesh>(null);
   const vent = useRef<Mesh>(null);
   const boss = useRef<Group>(null);
   const tread = useRef<Group>(null), patrol = useRef<Group>(null), drone = useRef<Group>(null), arm = useRef<Group>(null);
   const exit = useRef<Mesh>(null);
   const belts = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -8 + i * 2, y: -0.6, z: 0 })).filter((v) => !JUNCTION_X.slice(0, cfg.junctions).includes(v.x)), [cfg.junctions]);
   const sideBelts = useMemo(() => [-2, 2].flatMap((z) => [-8, -6, -4, -2, 0, 2, 4, 6].map((x) => ({ x, y: -0.6, z }))), []);
   const catwalks = useMemo(() => [4, 6, 8].map((x) => ({ x, y: 1.64, z: -4, rotY: Math.PI / 2 })), []);
   const crates = useMemo(() => [[-8, -4], [-8, 5], [2, 5], [8, 5]].map(([x, z]) => ({ x, y: 0, z })), []);
   useFrame(() => {
      const ms = run.simMs;
      const state = pressState(ms);
      if (cracked.current)
         cracked.current.visible = !run.crateBroken;
      if (pressRing.current) {
         const mat = pressRing.current.material as MeshBasicMaterial;
         mat.color.set(state === "slam" ? "#fff2ce" : state === "warning" ? "#ff563b" : "#663f36");
         mat.opacity = state === "warning" ? 0.5 + 0.5 * Math.sin(ms / 55) : 0.65;
      }
      if (press.current)
         press.current.position.y = state === "slam" ? -0.65 : state === "warning" ? 0.1 + Math.sin(ms / 50) * 0.05 : 0;
      if (beam.current)
         beam.current.visible = laserOn(run);
      if (otherBeam.current)
         otherBeam.current.visible = laserOn(run, 1);
      if (vent.current)
         vent.current.scale.setScalar(run.boss?.step === "vulnerable" && run.boss.phase === 2 ? 1 + 0.08 * Math.sin(ms / 80) : 0.65);
      if (exit.current)
         exit.current.scale.y = run.board.charged >= cfg.cells && (!run.boss || run.boss.hp === 0) ? 1 : 0.12;
      if (tread.current)
         tread.current.position.x = -1 + Math.sin(ms / 1600) * 2;
      if (patrol.current)
         patrol.current.position.z = 2 + Math.sin(ms / 1800) * 2;
      if (drone.current)
         drone.current.position.x = 2 + Math.sin(ms / 1700) * 2;
      if (arm.current)
         arm.current.rotation.y = Math.sin(ms / 800) * 0.55;
      if (boss.current && run.boss) {
         const b = run.boss;
         boss.current.position.set(b.phase === 1 ? 6 - run.board.bossDragged : 6, b.step === "attack" ? Math.sin(b.stepMs / 100) * 0.12 : 0, b.phase === 2 ? -6 : b.phase === 1 ? 0 : -2.4);
         boss.current.scale.setScalar(b.hp === 0 ? Math.max(0.15, 1 - (b.defeatMs / 3000)) : 1);
         boss.current.rotation.z = b.flashMs > 0 ? Math.sin(ms / 20) * 0.06 : 0;
      }
   });
   return <group position-x={offset}>
     <InstancedModel asset={ASSETS.conveyor} spots={belts} fallback={null}/><InstancedModel asset={ASSETS.conveyor} spots={sideBelts} fallback={null}/>
     <DynamicInstancedModel asset={ASSETS.turntable} count={run.board.turns.length} update={(i, m) => {
         // Positive quarter-turns, eased over 350 ms; model and cell collision share the turn timer.
         const progress = Math.min(1, (run.simMs - run.board.turnedAt[i]) / 350);
         const angle = (run.board.turns[i] + 3 + progress) * Math.PI / 2;
         m.makeRotationY(-angle);
         m.setPosition(JUNCTION_X[i], -0.647, 0);
      }}/>

     <Plates run={run} versus={versus}/>
     <Model asset={ASSETS.turntable} position={[0, -0.647, -2]} scale={0.7}/>
     <InstancedModel asset={{ ...ASSETS.catwalk, stretch: [2.4, 1, 1] }} spots={catwalks} fallback={null}/>
     {/* The ramp is terrain; hero and boss catwalk use the exact same support function. */}
     <mesh position={[2, 0.96, -4]} rotation-z={Math.atan(0.5)} receiveShadow><boxGeometry args={[4.5, 0.1, 2]}/><meshStandardMaterial color="#644947" metalness={0.55} roughness={0.7}/></mesh>
     <InstancedModel asset={ASSETS.crate} spots={crates} fallback={null}/>
     <group ref={cracked} position={[-6, 0, -4]}><Model asset={ASSETS.crate} tint="#fa8d69"/></group>
     <Model asset={{ ...ASSETS.crate, id: "ghostCrate", material: { color: "#a78bfa", emissive: "#39265d" } }} position={[-4, 0, -4]}/>
     <group ref={press} position={[-1, 0, 0]}><Model asset={ASSETS.press}/></group>
     <mesh ref={pressRing} position={[-1, 0.02, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.55, 0.85, 20]}/><meshBasicMaterial color="#ff7446" transparent opacity={0.6}/></mesh>
     {cfg.lasers && <><Model asset={ASSETS.laser} position={[5, 0, 0]} rotation-y={Math.PI / 2}/><mesh ref={beam} position={[5, 0.8, 0]}><boxGeometry args={[0.06, 1.5, 2]}/><meshBasicMaterial color="#ff374e" transparent opacity={0.6}/></mesh></>}
     {cfg.lasers && <><Model asset={ASSETS.laser} position={[-3, 0, 0]} rotation-y={Math.PI / 2}/><mesh ref={otherBeam} position={[-3, 0.8, 0]}><boxGeometry args={[0.06, 1.5, 2]}/><meshBasicMaterial color="#ff374e" transparent opacity={0.6}/></mesh></>}
     {cfg.boss && <mesh ref={vent} position={[6.5, 2.04, -4]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.45, 0.75, 24]}/><meshBasicMaterial color="#ffbe74"/></mesh>}
     {cfg.arms && <group ref={arm} position={[0, 0, -2]}><Model asset={ASSETS.arm}/></group>}
     {run.level >= 2 && <group ref={tread} position={[-1, 0, 4.5]}><Model asset={ASSETS.tread}/></group>}
     {run.level >= 3 && <group ref={patrol} position={[5, 0, 2]}><Model asset={ASSETS.patrol}/></group>}
     {run.level >= 4 && <group ref={drone} position={[2, 1.2, -3]}><Model asset={ASSETS.drone}/></group>}
     {cfg.boss && <Model asset={ASSETS.press} position={[4, 0, 0]}/>}
     {cfg.boss && <group ref={boss} position={[6, 0, -2.4]}><Model asset={ASSETS.boss}/><mesh position={[0, 2.8, 0.75]} rotation-x={Math.PI / 2}><torusGeometry args={[0.45, 0.08, 8, 20]}/><meshBasicMaterial color="#ffb14d"/></mesh></group>}
     <DynamicInstancedModel asset={ASSETS.cell} count={cfg.cells} update={(i, m) => { const c = run.board.cells[i]; if (!c?.active)
      return false; m.makeTranslation(c.x, 0.12, c.z); }}/>
     <DynamicInstancedModel asset={ASSETS.gem} count={10} update={(i, m) => {
         if (i < 8) {
            if (run.collected[i])
               return false;
            const o = ORBS[i];
            m.makeRotationY(run.simMs / 800);
            m.setPosition(o.x, o.y - 0.23, o.z);
         }
         else {
            if (run.secrets.found[i - 7])
               return false;
            m.makeRotationY(run.simMs / 900);
            m.setPosition(i === 8 ? -4 : 7.6, i === 8 ? 0.6 : 2.4, -4);
         }
      }}/>

     <Model asset={ASSETS.cell} position={[8, 0, -1.5]} scale={2}/>
     <mesh ref={exit} position={[8.5, 0.05, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.6, 0.88, 24]}/><meshBasicMaterial color="#ffb254"/></mesh>
   </group>;
}
