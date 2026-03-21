// ============================================================
// POST /api/hitl — Human-in-the-Loop Decision Endpoint
// Receives user approval/rejection/changes_requested decisions
// and resolves the pending promise in the orchestrator.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { resolveHITLDecision } from '@/lib/hitl';
import { HITLResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: HITLResponse = await req.json();

    if (!body.requestId || !body.decision) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId and decision' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'changes_requested'].includes(body.decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be: approved | rejected | changes_requested' },
        { status: 400 }
      );
    }

    const responseWithTimestamp: HITLResponse = {
      ...body,
      decidedAt: body.decidedAt ?? Date.now(),
    };

    const resolved = resolveHITLDecision(responseWithTimestamp);

    if (!resolved) {
      return NextResponse.json(
        { error: 'No pending HITL decision found for this requestId. It may have already timed out.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      decision: body.decision,
      requestId: body.requestId,
    });

  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
