// ============================================================
// POST /api/webhooks — Incoming Webhook Handler
// Triggers pipeline runs from external services (GitHub, Slack, etc.)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/orchestrator';
import { PipelineEvent } from '@/lib/types';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'custom';
  const secret = searchParams.get('secret');

  // Validate webhook secret if configured
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    let requirement = '';

    // Parse requirement based on source
    switch (source) {
      case 'github': {
        // GitHub issue/PR webhook
        const issueTitle = body.issue?.title || body.pull_request?.title || '';
        const issueBody = body.issue?.body || body.pull_request?.body || '';
        requirement = `${issueTitle}\n\n${issueBody}`;
        break;
      }
      case 'slack': {
        // Slack slash command or event
        requirement = body.text || body.event?.text || '';
        break;
      }
      case 'custom':
      default: {
        requirement = body.requirement || body.text || body.message || '';
        break;
      }
    }

    if (!requirement.trim()) {
      return NextResponse.json({ error: 'No requirement/text provided' }, { status: 400 });
    }

    // Collect results synchronously (non-streaming for webhooks)
    const events: PipelineEvent[] = [];
    const onEvent = (event: PipelineEvent) => { events.push(event); };

    const result = await runPipeline(requirement.trim(), onEvent, undefined, false);

    return NextResponse.json({
      success: result.success,
      source,
      requirement: requirement.trim().slice(0, 200),
      checkpointId: result.checkpointId,
      routeDecision: result.routeDecision,
      resultCount: Object.keys(result.results).length,
      events: events.length,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'webhook_listener_active',
    endpoints: {
      custom: '/api/webhooks?source=custom',
      github: '/api/webhooks?source=github',
      slack: '/api/webhooks?source=slack',
    },
    usage: 'POST a JSON body with {"requirement": "your requirement text"}',
  });
}
