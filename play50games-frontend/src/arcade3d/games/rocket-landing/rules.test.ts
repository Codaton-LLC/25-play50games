import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { HULL, SUPPORT } from "./assets";
import { rocketLandingMeta } from "./meta";
import { BODY, CONTACT, DURATION_MS, ENGINE, PLANETS, TRANSITION, createRun, fallbackLayout, generateCampaign, isValidLayout, landingAward, landingSafe, padVx, padX, stepRun, wrap, type Run, type Controls } from "./rules";

const idle: Controls = { rotate: 0, thrust: false };
const fire: Controls = { rotate: 0, thrust: true };

describe("rocket landing constants and layouts", () => {
   it("pins the physics and score proof constants", () => {
      expect(BODY).toEqual({ centre: 1.1, radius: 1.35, speed: 12, omega: 1.5, spawnY: 14 });
      expect(ENGINE).toEqual({ acceleration: 12, burn: 10, torque: 3, damping: 4, assist: 8, neutral: 0.05 });
      expect(CONTACT).toEqual({ slice: 0.025, bisections: 12, vy: 2, vx: 1, angle: Math.PI / 18, skin: 0.012 });
      expect(TRANSITION).toBe(1.2);
      expect(DURATION_MS).toBe(240000);
      expect(PLANETS.map((p) => [p.gravity, p.width, p.fuel])).toEqual([[1.6, 6, 100], [3.7, 5.5, 100], [5, 5, 95], [2.5, 4.5, 90], [1, 4, 85]]);
   });
   it("generates reproducible reachable corridors over 1000 seeds", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const a = generateCampaign(seed);
         expect(a).toEqual(generateCampaign(seed));
         for (let p = 0; p < 5; p++) expect(isValidLayout(a[p], p), `${seed}/${p}`).toBe(true);
      }
      for (let p = 0; p < 5; p++) expect(isValidLayout(fallbackLayout(p), p)).toBe(true);
      const bad = fallbackLayout(0);
      bad.spawnX = 8;
      expect(isValidLayout(bad, 0)).toBe(false);
      bad.spawnX = 4.5;
      bad.terrain[6] = 0.6;
      expect(isValidLayout(bad, 0)).toBe(false);
   });
   it("moving pad has the specified analytic speed", () => {
      const layout = fallbackLayout(4);
      expect(padX(layout, 4, 4)).toBeCloseTo(2);
      expect(padVx(layout, 4, 0)).toBeCloseTo(Math.PI / 4);
      expect(padVx(layout, 4, 4)).toBeCloseTo(0);
   });
});

describe("landing gates and awards", () => {
   it("uses strict velocity and angle gates, inclusive feet and relative drift", () => {
      const r = createRun(1, false);
      const x = padX(r.layouts[0], 0, 0);
      r.body.x = x;
      r.body.vy = -1.999;
      for (const sign of [-1, 1]) {
         r.body.vx = sign * 0.999;
         r.body.angle = sign * 9.999 * Math.PI / 180;
         expect(landingSafe(r, 0)).toBe(true);
         r.body.vx = sign;
         expect(landingSafe(r, 0)).toBe(false);
         r.body.vx = 0;
         r.body.angle = sign * Math.PI / 18;
         expect(landingSafe(r, 0)).toBe(false);
      }
      r.body.angle = 0;
      r.body.vy = -2;
      expect(landingSafe(r, 0)).toBe(false);
      r.body.vy = 0;
      expect(landingSafe(r, 0)).toBe(false);
      r.body.vy = -1;
      r.planet = 4;
      r.layouts[4] = fallbackLayout(4);
      r.body.x = 0;
      r.body.vx = Math.PI / 4;
      expect(landingSafe(r, 0)).toBe(true);
      r.body.vx = Math.PI / 4 + 1;
      expect(landingSafe(r, 0)).toBe(false);
   });
   it("floors every component, normalizes fuel and caps endpoints", () => {
      expect(landingAward(-0.001, 0, 6, 100, 100)).toEqual({ soft: 199, centre: 150, reserve: 150, total: 499 });
      expect(landingAward(-1, 1.5, 6, 50, 100)).toEqual({ soft: 100, centre: 75, reserve: 75, total: 250 });
      expect(landingAward(-2, 3, 6, 0, 85).total).toBe(0);
      expect(landingAward(-0.01, 0, 4, 42.5, 85).reserve).toBe(75);
   });
});

function touchdown(r: Run, vy = -1): void {
   r.body.x = padX(r.layouts[r.planet], r.planet, r.attemptTime);
   r.body.y = 3.14;
   r.body.angle = 0;
   r.body.vx = padVx(r.layouts[r.planet], r.planet, r.attemptTime);
   r.body.vy = vy;
   r.body.omega = 0;
   for (let n = 0; n < 20 && r.mode === "flight"; n++) stepRun(r, idle, 1 / 120);
}

describe("simulation and contacts", () => {
   it("includes both support extremes and rejects an overhanging foot", () => {
      const r = createRun(0, false), px = padX(r.layouts[0], 0, 0);
      r.body.vy = -1;
      r.body.x = px + 3 - SUPPORT[1][0];
      expect(landingSafe(r, 0)).toBe(true);
      r.body.x += 0.00001;
      expect(landingSafe(r, 0)).toBe(false);
      r.body.x = px - 3 - SUPPORT[0][0];
      expect(landingSafe(r, 0)).toBe(true);
      r.body.x -= 0.00001;
      expect(landingSafe(r, 0)).toBe(false);
   });
   it("detects boundary tangency and gives simultaneous hazards priority", () => {
      const r = createRun(0, false);
      r.body.x = 10 - Math.max(...HULL.map((p) => p[0]));
      stepRun(r, idle, 1 / 120);
      expect(r.mode).toBe("crashed");
      const both = createRun(0, false);
      both.planet = 4; both.layouts[4] = fallbackLayout(4);
      both.roof.minY = 1.6; both.roof.maxY = 2;
      both.roof.points[0].y = both.roof.points[1].y = 1.6;
      both.roof.points[2].y = both.roof.points[3].y = 2;
      touchdown(both);
      expect(both.contactMask).toBe(3);
      expect(both.mode).toBe("crashed");
      expect(both.score).toBe(0);
   });
   it("keeps slices small and resolves impact within two millimetres", () => {
      const r = createRun(0, false);
      r.body.vx = 12; r.body.vy = -12;
      r.body.omega = 1.5;
      stepRun(r, idle, 1 / 120);
      expect(Math.hypot(r.body.vx, r.body.vy)).toBeLessThanOrEqual(12 + 1e-10);
      const travel = Math.hypot(r.next.x - r.previous.x, r.next.y - r.previous.y) + 1.35 * Math.abs(wrap(r.next.angle - r.previous.angle)) + Math.PI / 4 / 120;
      expect(travel / r.contactSlices).toBeLessThanOrEqual(0.025);
      const landing = createRun(0, false);
      touchdown(landing);
      const bottom = Math.min(...HULL.map((p) => p[1]));
      expect(Math.abs(landing.body.y - 1.1 + bottom - 2)).toBeLessThan(0.002);
   });
   it("a crash removes the clean bonus for the rest of the campaign", () => {
      const r = createRun(0, false);
      touchdown(r, -3);
      for (let i = 0; i < 25; i++) stepRun(r, idle, 0.05);
      for (let p = 0; p < 5; p++) {
         touchdown(r);
         if (p < 4) for (let i = 0; i < 25; i++) stepRun(r, idle, 0.05);
      }
      expect(r.terminal).toBe("win");
      expect(r.score).toBe(r.awards.reduce((a, b) => a + b, 0));
   });
   it("pause is untimed, stalls clamp, and timeout precedes a touchdown callback", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 1000, lives: 3 });
      store.getState().markReady(); store.getState().start();
      for (let i = 0; i < 60; i++) advanceRunClock(store, 0.05);
      store.getState().pause();
      const elapsed = store.getState().elapsedMs;
      advanceRunClock(store, 5);
      expect(playedFrameDt(store.getState())).toBe(0);
      expect(store.getState().elapsedMs).toBe(elapsed);
      store.getState().resume();
      advanceRunClock(store, 10);
      expect(playedFrameDt(store.getState())).toBeLessThanOrEqual(0.05);
      const r = createRun(0, false);
      let callbacks = 0;
      const result = simulateRun(createArcadeStore(), {
         durationMs: 1, lives: 3, frame: fixedFrames(50),
         step: () => { callbacks++; touchdown(r); },
      });
      expect(callbacks).toBe(0);
      expect(result.endReason).toBe("timeup");
      expect(result.score).toBe(0);
      expect(r.completed).toBe(0);
   });
   it("is independent of frame partitions on a constant input timeline", () => {
      const a = createRun(9, false), b = createRun(9, false), c = createRun(9, false);
      for (let i = 0; i < 120; i++) stepRun(a, idle, 1 / 60);
      for (let i = 0; i < 40; i++) stepRun(b, idle, 0.05);
      for (let i = 0; i < 200; i++) stepRun(c, idle, 0.01);
      expect(a.body).toEqual(b.body);
      expect(a.body).toEqual(c.body);
      expect(a.fuel).toBe(100);
      const before = { ...a.body };
      stepRun(a, fire, 0);
      expect(a.body).toEqual(before);
   });
   it("splits the last fuel interval without free or lost thrust", () => {
      const r = createRun(0, false);
      r.fuel = 0.025;
      stepRun(r, fire, 1 / 120);
      expect(r.fuel).toBe(0);
      expect(r.body.vy).toBeCloseTo(12 * 0.0025 - 1.6 / 120, 9);
      stepRun(r, fire, 1 / 120);
      expect(r.body.vy).toBeCloseTo(12 * 0.0025 - 1.6 / 60, 9);
      expect(r.powered).toBe(false);
   });
   it("burns exactly ten units per powered second and empty fuel keeps coasting", () => {
      const r = createRun(0, false);
      r.body.y = 8;
      for (let i = 0; i < 20; i++) stepRun(r, fire, 0.05);
      expect(r.fuel).toBeCloseTo(90, 8);
      expect(r.body.vy).toBeCloseTo(10.4, 8);
      const coast = createRun(0, false);
      coast.fuel = 0;
      stepRun(coast, fire, 0.05);
      expect(coast.mode).toBe("flight");
      expect(coast.body.vy).toBeCloseTo(-0.08, 8);
      expect(coast.fuel).toBe(0);
      expect(coast.powered).toBe(false);
   });
   it("rotation signs, damping and coarse neutral assistance are physical", () => {
      const manual = createRun(0, false), assist = createRun(0, true);
      manual.body.angle = assist.body.angle = 0.2;
      stepRun(manual, idle, 0.05);
      stepRun(assist, idle, 0.05);
      expect(manual.body.angle).toBe(0.2);
      expect(assist.body.angle).toBeLessThan(0.2);
      const r = createRun(0, false);
      stepRun(r, { rotate: 1, thrust: false }, 0.05);
      expect(r.body.angle).toBeLessThan(0);
      expect(wrap(Math.PI)).toBeCloseTo(-Math.PI);
   });
   it("awards once, carries hold time, wins at five and reconciles the clean bonus", () => {
      const r = createRun(0, false);
      for (let p = 0; p < 5; p++) {
         touchdown(r);
         expect(r.completed).toBe(p + 1);
         expect(r.events.award).toBeGreaterThan(0);
         const score = r.score;
         stepRun(r, fire, 0.05);
         expect(r.score).toBe(score);
         if (p < 4) for (let i = 0; i < 24; i++) stepRun(r, idle, 0.05);
      }
      expect(r.terminal).toBe("win");
      expect(r.score).toBe(r.awards.reduce((a, b) => a + b, 0) + 300);
      const score = r.score;
      stepRun(r, fire, 0.05);
      expect(r.score).toBe(score);
   });
   it("crashes on fast/side/underside/roof/terrain contacts and only retries twice", () => {
      const r = createRun(0, false);
      for (let life = 2; life >= 0; life--) {
         touchdown(r, -3);
         expect(r.lives).toBe(life);
         expect(r.events.crash).toBe(true);
         expect(r.score).toBe(0);
         if (life) for (let i = 0; i < 25; i++) stepRun(r, idle, 0.05);
      }
      expect(r.terminal).toBe("lose");
      for (const fixture of ["side", "below", "roof", "terrain"] as const) {
         const f = createRun(0, false);
         f.body.vy = 0;
         f.body.x = padX(f.layouts[0], 0, 0);
         if (fixture === "side") { f.body.x += 3.7; f.body.y = 2.2; f.body.vx = -12; }
         if (fixture === "below") { f.body.y = 0.45; f.body.vy = 12; }
         if (fixture === "terrain") { f.body.x = 8; f.body.y = 1; f.body.vy = -12; }
         if (fixture === "roof") { f.planet = 4; f.body.x = 0; f.body.y = 11.15; f.body.vy = -12; }
         for (let i = 0; i < 20 && f.mode === "flight"; i++) stepRun(f, idle, 1 / 120);
         expect(f.mode, fixture).toBe("crashed");
      }
   });
   it("bounds early side travel below the required 1.15 metres", () => {
      // |omega| <= .75 from rest => |angle(t)| <= .75t;
      // |ax| <= 12*.75t => |x(t)-x(0)| <= 1.5t^3 on Moon.
      // Tighter damped angle: .75*(t-(1-exp(-4t))/4).
      let x = 0, vx = 0;
      for (let n = 1; n <= 120; n++) {
         const t = n / 120;
         const angleBound = 0.75 * (t - (1 - Math.exp(-4 * t)) / 4);
         vx += 12 * Math.sin(angleBound) / 120;
         x += vx / 120;
      }
      expect(x).toBeLessThan(0.85);
      expect(10 - 7.5 - 1.35).toBeCloseTo(1.15);
   });
});

describe("real-clock score limits", () => {
   it("full-knowledge feedback pilots finish the campaign in both assist modes", () => {
      let minimumFuel = Infinity, fastest = Infinity, slowest = 0, highest = 0;
      const planetStats = PLANETS.map((p) => ({ name: p.name, minTime: Infinity, maxTime: 0, minFuel: Infinity, maxFuel: 0 }));
      for (const assist of [false, true]) for (let seed = 0; seed < 16; seed++) {
         const r = createRun(seed, assist), store = createArcadeStore();
         const controls = { rotate: 0, thrust: false };
         const landed = PLANETS.map(() => false);
         let stage = 0, planet = -1, crashes = -1, pulse = 0;
         const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
         const result = simulateRun(store, {
            durationMs: DURATION_MS, lives: 3,
            frame: seed < 8 ? fixedFrames(1000 / 60) : seed < 12 ? fixedFrames(50) : randomFrames(seed),
            step: (dt, time, s) => {
               if (planet !== r.planet || crashes !== r.crashes) { planet = r.planet; crashes = r.crashes; stage = 0; pulse = 0; }
               const b = r.body, l = r.layouts[r.planet], g = PLANETS[r.planet].gravity;
               const px = padX(l, r.planet, r.attemptTime), pv = padVx(l, r.planet, r.attemptTime);
               if (r.planet === 4 && stage === 0 && b.y < 7.4 && Math.abs(b.vy) < 1.5) stage = 1;
               // The descent from the 5.8 m holding point takes about 3.5 seconds.
               const crossing = r.planet !== 4 || Math.abs(padX(l, 4, r.attemptTime + 3.5)) < 0.25;
               if ((r.planet !== 4 || stage === 1) && crossing &&
                  Math.abs(b.x - (r.planet === 4 ? 0 : px)) < 0.3 &&
                  Math.abs(b.vx - (r.planet === 4 ? 0 : pv)) < 0.25 && Math.abs(b.angle) < 0.08) stage = 2;
               const shaft = l.spawnX < 0 ? -5.3 : 5.3;
               // Enter below the roof, brake over x=0, then intercept a pad crossing.
               // Chasing the pad in low gravity saturates tilt and never settles.
               const tx = r.planet === 4 ? (stage === 0 ? shaft : 0) : px;
               const tv = r.planet === 4 ? 0 : pv;
               const targetY = stage === 2 ? 3.1 : r.planet === 4 ? (stage === 0 ? 7.2 : 5.8) : 8;
               const targetVy = stage === 2 ? -Math.min(2, 0.35 + Math.max(0, b.y - 3.1) * 0.5) : clamp((targetY - b.y) * 0.8, -3, 2);
               const ay = clamp(g + 3 * (targetVy - b.vy), 0, 12);
               const wind = r.planet === 3 ? 0.4 * Math.sin(2 * Math.PI * r.attemptTime / 8 + l.wind) : 0;
               const ax = (r.planet === 4 ? 0.15 : 0.8) * (tx - b.x) + (r.planet === 4 ? 1 : 1.8) * (tv - b.vx) - wind;
               const maxAngle = stage === 2 && b.y < 4.5 ? 0.1 : 0.45;
               const desiredAngle = clamp(-Math.atan2(ax, Math.max(g, ay)), -maxAngle, maxAngle);
               controls.rotate = clamp(-(8 * wrap(desiredAngle - b.angle) - 4 * b.omega) / 3, -1, 1);
               // Keep deliberate asteroid steering outside the assist neutral zone.
               if (r.planet === 4 && r.assist && Math.abs(controls.rotate) <= ENGINE.neutral) controls.rotate = (controls.rotate < 0 ? -1 : 1) * (ENGINE.neutral + 0.001);
               pulse += clamp(ay / (12 * Math.max(0.8, Math.cos(b.angle))), 0, 1);
               controls.thrust = pulse >= 1;
               if (controls.thrust) pulse -= 1;
               stepRun(r, controls, dt);
               if (r.events.award) {
                  landed[r.planet] = true;
                  const stats = planetStats[r.planet];
                  stats.minTime = Math.min(stats.minTime, r.attemptTime); stats.maxTime = Math.max(stats.maxTime, r.attemptTime);
                  stats.minFuel = Math.min(stats.minFuel, r.fuel); stats.maxFuel = Math.max(stats.maxFuel, r.fuel);
                  if (r.planet === 4) {
                     expect(r.attemptTime, `Asteroid time seed=${seed}, assist=${assist}`).toBeLessThan(40);
                     expect(r.fuel, `Asteroid margin seed=${seed}, assist=${assist}`).toBeGreaterThan(50);
                  }
                  minimumFuel = Math.min(minimumFuel, r.fuel);
                  s.getState().addScore(r.events.award);
                  expect(r.fuel, `reserve seed=${seed}, assist=${assist}, planet=${PLANETS[r.planet].name}`).toBeGreaterThan(0);
               }
               if (r.events.crash) {
                  expect(r.planet === 4, `Asteroid crash seed=${seed}, assist=${assist}`).toBe(false);
                  s.getState().loseLife();
               }
               if (r.terminal) { s.getState().setScore(r.score); s.getState().end(r.terminal); }
               if (r.score > 800 + 200 * time + 1e-6) throw new Error("pilot exceeded score rate");
            },
         });
         for (let p = 0; p < PLANETS.length; p++) expect(landed[p], `planet=${PLANETS[p].name}, seed=${seed}, assist=${assist}, end=${result.endReason}`).toBe(true);
         expect(result.endReason, `pilot seed=${seed}, assist=${assist}, completed=${r.completed}`).toBe("win");
         expect(withinServerLimits(result.score, result.elapsedMs, rocketLandingMeta.scoring)).toBe(true);
         expect(capScore(result.score, result.elapsedMs, rocketLandingMeta.scoring)).toBe(result.score);
         fastest = Math.min(fastest, result.elapsedMs); slowest = Math.max(slowest, result.elapsedMs); highest = Math.max(highest, result.score);
      }
      console.info("rocket witnesses", { minimumFuel, fastest, slowest, highest, planetStats });
   }, 60000);
   it("adversarial idle, ceiling and rotation runs respect duration/rate caps", () => {
      for (let seed = 0; seed < 8; seed++) for (const kind of ["idle", "ceiling", "spam"] as const) {
         const r = createRun(seed, false);
         const store = createArcadeStore();
         const controls = { rotate: 0, thrust: false };
         let rateExcess = -Infinity;
         const result = simulateRun(store, {
            durationMs: DURATION_MS, lives: 3,
            frame: seed < 4 ? fixedFrames(50) : randomFrames(seed),
            step: (dt, time, s) => {
               controls.rotate = kind === "spam" ? Math.sin(time * 5) : 0;
               controls.thrust = kind !== "idle";
               stepRun(r, controls, dt);
               if (r.events.award) s.getState().addScore(r.events.award);
               if (r.events.crash) s.getState().loseLife();
               if (r.terminal) { s.getState().setScore(r.score); s.getState().end(r.terminal); }
               rateExcess = Math.max(rateExcess, s.getState().score - 800 - 200 * time);
            },
         });
         expect(withinServerLimits(result.score, result.elapsedMs, rocketLandingMeta.scoring)).toBe(true);
         expect(capScore(result.score, result.elapsedMs, rocketLandingMeta.scoring)).toBe(result.score);
         expect(result.elapsedMs).toBeGreaterThanOrEqual(5000);
         expect(rateExcess).toBeLessThanOrEqual(0);
      }
   });
   it("the analytic bound covers every award count and final bonus", () => {
      for (let n = 1; n <= 5; n++) {
         const t = n * Math.sqrt(2 * 10.65 / 17) + (n - 1) * 1.2;
         expect(500 * n + (n === 5 ? 300 : 0)).toBeLessThanOrEqual(800 + 200 * t);
      }
   });
});
