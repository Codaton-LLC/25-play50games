// Single-use run tickets (docs/run-tokens.md §7), owned by Claude. GameShell asks for one at the
// countdown of every new run and hands it to submitScore at the end. Never blocks play: the request
// runs in the background, and any failure (old server 404, offline, 401, 429, 500) just means the
// run is submitted without a ticket, exactly as before tickets existed.
//
// Accept rule (no timeout constant): a ticket is kept only if its response arrives while the same
// run is still in its countdown (or paused during it), for the same logged-in user with a JWT. Then
// the server issued it before play began, so an honest run's duration can never exceed the
// ticket's age and the server never rejects it as "elapsed".
//
// Tickets live in memory only (never localStorage, sessionStorage or analytics), one context per
// shell: reset() on unmount, so a new mount never inherits a ticket even when the store reuses a
// numeric runId.
import type { ArcadeSlug } from "../types";
import type { RunPhase } from "./types";

/** Analytics only: how the run's ticket turned out (no token, no ID). */
export type TicketOutcome = "ok" | "late" | "failed" | "none";

export interface RunTicketState {
   runId: number;
   phase: RunPhase;
   pausedFrom: "countdown" | "playing" | null;
}

export interface RunTicketDeps {
   /** POST /arcade/runs/start */
   startRun(slug: ArcadeSlug): Promise<{ run_token: string }>;
   /** current store state (arcadeStore.getState) */
   getState(): RunTicketState;
   /** current logged-in user id, or null */
   getUserId(): number | null;
   /** a JWT is stored (cookie-only sessions cannot submit) */
   hasJwt(): boolean;
   /** the leaderboard flag */
   enabled(): boolean;
}

interface TicketContext {
   runId: number;
   slug: ArcadeSlug;
   userId: number | null;
   token: string | null;
   status: "pending" | TicketOutcome;
}

export interface RunTickets {
   /** a run entered its countdown: request its ticket once (repeat calls for the same run are no-ops) */
   onRunStart(runId: number, slug: ArcadeSlug): void;
   /** the run's ticket for this user, if it was kept, and how it turned out */
   ticketFor(runId: number, userId: number | null): { token: string | null; outcome: TicketOutcome };
   /** drop the context (unmount); a late response is then discarded */
   reset(): void;
}

/** true while a ticket for `runId` may still be kept (§2 invariant). */
export function canKeepTicket(state: RunTicketState, runId: number): boolean {
   if (state.runId !== runId) return false;
   return state.phase === "countdown" || (state.phase === "paused" && state.pausedFrom === "countdown");
}

export function createRunTickets(deps: RunTicketDeps): RunTickets {
   let ctx: TicketContext | null = null;

   return {
      onRunStart(runId, slug) {
         if (ctx && ctx.runId === runId && ctx.slug === slug) return; // effect replay / resubscribe
         const userId = deps.getUserId();
         const mine: TicketContext = { runId, slug, userId, token: null, status: "pending" };
         ctx = mine;
         if (!deps.enabled() || !userId || !deps.hasJwt()) {
            mine.status = "none";
            return;
         }
         let request: Promise<{ run_token: string }>;
         try {
            request = deps.startRun(slug);
         } catch {
            mine.status = "failed";
            return;
         }
         request.then(
            (response) => {
               if (ctx !== mine || mine.status !== "pending") return;
               const kept =
                  canKeepTicket(deps.getState(), runId) && deps.getUserId() === userId && deps.hasJwt();
               if (kept) {
                  mine.token = response.run_token;
                  mine.status = "ok";
               } else {
                  mine.status = "late";
               }
            },
            () => {
               if (ctx === mine && mine.status === "pending") mine.status = "failed";
            }
         );
      },

      ticketFor(runId, userId) {
         const current = ctx;
         if (!current || current.runId !== runId) return { token: null, outcome: "none" };
         // the run ended before the response: whatever arrives now is too late for this run
         const outcome: TicketOutcome = current.status === "pending" ? "late" : current.status;
         current.status = outcome;
         // another account now: never send one user's run with another user's ticket
         if (current.userId !== userId) return { token: null, outcome: "none" };
         return { token: current.token, outcome };
      },

      reset() {
         ctx = null;
      },
   };
}
