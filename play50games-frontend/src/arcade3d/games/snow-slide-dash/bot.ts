import { idleInput, TRICK_RATE, type SnowRun, type StepInput } from "./rules";

// Honest controller: only reads the live course and writes the same input as keyboard/touch.
export function botInput(r: SnowRun, out: StepInput = idleInput()): StepInput {
   Object.assign(out, idleInput());
   if (r.airMs > 0) {
      const final = r.airRamp >= 0 && r.course.ramps[r.airRamp].final;
      const target = Math.PI * (final ? 4 : 2);
      // Fractional last frame aligns within the same 20-degree tolerance as a human.
      out.moveX = Math.max(0, Math.min(1, (target - r.spin) / (TRICK_RATE / 60)));
      return out;
   }
   const gate = r.course.gates[r.nextGate];
   const ramp = r.course.ramps.find((p) => !p.rooftop && p.d > r.distance && p.d - r.distance < Math.max(24, r.speed * 0.8));
   let x = ramp?.x ?? gate?.x ?? 0;
   if (r.level === 5 && r.distance > r.config.length - 100) x = 0;
   const error = x - r.hero.x;
   out.moveX = Math.max(-1, Math.min(1, error * 0.55 - r.hero.vx * 0.08));
   // Pre-aim before the lake; there are no lanes and the ice ignores steering just like real input.
   return out;
}
