// ============================================================
// POST /api/orchestrate — enhanced with routing + checkpointing
// Returns a Server-Sent Events (SSE) stream for real-time updates
// ============================================================

import { NextRequest } from 'next/server';
import { runPipeline } from '@/lib/orchestrator';
import { PipelineEvent } from '@/lib/types';

export const maxDuration = 300; // 5 minutes for full pipeline

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requirement, resumeCheckpointId } = body;

        if (!requirement || typeof requirement !== 'string' || requirement.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Requirement is required and must be a non-empty string' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!process.env.GROQ_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'GROQ_API_KEY is not configured. Please set it in .env.local' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Create a ReadableStream for SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const onEvent = (event: PipelineEvent) => {
                    const data = `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                };

                try {
                    const result = await runPipeline(
                        requirement,
                        onEvent,
                        resumeCheckpointId
                    );

                    // Send final result with checkpointId and routeDecision
                    const finalEvent = `data: ${JSON.stringify({
                        type: 'final_result',
                        success: result.success,
                        results: result.results,
                        checkpointId: result.checkpointId,
                        routeDecision: result.routeDecision,
                        timestamp: new Date().toISOString(),
                    })}\n\n`;
                    controller.enqueue(encoder.encode(finalEvent));
                } catch (error) {
                    const errorEvent = `data: ${JSON.stringify({
                        type: 'stage_error',
                        error: error instanceof Error ? error.message : 'Pipeline failed',
                        timestamp: new Date().toISOString(),
                    })}\n\n`;
                    controller.enqueue(encoder.encode(errorEvent));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Internal server error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
