import { it } from "vitest";
import { courseFor, createRun, createStepInput, step } from "./rules";
import { createBot, botInput } from "./bot";
it("trace", () => {
   for (const lv of [3, 2] as const) {
      const c = courseFor(lv);
      console.log("J", lv, c.junctions.map((j) => `${j.index}:z${j.z.toFixed(0)} ${j.lane}->${j.to} b${c.pieces[j.piece].branch}${j.frozen ? "F" : ""}`).join(" | "));
      console.log("R", lv, c.rings.map((r) => `${r.lane}@${r.z.toFixed(0)}`).join(" "));
      const run = createRun(7, lv, "kiro");
      const bot = createBot(run);
      const inp = createStepInput();
      let n = 0;
      while (run.ended === null && n++ < 40000) {
         botInput(bot, run, inp);
         const ev = step(run, 1000 / 60, inp);
         const h = run.hero;
         if (ev.hooked || ev.bonked || ev.junction >= 0 || ev.thrown >= 0 || ev.frozenClunk || ev.ringCount || inp.switchPressed) console.log(`  t${run.simMs} z${h.z.toFixed(1)} lane${h.lane} y${h.y.toFixed(2)} g${h.grounded ? 1 : 0} p${h.piece} ${ev.hooked ? "HOOK" : ""}${ev.bonked ? "BONK" : ""}${ev.junction >= 0 ? " J" + ev.junction + "=" + ev.junctionResult : ""}${ev.thrown >= 0 ? " THROW" + ev.thrown : ""}${ev.frozenClunk ? " CLUNK" : ""}${ev.ringCount ? " RING" : ""}${inp.switchPressed ? " press" : ""}`);
      }
   }
});
