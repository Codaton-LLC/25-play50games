"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, type Group, type Mesh } from "three";
import { Model, InstancedModel, DynamicInstancedModel } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { bossTimeScale } from "../../menu2/boss/boss";
import { VOLT_EEL } from "./progression";
import { orbNeeded } from "./multiplayer";
import { ASSETS } from "./assets";
import { cablePoint, deckPoint, type ZipRun } from "./rules";
import type { ZipLevel } from "./levels";

// All rope tubes share one geometry and material: one draw for the entire course.
function ropes(c: ZipLevel) {
   const vertices: number[] = [], indices: number[] = [];
   for (let s = 0; s < c.sections; s++) for (let lane = 0; lane < (s === 1 ? 5 : 2); lane++) {
      if (c.id === 1 && s < 2 && lane === 1) continue;
      const base = vertices.length / 3;
      for (let k = 0; k <= 48; k++) {
         const p = cablePoint(c, s, lane, k / 48);
         for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; vertices.push(p.x + Math.cos(a) * 0.045, p.y + Math.sin(a) * 0.045, p.z); }
      }
      for (let k = 0; k < 48; k++) for (let j = 0; j < 6; j++) {
         const a = base + k * 6 + j, b = base + k * 6 + (j + 1) % 6;
         indices.push(a, b, a + 6, b, b + 6, a + 6);
      }
   }
   const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function Landing({ run, section }: { run: ZipRun; section: number }) {
   const group = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   useFrame(() => {
      const p = deckPoint(run.cfg, section, run.ms);
      if (group.current) group.current.position.set(p.x, p.y, p.z);
      if (ring.current) ring.current.scale.setScalar(1 + (section === run.section ? Math.max(0, run.t - 0.6) : 0));
   });
   return <group ref={group}>
      <Model asset={ASSETS.deck} position={[0, -0.5, 0]} />
      <Model asset={ASSETS.mat} position={[0, 0.05, 0]} />
      {[2.35, 1.65, 0.85].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.36 + i * 0.008, 0]} ref={i === 2 ? ring : undefined}>
         <ringGeometry args={[r - 0.12, r, 32]} /><meshBasicMaterial color={["#fb923c", "#fde68a", "#4ade80"][i]} side={2} />
      </mesh>)}
   </group>;
}
function Orbs({ run, runs }: { run: ZipRun; runs: readonly ZipRun[] }) {
   return <DynamicInstancedModel asset={ASSETS.orb} count={run.cfg.sections * 4} update={(index, matrix) => {
      const section = Math.floor(index / 4), k = index % 4;
      if (!orbNeeded(runs, index) || !runs.some((r) => !r.ended && (r.section === section || r.section + 1 === section))) return false;
      const lane = run.level === 1 && section < 2 ? 0 : k < 2 ? 0 : 1;
      const p = cablePoint(run.cfg, section, lane, 0.22 + k * 0.16);
      matrix.makeRotationY(run.ms / 750); matrix.setPosition(p.x, p.y - 1.3, p.z);
   }} />;
}
function Boss({ run, owner = 0 }: { run: ZipRun; owner?: number }) {
   const ref = useRef<Group>(null);
   const cue = useRef<Mesh>(null);
   const time = useGameTime();
   const death = useRef({ elapsed: 0, fall: 0 });
   useFrame(() => {
      if (!ref.current || !run.boss) return;
      const b = run.boss;
      ref.current.visible = run.section >= 2 && b.step !== "done";
      const p = cablePoint(run.cfg, run.section, b.step === "vulnerable" ? run.lane : run.electricLane, b.phase === 0 ? 0.54 : 0.9, run.ms);
      ref.current.position.set(p.x + owner * 0.28, p.y - 0.8 + Math.sin(run.ms / 320) * 0.3, p.z - 1);
      ref.current.rotation.set(0, b.phase === 1 ? run.ms / 1500 : Math.PI / 2, b.phase === 2 ? Math.sin(run.ms / 300) * 0.2 : 0);
      ref.current.scale.setScalar(b.flashMs > 0 ? 1.12 : 1);
      if (cue.current) { cue.current.scale.setScalar(b.step === "vulnerable" ? 1.35 : 1); cue.current.rotation.z = run.ms / 500; }
      if (b.hp === 0) {
         death.current.elapsed += time.delta * 1000;
         const scale = bossTimeScale({ ...b, defeatMs: death.current.elapsed }, VOLT_EEL);
         death.current.fall += time.delta * scale * 4;
         ref.current.position.y -= death.current.fall;
         ref.current.rotation.z += death.current.fall * 0.25;
         ref.current.scale.setScalar(Math.max(0.01, 1 - death.current.fall * 0.14));
      }
   });
   return <group ref={ref}><Model asset={ASSETS.boss} /><mesh ref={cue} position={[0, 0.2, 0.8]}><torusGeometry args={[0.7 + owner * 0.1, 0.07, 8, 24]} /><meshBasicMaterial color={["#38bdf8", "#f472b6", "#a3e635", "#fbbf24"][owner % 4]} /></mesh></group>;
}
function Details({ run, markers = true }: { run: ZipRun; markers?: boolean }) {
   const gull = useRef<Group>(null), signals = useRef<Group>(null), wall = useRef<Group>(null), storm = useRef<Group>(null);
   const bell = deckPoint(run.cfg, run.cfg.sections - 1, 0);
   const high = cablePoint(run.cfg, 1, 2, 0.52), gate = cablePoint(run.cfg, 1, 4, 0.45), cracked = cablePoint(run.cfg, 1, 3, 0.48);
   useFrame(() => {
      if (gull.current) {
         const p = cablePoint(run.cfg, run.section, run.lane, 0.6, run.ms);
         gull.current.visible = run.cfg.moving;
         gull.current.position.set(p.x + Math.sin(run.ms / 650) * 2, p.y - 0.7, p.z);
         gull.current.rotation.z = Math.sin(run.ms / 120) * 0.18;
      }
      if (signals.current) { signals.current.visible = !(run.heroId === "vexa" && run.powerMs > 0); signals.current.rotation.z = Math.sin(run.ms / 400) * 0.08; }
      if (wall.current) wall.current.visible = !run.wallBroken;
      if (storm.current) {
         const p = cablePoint(run.cfg, run.section, run.boss && run.section === 2 ? run.electricLane : Math.floor(run.ms / 2400) % 2, 0.4);
         storm.current.position.set(p.x, p.y - 0.6, p.z);
         storm.current.visible = run.section > 0;
         storm.current.scale.setScalar(1 + Math.sin(run.ms / 70) * 0.1);
      }
   });
   return <>
      <group ref={gull}><Model asset={ASSETS.gull} /></group>
      {markers && <>
      <Model asset={ASSETS.bell} position={[bell.x, bell.y + 0.55, bell.z]} />
      <Model asset={ASSETS.orb} position={[high.x, high.y - 1.2, high.z]} />
      <group ref={wall} position={[cracked.x, cracked.y - 2, cracked.z]} scale={[0.35, 0.25, 0.15]}><Model asset={ASSETS.tower} tint="#fb7185" /></group>
      <group ref={signals} position={[gate.x, gate.y - 1.2, gate.z]}><mesh><torusGeometry args={[1.1, 0.07, 6, 24]} /><meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1} /></mesh></group>
      </>}
      <group ref={storm}><mesh rotation={[0, 0, 0.4]}><torusGeometry args={[0.65, 0.08, 6, 12]} /><meshBasicMaterial color="#d8b4fe" /></mesh></group>
   </>;
}
export function Course({ run, runs = [run] }: { run: ZipRun; runs?: readonly ZipRun[] }) {
   const [section, setSection] = useState(run.section);
   const [spanKey, setSpanKey] = useState(() => runs.map((r) => r.section).join(","));
   useFrame(() => {
      const next = runs.map((r) => r.section).join(","); if (next !== spanKey) setSpanKey(next);
      if (section !== run.section) setSection(run.section);
   });
   const geometry = useMemo(() => ropes(run.cfg), [run.cfg]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   const active = Array.from({ length: run.cfg.sections }, (_, i) => i).filter((i) => runs.some((r) => i === r.section || i === r.section + 1));
   const towers = useMemo(() => Array.from({ length: run.cfg.sections + 1 }, (_, s) => ({ x: 5.5, y: 24 - s * 2 - 4, z: -s * (run.cfg.length + 8) })), [run.cfg]);
   const forest = useMemo(() => towers.map((p, i) => ({ ...p, x: i % 2 ? -15 : 16, y: p.y - 10, scale: 1.4 })), [towers]);
   const stacks = useMemo(() => [
      ...towers.map((p) => ({ ...p, y: p.y - 14, scale: 1.6 })),
      ...(run.level > 2 ? forest.map((p) => ({ ...p, y: p.y - 8 })) : []),
   ], [towers, forest, run.level]);
   const beam = useRef<Group>(null);
   const light = useMemo(() => ({ time: { value: 0 }, anchorZ: { value: 0 } }), []);
   useFrame(() => {
      light.time.value = run.ms / 1800; light.anchorZ.value = -section * (run.cfg.length + 8);
      if (beam.current) { beam.current.rotation.y = run.ms / 1800; beam.current.position.set(5.5, 26 - section * 2, -section * (run.cfg.length + 8)); }
   });
   const start = cablePoint(run.cfg, section, 0, 0); start.y -= 2.15;
   return <>
      <mesh geometry={geometry}>{run.cfg.night ? <shaderMaterial uniforms={light}
         vertexShader="varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}"
         fragmentShader="varying vec3 world;uniform float time;uniform float anchorZ;void main(){float angle=atan(-(world.z-anchorZ),world.x-5.5);float beam=pow(max(0.,cos(angle-time)),36.);gl_FragColor=vec4(mix(vec3(.07,.13,.23),vec3(.65,.95,1.),beam),1.);}" /> :
         <meshStandardMaterial color="#647c8d" metalness={0.65} roughness={0.35} emissive="#38bdf8" emissiveIntensity={0.04} />}</mesh>
      <Model asset={ASSETS.deck} position={[start.x, start.y - 0.5, start.z]} />
      <InstancedModel asset={ASSETS.tower} spots={towers} fallback={null} />
      <InstancedModel asset={ASSETS.rock} spots={stacks} fallback={null} />
      {run.level <= 2 && <InstancedModel asset={ASSETS.canopy} spots={forest} fallback={null} />}
      {active.map((s) => <group key={s}>
         <Landing run={run} section={s} />
      </group>)}
      <Orbs run={run} runs={runs} />
      <group ref={beam}><mesh rotation={[0, 0, -Math.PI / 2]} position={[12, 0, 0]}><coneGeometry args={[6, 26, 24, 1, true]} /><meshBasicMaterial color="#dff9ff" transparent opacity={0.055} depthWrite={false} side={2} /></mesh></group>
      {runs.map((r, i) => r.boss && <Boss key={i} run={r} owner={i} />)}
      {runs.map((r, i) => <Details key={i} run={r} markers={r === run} />)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, -180]}><planeGeometry args={[2000, 2000]} /><meshStandardMaterial color={run.cfg.night ? "#0c2745" : "#238dba"} metalness={0.45} roughness={0.24} /></mesh>
   </>;
}
