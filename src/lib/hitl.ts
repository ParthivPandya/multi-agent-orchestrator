// ============================================================
// Gap #1 — Human-in-the-Loop (HITL) State Manager
// Manages pending human decisions via a promise resolver map.
// Server-side singleton: keys are request IDs, values are resolvers.
// ============================================================

import { HITLRequest, HITLResponse } from './types';

// In-memory map of pending resolver functions keyed by requestId
const pendingDecisions = new Map<string, (decision: HITLResponse) => void>();

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates a new HITL request object (does NOT start waiting).
 */
export function createHITLRequest(
  stage: HITLRequest['stage'],
  agentOutput: string,
  pipelineRunId: string,
  reviewScore?: number
): HITLRequest {
  return {
    id: `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    pipelineRunId,
    stage,
    agentOutput,
    reviewScore,
    requestedAt: Date.now(),
  };
}

/**
 * Called by the orchestrator — suspends pipeline execution until a
 * human submits a decision or the 10-minute timeout elapses.
 */
export function waitForHumanDecision(requestId: string): Promise<HITLResponse> {
  return new Promise((resolve) => {
    pendingDecisions.set(requestId, resolve);

    // Auto-approve after timeout to prevent deadlock
    setTimeout(() => {
      if (pendingDecisions.has(requestId)) {
        pendingDecisions.delete(requestId);
        resolve({
          requestId,
          decision: 'approved',
          reviewerNote: 'Auto-approved after 10-minute timeout',
          decidedAt: Date.now(),
        });
      }
    }, TIMEOUT_MS);
  });
}

/**
 * Called by the HITL API route when a user submits their decision.
 * Returns true if the request was found and resolved, false otherwise.
 */
export function resolveHITLDecision(response: HITLResponse): boolean {
  const resolver = pendingDecisions.get(response.requestId);
  if (!resolver) return false;
  pendingDecisions.delete(response.requestId);
  resolver(response);
  return true;
}

/**
 * Returns whether a given requestId is currently awaiting a decision.
 */
export function isPending(requestId: string): boolean {
  return pendingDecisions.has(requestId);
}
