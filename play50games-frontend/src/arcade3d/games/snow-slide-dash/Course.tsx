"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, type Group, type Matrix4 } from "three";
import { DynamicInstancedModel, Model } from "../../core/assets";
import { Instanced } from "../../core/render/Instanced";
import { useGameTime } from "../../core/gameTime";
import { bossTimeScale } from "../../menu2/boss/boss";
import { ASSETS } from "./assets";
import { heightAt, obstacleX, type ObstacleKind } from "./slope";
import { BIG_DRIFT } from "./progression";
import { powerActive, type SnowRun } from "./rules";
import { sharedSimMs } from "./multiplayer";

const GHOST_FENCE = { ...ASSETS.crack, scale: 2.8, material: { color: "#c4b5fd", emissive: "#4c1d95", roughness: 0.5 } };

function terrain(r: SnowRun): BufferGeometry {
   const positions: number[] = [], colors: number[] = [], indices: number[] = [];
   const xs = [-80, -42, -21, 0, 21, 42, 80];
   const steps = Math.ceil((r.config.length + 130) / 25);
   const ds = Array.from({ length: steps + 1 }, (_, i) => -55 + i * 25);
   if (r.level === 5) ds.push(r.config.length - 40, r.config.length);
   ds.sort((a, b) => a - b);
   for (let i = 0; i < ds.length; i++) {
      const d = ds[i];
      for (const x of xs) {
         const shoulder = Math.max(0, Math.abs(x) - 21) * (0.5 + 0.2 * Math.sin(i * 0.7));
         positions.push(x, heightAt(d) - 0.07 + shoulder, -d);
         const shade = Math.abs(x) > 21 ? 0.76 + 0.1 * Math.sin(i) : 1;
         colors.push(0.79 * shade, 0.9 * shade, 0.97 * shade);
      }
   }
   for (let i = 0; i < ds.length - 1; i++) for (let j = 0; j < xs.length - 1; j++) {
      if (r.level === 5 && ds[i] >= r.config.length - 40 && ds[i + 1] <= r.config.length && (j === 2 || j === 3)) continue;
      const k = i * xs.length + j;
      indices.push(k, k + 1, k + xs.length, k + 1, k + xs.length + 1, k + xs.length);
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(positions, 3));
   g.setAttribute("color", new Float32BufferAttribute(colors, 3));
   g.setIndex(indices); g.computeVertexNormals();
   return g;
}

export function Course({ run: r, runs = [r] }: { run: SnowRun; runs?: SnowRun[] }) {
   const ground = useMemo(() => terrain(r), [r]);
   const ice = useMemo(() => new PlaneGeometry(14, 90.5).rotateX(-Math.PI / 2 - Math.atan(0.11)), []);
   useEffect(() => () => ground.dispose(), [ground]);
   useEffect(() => () => ice.dispose(), [ice]);
   const time = useGameTime();
   const avalanche = useRef<Group>(null);
   const near = (d: number) => runs.some((p) => Math.abs(d - p.distance) < 155);
   const at = (m: Matrix4, x: number, d: number, y = 0) => { m.makeRotationX(-Math.atan(0.11)); m.setPosition(x, heightAt(d) + y, -d); return true; };
   const obstacles = useMemo(() => ({
      pine: r.course.obstacles.filter((o) => o.kind === "pine"),
      rock: r.course.obstacles.filter((o) => o.kind === "rock"),
      snowman: r.course.obstacles.filter((o) => o.kind === "snowman"),
   }), [r]);
   const lines = useMemo(() => r.course.gates.flatMap((g, i) => {
      const prev = r.course.gates[Math.max(0, i - 1)];
      return [0, 0.25, 0.5, 0.75].map((t) => ({ x: prev.x + (g.x - prev.x) * t, d: prev.d + (g.d - prev.d) * t }));
   }), [r]);
   const patches = useMemo(() => {
      const spots = [];
      if (r.level === 3) for (let d = 140; d < r.config.length - 130; d += 180) spots.push({ x: 0, y: heightAt(d + 45) - 0.02, z: -d - 45 });
      return spots;
   }, [r]);
   useFrame(() => {
      if (avalanche.current) {
         avalanche.current.visible = r.level === 5 && !(r.boss && r.boss.hp === 0);
         const d = r.distance - r.gap;
         avalanche.current.position.set(0, heightAt(d), -d);
      }
   });
   return <>
      <mesh geometry={ground} receiveShadow><meshStandardMaterial vertexColors roughness={0.83} /></mesh>
      <Instanced spots={patches}><primitive object={ice} attach="geometry" /><meshStandardMaterial color="#80cadf" metalness={0.25} roughness={0.18} /></Instanced>
      <DynamicInstancedModel asset={ASSETS.gate} count={r.course.gates.length} update={(i, m) => near(r.course.gates[i].d) && at(m, r.course.gates[i].x, r.course.gates[i].d)} />
      <DynamicInstancedModel asset={ASSETS.star} count={r.course.gates.length} update={(i, m) => runs.some((p) => !p.collected[i]) && near(r.course.gates[i].d) && at(m, r.course.gates[i].x, r.course.gates[i].d, 1.2)} />
      <DynamicInstancedModel asset={ASSETS.ramp} count={r.course.ramps.length} update={(i, m) => near(r.course.ramps[i].d) && at(m, r.course.ramps[i].x, r.course.ramps[i].d)} />
      {(["pine", "rock", "snowman"] as ObstacleKind[]).map((kind) => <DynamicInstancedModel key={kind} asset={ASSETS[kind]} count={Math.max(1, obstacles[kind].length)} update={(i, m) => {
         const o = obstacles[kind][i];
         return !!o && near(o.d) && at(m, obstacleX(o, sharedSimMs(runs)), o.d, kind === "snowman" ? 0.25 : 0);
      }} />)}
      <DynamicInstancedModel asset={ASSETS.sled} count={Math.max(1, obstacles.snowman.length)} update={(i, m) => {
         const o = obstacles.snowman[i]; return !!o && near(o.d) && at(m, obstacleX(o, sharedSimMs(runs)), o.d);
      }} />
      <DynamicInstancedModel asset={ASSETS.cabin} count={Math.ceil(r.config.length / 240)} update={(i, m) => near(190 + i * 240) && at(m, i % 2 ? -29 : 29, 190 + i * 240)} />
      {r.level === 2 && <>
         <group position={[13, heightAt(470), -470]} scale={0.5}><Model asset={ASSETS.cabin} /></group>
         <DynamicInstancedModel asset={ASSETS.star} count={1} update={(_, m) => !r.secrets.found[1] && near(465) && at(m, 13, 465, 6.2)} />
      </>}
      {/* Route models are side pockets, never hard blocks on the ordinary line. */}
      <DynamicInstancedModel asset={ASSETS.crack} count={5} update={(i, m) => {
         const route = r.course.routes[i === 0 ? 0 : 1];
         if (!near(route.d) || (i === 0 && r.routeDone[0])) return false;
         m.makeRotationZ(i === 0 ? Math.PI / 2 : 0);
         m.setPosition(route.x, heightAt(route.d + (i > 0 ? i * 8 : 0)) + (i === 0 ? 1.5 : 3.3), -route.d - (i > 0 ? i * 8 : 0));
         return true;
      }} />
      <DynamicInstancedModel asset={ASSETS.pine} count={5} update={(i, m) => {
         const route = r.course.routes[2]; return near(route.d) && at(m, route.x + (i % 2 ? 2 : -2), route.d + i * 9);
      }} />
      <DynamicInstancedModel asset={GHOST_FENCE} count={3} update={(i, m) => {
         const route = r.course.routes[4]; if (!near(route.d) || r.routeDone[4]) return false;
         m.makeRotationZ(Math.PI / 2); m.setPosition(route.x + (i - 1) * 2, heightAt(route.d) + 1.3, -route.d); return true;
      }} />
      <mesh position={[r.course.routes[3].x, heightAt(r.course.routes[3].d + 16), -r.course.routes[3].d - 16]} rotation-x={-Math.PI / 2 - Math.atan(0.11)}>
         <planeGeometry args={[4.8, 35]} /><meshStandardMaterial color="#72bdd6" roughness={0.2} metalness={0.25} />
      </mesh>
      <DynamicInstancedModel asset={ASSETS.star} count={12} update={(i, m) => {
         const route = r.course.routes[3];
         return !r.routeDone[3] && runs.some((p) => powerActive(p, "zuno")) && near(route.d) && at(m, route.x + Math.sin(i) * 1.1, route.d + 2 + i * 2.4, 0.6);
      }} />
      <DynamicInstancedModel asset={ASSETS.star} count={5} update={(i, m) => {
         const route = r.course.routes[i]; return !r.routeDone[i] && near(route.d) && at(m, route.x, route.d + 8, 1.3);
      }} />
      {r.level <= 2 && <DynamicInstancedModel asset={{ ...ASSETS.star, scale: 0.06 }} count={lines.length} update={(i, m) => near(lines[i].d) && at(m, lines[i].x, lines[i].d, 0.04)} />}
      {r.level === 3 && <DynamicInstancedModel asset={ASSETS.crack} count={6} update={(i, m) => {
         const d = r.distance - 24 - i * 5; m.makeRotationZ(Math.sin(time.now * 3 + i) * 0.3); m.setPosition((i % 3 - 1) * 5, heightAt(d) - i * 0.6, -d); return d > 140;
      }} />}
      {r.config.night && <DynamicInstancedModel asset={ASSETS.star} count={r.course.gates.length} update={(i, m) => near(r.course.gates[i].d) && at(m, r.course.gates[i].x + 4, r.course.gates[i].d, 4.3)} />}
      <DynamicInstancedModel asset={ASSETS.ball} count={runs.length} update={(i, m) => {
         const p = runs[i]; if (!p.boss || p.rockD < 0 || p.simMs >= p.rockAt || !near(p.rockD)) return false;
         return at(m, p.rockX, p.rockD, Math.max(0, (p.rockAt - p.simMs) / 900) * 14);
      }} />
      <DynamicInstancedModel asset={ASSETS.rock} count={runs.length} update={(i, m) => {
         const p = runs[i]; return !!p.boss && p.rockD > 0 && p.simMs >= p.rockAt && near(p.rockD) && at(m, p.rockX, p.rockD);
      }} />
      <DynamicInstancedModel asset={ASSETS.yeti} count={runs.length} tinted update={(i, m, color) => {
         const p = runs[i], b = p.boss; if (!b || b.hp <= 0) return false;
         const final = b.phase === 2, barrage = b.phase === 1;
         const d = final ? p.config.length : barrage ? p.distance + 45 : p.distance - Math.max(16, p.gap * 0.25);
         m.makeRotationZ(Math.sin(time.now * 1.4 * bossTimeScale(b, BIG_DRIFT)) * 0.06);
         m.setPosition(final ? 0 : barrage ? 13 : Math.sin(time.now * 0.5) * 3, heightAt(d), -d);
         color.set(b.flashMs > 0 ? "#fff0a5" : b.step === "vulnerable" ? "#d1efff" : "#8fbedb");
         return true;
      }} />
      {/* Snow is terrain; the avalanche is one bank of opaque snow clouds, not alpha layers. */}
      <group ref={avalanche} visible={r.level === 5}>{[-15, -7, 0, 7, 15].map((x, i) => <mesh key={x} position={[x, 2 + i % 2, 0]} scale={[8, 5 + i % 2, 7]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#dceef5" roughness={1} /></mesh>)}</group>
      <mesh position={[0, heightAt(r.config.length) + 0.05, -r.config.length]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3, 5, 40]} /><meshBasicMaterial color="#facc15" /></mesh>
   </>;
}
