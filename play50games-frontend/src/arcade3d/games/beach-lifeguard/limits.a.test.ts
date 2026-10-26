import { describeLimitProof } from "./testing/limitProof";

// Per-level score-limit proofs (README "Server limits and why they hold"), split for parallel runs.
describeLimitProof(1);
describeLimitProof(2);
describeLimitProof(3);
