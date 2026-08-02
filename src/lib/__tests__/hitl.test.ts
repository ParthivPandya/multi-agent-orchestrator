// ============================================================
// Unit Tests — HITL (Human-in-the-Loop) Module
// Tests HITL request creation, decision resolution, and timeout.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createHITLRequest,
  waitForHumanDecision,
  resolveHITLDecision,
  isPending,
} from '@/lib/hitl';

describe('HITL — createHITLRequest', () => {
  it('creates a request with auto-generated ID', () => {
    const req = createHITLRequest('post_review', 'LGTM', 'run_123', 8);
    expect(req.id).toMatch(/^hitl_/);
    expect(req.stage).toBe('post_review');
    expect(req.agentOutput).toBe('LGTM');
    expect(req.pipelineRunId).toBe('run_123');
    expect(req.reviewScore).toBe(8);
    expect(req.requestedAt).toBeTypeOf('number');
  });

  it('creates requests without optional reviewScore', () => {
    const req = createHITLRequest('post_security', 'Passed', 'run_456');
    expect(req.reviewScore).toBeUndefined();
  });
});

describe('HITL — Decision Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when a human decision is submitted', async () => {
    const req = createHITLRequest('post_review', 'Code looks good', 'run_789');

    const promise = waitForHumanDecision(req.id);
    expect(isPending(req.id)).toBe(true);

    const resolved = resolveHITLDecision({
      requestId: req.id,
      decision: 'approved',
      reviewerNote: 'Ship it!',
      decidedAt: Date.now(),
    });

    expect(resolved).toBe(true);
    expect(isPending(req.id)).toBe(false);

    const result = await promise;
    expect(result.decision).toBe('approved');
    expect(result.reviewerNote).toBe('Ship it!');
  });

  it('returns false when resolving non-existent request', () => {
    const resolved = resolveHITLDecision({
      requestId: 'hitl_nonexistent',
      decision: 'approved',
      decidedAt: Date.now(),
    });
    expect(resolved).toBe(false);
  });

  it('auto-approves after 10-minute timeout', async () => {
    const req = createHITLRequest('post_review', 'Code', 'run_timeout');
    const promise = waitForHumanDecision(req.id);

    expect(isPending(req.id)).toBe(true);

    // Advance time by 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);

    const result = await promise;
    expect(result.decision).toBe('approved');
    expect(result.reviewerNote).toContain('Auto-approved');
    expect(isPending(req.id)).toBe(false);
  });

  it('does not auto-approve if already resolved before timeout', async () => {
    const req = createHITLRequest('post_review', 'Code', 'run_early');
    const promise = waitForHumanDecision(req.id);

    // Resolve immediately
    resolveHITLDecision({
      requestId: req.id,
      decision: 'rejected',
      reviewerNote: 'Needs changes',
      decidedAt: Date.now(),
    });

    const result = await promise;
    expect(result.decision).toBe('rejected');

    // Advancing time should not cause issues
    vi.advanceTimersByTime(10 * 60 * 1000);
  });
});
