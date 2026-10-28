"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, Quaternion, Vector3, type Group } from "three";
import { DynamicInstancedModel, Model } from "../../core/assets";
import { DynamicInstanced } from "../../core/render/DynamicInstanced";
import { bossTimeScale } from "../../menu2/boss/boss";
import { ASSETS, GLB_BOUNDS } from "./assets";
import { DIRS, fanDir, fanX, finishZ, liftTop, roomStart, type WindRun } from "./rules";
import { GALE } from "./progression";

export const COLORS = { steel: "#253c50", floor: "#538095", edge: "#94e4eb", wind: "#70f2eb", storm: "#8b5cf6", orb: "#ffd97a" };
export function Course({ run: r }: { run: WindRun }) {
   const tools = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3(), axis: new Vector3(0, 0, 1), d: new Vector3() }), []);
   const near = (z: number) => Math.abs(z - r.hero.z) < 29;
   const put = (m: Matrix4, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, yaw = 0) => {
      tools.p.set(x, y, z); tools.s.set(sx, sy, sz); tools.q.setFromAxisAngle(tools.d.set(0, 1, 0), yaw); m.compose(tools.p, tools.q, tools.s);
   };
   const boss = useRef<Group>(null);
   const storm = useRef<Group>(null);
   const visual = useRef(0);
   useFrame((_, dt) => {
      visual.current += Math.min(0.1, dt) * (r.boss ? bossTimeScale(r.boss, GALE) : 1);
      if (boss.current && r.boss) {
         boss.current.visible = r.escapeAt < 0 && near(-14);
         boss.current.position.y = r.boss.defeatMs >= 0 ? -r.boss.defeatMs / 450 : Math.sin(visual.current * 2) * 0.15;
         boss.current.rotation.z = r.boss.flashMs > 0 ? Math.sin(visual.current * 60) * 0.08 : 0;
      }
      if (storm.current) {
         storm.current.position.set(0, r.hero.y + 2, r.stormZ);
         storm.current.visible = r.stormMs > 30000 || r.escapeAt >= 0;
      }
   });
   return <>
      {/* Terrain decks use the collision footprint exactly; every mechanism is a GLB. */}
      <DynamicInstanced count={r.platforms.length} update={(i, m) => {
         const p = r.platforms[i]; if (p.lift || !near(p.z)) return false;
         put(m, p.x, p.y - 0.45, p.z, p.hw * 2, 0.9, p.hd * 2);
      }}><boxGeometry /><meshStandardMaterial color={COLORS.floor} roughness={0.72} metalness={0.3} /></DynamicInstanced>
      <DynamicInstanced count={r.platforms.length * 2} update={(i, m) => {
         const p = r.platforms[Math.floor(i / 2)]; if (p.lift || !near(p.z)) return false;
         put(m, p.x + (i % 2 ? -1 : 1) * (p.hw - 0.1), p.y + 0.035, p.z, 0.08, 0.06, p.hd * 2);
      }}><boxGeometry /><meshBasicMaterial color={COLORS.edge} /></DynamicInstanced>
      <DynamicInstancedModel asset={ASSETS.fan} count={r.fans.length} update={(i, m) => {
         const f = r.fans[i]; if (!near(f.z)) return false;
         put(m, fanX(f, r.ms), f.y - 0.05, f.z + 0.8, 1, 1, 1, fanDir(f, r.ms) === 2 ? Math.PI / 2 : fanDir(f, r.ms) === 3 ? 0 : Math.PI);
      }} />
      <DynamicInstancedModel asset={ASSETS.vent} count={r.gates.length} tinted update={(i, m, color) => {
         const g = r.gates[i]; if (!near(g.z) || g.open) return false;
         const c = { riko: "#ef4444", nami: "#3b82f6", kiro: "#4ade80", zuno: "#fde047", vexa: "#c084fc" };
         color.set(c[g.hero]); put(m, g.x, g.y, g.z, 0.6, 0.6, 0.6);
      }} />
      <DynamicInstancedModel asset={ASSETS.lift} count={r.platforms.length} update={(i, m) => {
         const p = r.platforms[i]; if (!p.lift || !near(p.z)) return false;
         const height = ASSETS.lift.scale! * GLB_BOUNDS.m2FanLiftPlatform.size[1];
         put(m, p.x, liftTop(r, p) - height, p.z);
      }} />
      <DynamicInstancedModel asset={ASSETS.post} count={r.config.rooms + 1} update={(i, m) => {
         const goal = i === r.config.rooms;
         const z = goal ? finishZ(r.level) + 1.2 : roomStart(r, i) - 15;
         if (!near(z)) return false;
         put(m, goal ? 0 : -4, goal ? i * 6 : i * 6 + 6, z);
      }} />
      <DynamicInstancedModel asset={ASSETS.tube} count={r.config.rooms * 2} update={(i, m) => {
         const room = Math.floor(i / 2), z = roomStart(r, room) - 9; if (!near(z)) return false;
         put(m, i % 2 ? 17 : -17, room * 6 - 9, z, 1.1, 1.1, 1.1, i % 2 ? 0.4 : -0.4);
      }} />
      <DynamicInstancedModel asset={ASSETS.crate} count={r.config.boss ? 3 : r.config.rooms} update={(i, m) => {
         if (r.config.boss) {
            const c = r.crates[i]; if (c.delivered || r.escapeAt >= 0 || !near(c.z)) return false;
            put(m, c.x, c.y, c.z, 1, 1, 1, visual.current * 0.4);
         } else {
            const z = roomStart(r, i) - 10; if (!near(z)) return false;
            put(m, 2.8 + Math.sin(visual.current * 1.2 + i), i * 6 + 5.5, z, 1, 1, 1, visual.current * 0.3);
         }
      }} />
      {r.config.rails && <DynamicInstancedModel asset={ASSETS.drone} count={r.config.rooms} update={(i, m) => {
         const z = roomStart(r, i) - 10; if (!near(z)) return false;
         put(m, Math.sin(r.ms / 900) * 4, i * 6 + 6, z, 1, 1, 1, Math.PI);
      }} />}
      {/* Orbs, direction pointers and flow streaks are emissive UI markers, all pooled. */}
      <DynamicInstanced count={r.orbs.length} update={(i, m) => {
         const o = r.orbs[i]; if (o.taken || !near(o.z)) return false;
         put(m, o.x, o.y + Math.sin(visual.current * 3 + i) * 0.12, o.z, o.bonus ? 0.2 : 0.27, 0.27, 0.27, visual.current);
      }}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={COLORS.orb} emissive={COLORS.orb} emissiveIntensity={0.65} metalness={0.5} roughness={0.25} /></DynamicInstanced>
      <DynamicInstanced count={r.fans.length * 12} tinted update={(i, m, color) => {
         const f = r.fans[Math.floor(i / 12)]; if (!near(f.z) || !f.on) return false;
         const d = DIRS[fanDir(f, r.ms)];
         const t = ((visual.current * 0.8 + (i % 12) / 12) % 1) * f.length;
         const lane = ((i % 3) - 1) * 0.6;
         tools.p.set(fanX(f, r.ms) + d.x * t + (d.x ? 0 : lane), f.y + d.y * t + (d.y ? 0 : lane + 0.6), f.z + d.z * t + (d.y ? lane : 0));
         tools.q.setFromUnitVectors(tools.axis, tools.d.set(d.x, d.y, d.z)); tools.s.set(0.035, 0.035, 0.7);
         color.set(f.auto ? "#b4a5ff" : COLORS.wind); m.compose(tools.p, tools.q, tools.s);
      }}><boxGeometry /><meshBasicMaterial color="white" transparent opacity={0.55} depthWrite={false} /></DynamicInstanced>
      <DynamicInstanced count={r.fans.length} tinted update={(i, m, color) => {
         const f = r.fans[i]; if (!near(f.z)) return false;
         const d = DIRS[r.hint && f.room === r.room ? (f.y === f.room * 6 ? 0 : 1) : fanDir(f, r.ms)];
         tools.p.set(fanX(f, r.ms) + d.x * 1.5, f.y + 0.6 + d.y * 1.5, f.z + d.z * 1.5);
         tools.q.setFromUnitVectors(tools.d.set(0, 1, 0), new Vector3(d.x, d.y, d.z)); tools.s.setScalar(i === r.nearFan ? 0.5 : 0.32);
         color.set(r.hint ? "#facc15" : f.on ? "#70f2eb" : "#64748b"); m.compose(tools.p, tools.q, tools.s);
      }}><coneGeometry args={[0.5, 1.2, 4]} /><meshBasicMaterial color="white" /></DynamicInstanced>
      <DynamicInstanced count={3} update={(i, m) => {
         if (r.secrets[i]) return false;
         const room = i === 1 ? 0 : Math.min(i, r.config.rooms - 1), z = roomStart(r, room) - (i === 2 ? 15 : 3);
         if (!near(z)) return false;
         put(m, i === 0 ? 5 : -4, room * 6 + (i === 1 ? 1 : 6.5), z, 0.42, 0.42, 0.42, visual.current * 1.3);
      }}><octahedronGeometry /><meshStandardMaterial color="#d9c4ff" emissive="#9b69ed" emissiveIntensity={0.8} /></DynamicInstanced>
      {r.boss && <group ref={boss} position={[0, 0, -15]}><Model asset={ASSETS.boss} /><pointLight color="#a78bfa" intensity={35} distance={19} position={[0, 3, 2]} /></group>}
      <group ref={storm}><mesh><planeGeometry args={[30, 25]} /><meshBasicMaterial color={COLORS.storm} transparent opacity={0.33} depthWrite={false} side={2} /></mesh><mesh position={[0, 0, 1.5]}><planeGeometry args={[35, 30]} /><meshBasicMaterial color="#632cb5" transparent opacity={0.25} depthWrite={false} side={2} /></mesh></group>
      <hemisphereLight args={["#b8edff", "#21223f", 0.8]} />
   </>;
}
