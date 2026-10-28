// Honest controls only: never writes run state. Used for all-hero proofs through the real store.
import { idleInput, type ZipRun } from "./rules";
export function botInput(r: ZipRun) {
   const i = idleInput();
   if (r.mode === "deck") { i.jump = true; return i; }
   if (r.mode === "bell") { i.power = true; return i; }
   if (r.mode === "air") return i;
   i.throttle = r.t < 0.68 ? 1 : -1;
   if (r.t > 0.78 && r.speed < 6.8) i.throttle = 0;
   if (r.boss?.phase === 0 && r.section === 2) {
      if (r.boss.step === "telegraph" && r.boss.stepMs > 500 && r.lane === r.electricLane && r.t < 0.7) { i.jump = true; i.x = r.lane === 0 ? 1 : -1; }
      if (r.boss.step === "vulnerable" && r.t > 0.42 && r.t < 0.65 && r.lane !== r.electricLane) i.jump = true;
   }
   if (r.boss?.phase === 1 && r.section === 3) {
      i.throttle = r.t < 0.89 ? 1 : -1;
      if (r.t > 0.85 && r.t < 0.89 && r.boss.step === "vulnerable") i.jump = true;
   }
   if (r.t > 0.94 && r.speed >= 4.5 && r.speed <= 10) i.jump = true;
   return i;
}
