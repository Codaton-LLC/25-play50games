import type { AABB } from "../../core/collision";
import { orbitPosition } from "../../menu2/camera/orbit";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import { heightAt, obstacleX } from "./slope";
import type { SnowRun } from "./rules";

export const FOV = 58;
export const SNOW_ORBIT = { yaw: 0, pitch: 0.53, distance: 16, minDistance: 7, maxDistance: 29, minPitch: 0.16, maxPitch: 1.35 };
export const orbitScale = (aspect: number) => aspect < 1 ? 1.32 : 1;
export function playCamera(aspect: number): IntroKeyframe {
   const p = orbitPosition(0, 1.3, -3, 0, SNOW_ORBIT.pitch, SNOW_ORBIT.distance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [p.x, p.y, p.z], lookAt: [0, 2.1, -3] };
}
export function introKeyframes(r: SnowRun): IntroKeyframe[] {
   return [0.6, 0.28, 0.08].map((t, i) => {
      const d = r.config.length * t;
      return { position: [i % 2 ? -14 : 16, heightAt(d) + 12, -d + 10], lookAt: [0, heightAt(d), -d - 25] };
   });
}
// Only nearby trees and rocks enter the cast. The broad open slope has no walls to trap the orbit.
export function cameraSolids(r: SnowRun, out: AABB[]): number {
   let n = 0;
   for (const o of r.course.obstacles) {
      if (Math.abs(o.d - r.distance) > 24 || n >= out.length) continue;
      const x = obstacleX(o, r.simMs), y = heightAt(o.d), b = out[n++];
      b.min.x = x - 1; b.max.x = x + 1;
      b.min.z = -o.d - 1; b.max.z = -o.d + 1;
      b.min.y = y; b.max.y = y + (o.kind === "pine" ? 4 : 2);
   }
   return n;
}
