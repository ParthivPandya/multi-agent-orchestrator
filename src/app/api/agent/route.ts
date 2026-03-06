// ============================================================
// POST /api/agent — Run an individual agent for testing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AgentContext } from '@/lib/context';
import { AgentName } from '@/lib/types';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer } from '@/lib/agents/codeReviewer';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { agentName, input } = body as { agentName: AgentName; input: string };

        if (!agentName || !input) {
            return NextResponse.json(
                { error: 'agentName and input are required' },
                { status: 400 }
            );
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json(
                { error: 'GROQ_API_KEY is not configured' },
                { status: 500 }
            );
        }

        const context = new AgentContext();
        let result;

        switch (agentName) {
            case 'requirements-analyst':
                result = await runRequirementsAnalyst(input, context);
                break;
            case 'task-planner':
                result = await runTaskPlanner(input, context);
                break;
            case 'developer':
                result = await runDeveloper(input, 'Requirements context not provided', context);
                break;
            case 'code-reviewer':
                result = await runCodeReviewer(input, 'Requirements context not provided', context);
                break;
            case 'deployment-agent':
                result = await runDeploymentAgent(input, 'Requirements context not provided', context);
                break;
            default:
                return NextResponse.json(
                    { error: `Unknown agent: ${agentName}` },
                    { status: 400 }
                );
        }

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
