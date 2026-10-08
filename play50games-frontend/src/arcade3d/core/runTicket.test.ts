import { describe, expect, it, vi } from "vitest";
import { canKeepTicket, createRunTickets, type RunTicketDeps, type RunTicketState } from "./runTicket";

interface Deferred {
   resolve(token: string): void;
   reject(error: unknown): void;
}

function setup(over: Partial<{ userId: number | null; jwt: boolean; enabled: boolean }> = {}) {
   const env = {
      state: { runId: 1, phase: "countdown", pausedFrom: null } as RunTicketState,
      userId: over.userId === undefined ? 7 : over.userId,
      jwt: over.jwt ?? true,
      enabled: over.enabled ?? true,
   };
   const pending: Deferred[] = [];
   const startRun = vi.fn(
      () =>
         new Promise<{ run_token: string }>((resolve, reject) => {
            pending.push({ resolve: (token) => resolve({ run_token: token }), reject });
         })
   );
   const deps: RunTicketDeps = {
      startRun,
      getState: () => env.state,
      getUserId: () => env.userId,
      hasJwt: () => env.jwt,
      enabled: () => env.enabled,
   };
   return { env, pending, startRun, tickets: createRunTickets(deps) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("canKeepTicket", () => {
   it("keeps a ticket only during the same run's countdown, paused or not", () => {
      expect(canKeepTicket({ runId: 3, phase: "countdown", pausedFrom: null }, 3)).toBe(true);
      expect(canKeepTicket({ runId: 3, phase: "paused", pausedFrom: "countdown" }, 3)).toBe(true);
      expect(canKeepTicket({ runId: 3, phase: "paused", pausedFrom: "playing" }, 3)).toBe(false);
      expect(canKeepTicket({ runId: 3, phase: "playing", pausedFrom: null }, 3)).toBe(false);
      expect(canKeepTicket({ runId: 3, phase: "over", pausedFrom: null }, 3)).toBe(false);
      expect(canKeepTicket({ runId: 4, phase: "countdown", pausedFrom: null }, 3)).toBe(false);
   });
});

describe("createRunTickets", () => {
   it("keeps a ticket that arrives during the countdown and hands it to that run once it ends", async () => {
      const { env, pending, startRun, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      expect(startRun).toHaveBeenCalledWith("robot-collector");
      pending[0].resolve("t-1");
      await flush();
      env.state = { runId: 1, phase: "over", pausedFrom: null };
      expect(tickets.ticketFor(1, 7)).toEqual({ token: "t-1", outcome: "ok" });
   });

   it("keeps a ticket that arrives while the countdown is paused", async () => {
      const { env, pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      env.state = { runId: 1, phase: "paused", pausedFrom: "countdown" };
      pending[0].resolve("t-1");
      await flush();
      expect(tickets.ticketFor(1, 7).token).toBe("t-1");
   });

   it("drops a ticket that arrives once play has begun (no false 'elapsed' rejections)", async () => {
      const { env, pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      env.state = { runId: 1, phase: "playing", pausedFrom: null };
      pending[0].resolve("t-late");
      await flush();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "late" });
   });

   it("treats a response still pending at the end as late, and ignores it afterwards", async () => {
      const { env, pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      env.state = { runId: 1, phase: "over", pausedFrom: null };
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "late" });
      pending[0].resolve("t-late");
      await flush();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "late" });
   });

   it("asks once per run: effect replays are no-ops, Retry and a paused Restart ask again, Resume does not", async () => {
      const { env, pending, startRun, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      tickets.onRunStart(1, "robot-collector"); // resubscribe / Strict Mode replay
      expect(startRun).toHaveBeenCalledTimes(1);
      // Restart from pause = a new runId (GameShell calls onRunStart only on a new runId; Resume keeps it)
      env.state = { runId: 2, phase: "countdown", pausedFrom: null };
      tickets.onRunStart(2, "robot-collector");
      expect(startRun).toHaveBeenCalledTimes(2);
      // the first run's response arrives now: it belongs to run 1, not run 2
      pending[0].resolve("t-1");
      pending[1].resolve("t-2");
      await flush();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "none" });
      expect(tickets.ticketFor(2, 7)).toEqual({ token: "t-2", outcome: "ok" });
   });

   it.each([
      ["a guest", { userId: null }],
      ["a cookie-only session (no JWT)", { jwt: false }],
      ["the leaderboard flag off", { enabled: false }],
   ] as const)("sends no start for %s", (_label, over) => {
      const { startRun, tickets } = setup(over);
      tickets.onRunStart(1, "robot-collector");
      expect(startRun).not.toHaveBeenCalled();
      expect(tickets.ticketFor(1, "userId" in over ? null : 7)).toEqual({ token: null, outcome: "none" });
   });

   it("submits without a ticket when the start fails (old server 404, offline, 401, 429, 500)", async () => {
      const { pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      pending[0].reject(new Error("HTTP 404"));
      await flush();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "failed" });
   });

   it("survives a start function that throws synchronously", () => {
      const tickets = createRunTickets({
         startRun: () => {
            throw new Error("boom");
         },
         getState: () => ({ runId: 1, phase: "countdown", pausedFrom: null }),
         getUserId: () => 7,
         hasJwt: () => true,
         enabled: () => true,
      });
      expect(() => tickets.onRunStart(1, "robot-collector")).not.toThrow();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "failed" });
   });

   it("never gives one user's ticket to another account", async () => {
      const { env, pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      pending[0].resolve("t-1");
      await flush();
      env.userId = 8;
      expect(tickets.ticketFor(1, 8)).toEqual({ token: null, outcome: "none" });
   });

   it("drops a ticket that resolves after the user logged out or switched account", async () => {
      const { env, pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      env.userId = 8;
      pending[0].resolve("t-1");
      await flush();
      env.userId = 7;
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "late" });
   });

   it("forgets everything on reset (unmount): a remount reusing the runId never inherits a ticket", async () => {
      const { pending, tickets } = setup();
      tickets.onRunStart(1, "robot-collector");
      tickets.reset();
      pending[0].resolve("t-1");
      await flush();
      expect(tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "none" });
      const fresh = setup();
      expect(fresh.tickets.ticketFor(1, 7)).toEqual({ token: null, outcome: "none" });
   });
});
