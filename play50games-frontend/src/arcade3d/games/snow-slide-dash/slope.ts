import type { SnowLevel } from "./levels";

export const HALF_WIDTH = 18;
export const heightAt = (distance: number) => -distance * 0.11;
export interface Gate { x: number; d: number; }
export interface Ramp extends Gate { final?: boolean; rooftop?: boolean; }
export type ObstacleKind = "pine" | "rock" | "snowman";
export interface Obstacle extends Gate { kind: ObstacleKind; moving: boolean; }
export interface Route extends Gate { hero: "riko" | "nami" | "kiro" | "zuno" | "vexa"; end: number; }
export interface Course { gates: Gate[]; ramps: Ramp[]; obstacles: Obstacle[]; routes: Route[]; }
export function buildCourse(l: SnowLevel): Course {
   const gates: Gate[] = [];
   const start = l.id === 1 ? 85 : 55;
   const end = l.length - (l.id === 5 ? 100 : 45);
   for (let i = 0; i < l.orbs; i++) {
      const d = start + i * (end - start) / (l.orbs - 1);
      // Three safe teaching gates are straight, then a broad, readable slalom.
      const x = l.id === 1 && i < 3 ? 0 : Math.sin(i * 0.65) * (l.id === 3 ? 2 : 5);
      gates.push({ x, d });
   }
   const ramps: Ramp[] = [];
   for (let i = l.id === 1 ? 5 : 2; i < gates.length - 2; i += l.id >= 4 ? 3 : 5) {
      ramps.push({ d: gates[i].d - 13, x: gates[i].x });
      if (l.id === 4) ramps.push({ d: gates[i].d + 22, x: gates[i + 1].x });
   }
   if (l.id === 5) ramps.push({ d: l.length - 40, x: 0, final: true });
   if (l.id === 2) ramps.push({ d: 440, x: 13, rooftop: true });
   ramps.sort((a, b) => a.d - b.d);
   const obstacles: Obstacle[] = [];
   for (let i = 0; i < Math.ceil(l.length / 24); i++) {
      const d = 28 + i * 24;
      // The initial 4 m safe corridor and all default gate lines remain free of pines.
      const line = gates.reduce((a, b) => Math.abs(b.d - d) < Math.abs(a.d - d) ? b : a).x;
      obstacles.push({ x: l.id === 2 ? (i % 2 ? 6.5 : -6.5) : line + (i % 2 ? 9 : -9), d, kind: i % 4 === 0 ? "rock" : "pine", moving: false });
   }
   if (l.id === 4) for (let i = 0; i < 8; i++) obstacles.push({ x: 0, d: 130 + i * 135, kind: "snowman", moving: true });
   const routes: Route[] = [
      { hero: "riko", x: -13, d: l.length * 0.22, end: l.length * 0.22 + 45 },
      { hero: "nami", x: 13, d: l.length * 0.36, end: l.length * 0.36 + 40 },
      { hero: "kiro", x: -12, d: l.length * 0.49, end: l.length * 0.49 + 50 },
      { hero: "zuno", x: 12, d: l.length * 0.61, end: l.length * 0.61 + 35 },
      { hero: "vexa", x: -13, d: l.length * 0.75, end: l.length * 0.75 + 40 },
   ];
   return { gates, ramps, obstacles, routes };
}
export const obstacleX = (o: Obstacle, ms: number) => o.moving ? Math.sin(ms * 0.0011 + o.d) * 13 : o.x;
