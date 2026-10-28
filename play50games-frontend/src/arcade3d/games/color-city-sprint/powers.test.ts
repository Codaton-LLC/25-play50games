import { describe, expect, it } from "vitest";
import { BUS_ROOF, RAIL_Y } from "./city";
import { G, V_AIR, V_JUMP, V_RUN, createRun, createStepInput, step } from "./rules";

function hold(run: ReturnType<typeof createRun>, ms: number, input: ReturnType<typeof createStepInput>) {
   const steps = Math.ceil(ms / 16);
   for (let i = 0; i < steps; i++) step(run, 16, input);
}

describe("hero powers", () => {
   it("Riko's dash smashes the hoarding and the cut becomes a street", () => {
      const run = createRun(1, 1, "riko");
      const cut = run.course.cut!;
      const mx = (cut.ax + cut.bx) / 2;
      const mz = (cut.az + cut.bz) / 2;
      run.hero.x = mx + (cut.ax - mx) * 0.55;
      run.hero.z = mz + (cut.az - mz) * 0.55;
      const input = createStepInput();
      input.moveX = mx - run.hero.x;
      input.moveZ = mz - run.hero.z;
      input.actionPressed = true;
      step(run, 16, input);
      input.actionPressed = false;
      hold(run, 500, input);
      expect(run.cutOpen).toBe(true);
   });

   it("Kiro's shield ignores sludge", () => {
      const slow = createRun(1, 3, "riko");
      const sludge = slow.course.sludge[0];
      slow.hero.x = sludge.x;
      slow.hero.z = sludge.z;
      const fast = createRun(1, 3, "kiro");
      fast.hero.x = sludge.x;
      fast.hero.z = sludge.z;
      fast.hero.shieldUntil = 10_000;
      const input = createStepInput();
      input.moveX = 1;
      hold(slow, 400, input);
      hold(fast, 400, input);
      expect(Math.hypot(fast.hero.vx, fast.hero.vz)).toBeGreaterThan(Math.hypot(slow.hero.vx, slow.hero.vz) + 0.4);
      expect(Math.hypot(slow.hero.vx, slow.hero.vz)).toBeLessThan(V_RUN * 0.75);
   });

   it("Zuno's magnet pulls a drain gem the hands cannot reach", () => {
      const run = createRun(1, 1, "zuno");
      const orb = run.course.orbs.find((o) => !o.main && o.y < 0.5)!;
      run.hero.x = orb.x;
      run.hero.z = orb.z - 4;
      const input = createStepInput();
      input.actionPressed = true;
      step(run, 16, input);
      input.actionPressed = false;
      hold(run, 200, input);
      expect(run.orbs).toBeGreaterThan(0);
   });

   it("Vexa phases into the ghost shop", () => {
      const run = createRun(1, 1, "vexa");
      const shop = run.course.blocks.find((b) => b.ghost)!;
      run.hero.x = shop.x0 - 0.2;
      run.hero.z = (shop.z0 + shop.z1) / 2;
      const input = createStepInput();
      input.moveX = 1;
      input.actionPressed = true;
      step(run, 16, input);
      input.actionPressed = false;
      hold(run, 900, input);
      expect(run.hero.x).toBeGreaterThan(shop.x0 + 0.4);
   });

   it("a street jump cannot reach a bus roof, and Nami's second jump from the roof reaches the rail", () => {
      const street = createRun(1, 2, "nami");
      const jump = createStepInput();
      jump.jumpPressed = true;
      step(street, 16, jump);
      jump.jumpPressed = false;
      hold(street, 800, jump);
      expect(street.hero.y).toBeLessThan(BUS_ROOF - 0.3);

      const roof = createRun(1, 2, "nami");
      roof.hero.x = (roof.course.nx - 1) * 12 * 0.5;
      roof.hero.z = (roof.course.nz - 1) * 12;
      roof.hero.y = BUS_ROOF;
      roof.hero.grounded = true;
      const once = createStepInput();
      once.jumpPressed = true;
      step(roof, 16, once);
      once.jumpPressed = false;
      const singleTop = roof.hero.y + (roof.hero.vy * roof.hero.vy) / (2 * G);
      expect(singleTop).toBeLessThan(RAIL_Y);

      const nami = createRun(1, 2, "nami");
      nami.hero.x = roof.hero.x;
      nami.hero.z = roof.hero.z;
      nami.hero.y = BUS_ROOF;
      nami.hero.grounded = true;
      const first = createStepInput();
      first.jumpPressed = true;
      step(nami, 16, first);
      first.jumpPressed = false;
      const toApex = Math.ceil((V_JUMP / G) * 1000);
      hold(nami, toApex, first);
      first.jumpPressed = true;
      step(nami, 16, first);
      if (Math.abs(nami.hero.vy - V_AIR) > 0.2) {
         throw new Error(JSON.stringify({
            y: nami.hero.y, vy: nami.hero.vy, grounded: nami.hero.grounded,
            air: nami.hero.airJumps, ms: nami.simMs, x: nami.hero.x, z: nami.hero.z,
            ready: nami.hero.powerReadyAt,
         }));
      }
      expect(nami.hero.vy).toBeCloseTo(V_AIR, 1);
      const top = nami.hero.y + (nami.hero.vy * nami.hero.vy) / (2 * G);
      expect(top).toBeGreaterThan(RAIL_Y);
   });
});
