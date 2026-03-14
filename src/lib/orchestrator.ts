// ============================================================
// Main Orchestrator — Enhanced Pipeline Controller v2
//
// Enhancements integrated:
//   1. Intelligent Routing — classifyIntent() pre-routes before any agent runs
//   2. Agentic Tools — lintCode injected into reviewer prompt; searchWeb into developer
//   3. RAG Knowledge — retrieveRelevantChunks() prepended to developer + reviewer prompts
//   4. Flows DSL — BUILT_IN_FLOWS maps PipelineMode → agent subset
//   5. Checkpointing — saveCheckpoint() called after each agent stage
// ============================================================

import { AgentContext } from '@/lib/context';
import { AgentResult, PipelineEvent, AgentName, RouteDecision } from '@/lib/types';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer, isApproved } from '@/lib/agents/codeReviewer';
import { runTestingAgent } from '@/lib/agents/testingAgent';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';
import { classifyIntent } from '@/lib/agents/routerAgent';
import { retrieveRelevantChunks, formatRAGContext } from '@/lib/rag/retriever';
import { lintCode, formatLintResult } from '@/lib/tools/lintCode';
import { searchWeb, formatWebResults } from '@/lib/tools/searchWeb';
import { saveCheckpoint, loadCheckpoint } from '@/lib/workspace/checkpoint';
import { BUILT_IN_FLOWS, FlowDefinition } from '@/lib/flows/types';

const MAX_REVIEW_ITERATIONS = 3;
const INTER_AGENT_DELAY_MS = 1500;
const MAX_RETRY_ATTEMPTS = 3;

// ─── Utilities ────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
    return Math.min(2000 * Math.pow(2, attempt - 1), 15000);
}

async function withRetry<T extends AgentResult>(
    agentFn: () => Promise<T>,
    agentName: AgentName,
    stage: string,
    onEvent: (event: PipelineEvent) => void,
    maxAttempts = MAX_RETRY_ATTEMPTS
): Promise<T> {
    let lastResult: T | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        lastResult = await agentFn();

        if (lastResult.status !== 'error') {
            return lastResult;
        }

        if (attempt < maxAttempts) {
            const waitMs = backoffMs(attempt);
            emitEvent(onEvent, {
                type: 'retry_attempt',
                stage,
                agentName,
                retryAttempt: attempt,
                maxRetries: maxAttempts,
                output: `⚠️ ${agentName} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs / 1000}s... Error: ${lastResult.error}`,
                timestamp: new Date().toISOString(),
            });
            await delay(waitMs);
        }
    }

    return lastResult!;
}

function emitEvent(
    callback: (event: PipelineEvent) => void,
    event: PipelineEvent
): void {
    try {
        callback(event);
    } catch {
        console.error('Failed to emit event:', event.type);
    }
}

// ─── Stage runner helper ───────────────────────────────────────────────────────

async function runStage<T extends AgentResult>(
    agentFn: () => Promise<T>,
    agentName: AgentName,
    stage: string,
    onEvent: (event: PipelineEvent) => void,
    results: Record<string, AgentResult>,
    completedStages: string[],
    checkpointId: string,
    requirement: string,
    iteration?: number,
    maxIterations?: number
): Promise<{ result: T; failed: boolean }> {
    emitEvent(onEvent, {
        type: 'stage_start',
        stage,
        agentName,
        status: 'running',
        timestamp: new Date().toISOString(),
        ...(iteration !== undefined && { iteration, maxIterations }),
    });

    const result = await withRetry(agentFn, agentName, stage, onEvent);

    if (result.status === 'error') {
        emitEvent(onEvent, {
            type: 'stage_error',
            stage,
            agentName,
            status: 'error',
            error: result.error,
            timestamp: new Date().toISOString(),
        });
        return { result, failed: true };
    }

    emitEvent(onEvent, {
        type: 'stage_complete',
        stage,
        agentName,
        status: 'complete',
        output: result.output,
        model: result.model,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
        ...(iteration !== undefined && { iteration }),
    });

    // ── Enhancement 5: Checkpoint after each stage ──
    results[stage] = result;
    completedStages.push(stage);
    const newCheckpointId = await saveCheckpoint(requirement, completedStages, results, false, checkpointId);
    emitEvent(onEvent, {
        type: 'checkpoint_saved',
        checkpointId: newCheckpointId,
        stage,
        timestamp: new Date().toISOString(),
        output: `💾 Checkpoint saved (${stage} complete)`,
    });

    return { result, failed: false };
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export async function runPipeline(
    requirement: string,
    onEvent: (event: PipelineEvent) => void,
    resumeCheckpointId?: string
): Promise<{
    success: boolean;
    results: Record<string, AgentResult>;
    context: AgentContext;
    checkpointId?: string;
    routeDecision?: RouteDecision;
}> {
    const context = new AgentContext();
    const results: Record<string, AgentResult> = {};
    const completedStages: string[] = [];
    let checkpointId = resumeCheckpointId || '';

    // ── Enhancement 5: Resume from checkpoint ──────────────────────────────────
    if (resumeCheckpointId) {
        const checkpoint = await loadCheckpoint(resumeCheckpointId);
        if (checkpoint) {
            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'checkpoint',
                output: `🔄 Resuming from checkpoint. ${checkpoint.completedStages.length} stage(s) already complete: ${checkpoint.completedStages.join(', ')}`,
                timestamp: new Date().toISOString(),
            });
            // Repopulate results and emit completed stages for the UI
            Object.assign(results, checkpoint.results);
            completedStages.push(...checkpoint.completedStages);
            for (const [stage, result] of Object.entries(checkpoint.results)) {
                emitEvent(onEvent, {
                    type: 'stage_complete',
                    stage,
                    agentName: result.agentName,
                    status: 'complete',
                    output: result.output,
                    model: result.model,
                    latencyMs: result.latencyMs,
                    timestamp: result.timestamp,
                });
                context.add(result);
            }
        }
    }

    try {
        // ── Enhancement 1: Intent Classification & Routing ─────────────────────
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'routing',
            agentName: 'router-agent',
            status: 'running',
            output: '🧭 Classifying intent...',
            timestamp: new Date().toISOString(),
        });

        const routeDecision = await classifyIntent(requirement);

        emitEvent(onEvent, {
            type: 'route_decision',
            stage: 'routing',
            agentName: 'router-agent',
            status: 'complete',
            output: `🧭 Route: ${routeDecision.mode} (${Math.round(routeDecision.confidence * 100)}% confidence) — ${routeDecision.reasoning}`,
            routeDecision,
            timestamp: new Date().toISOString(),
        });

        // Get the flow for this mode
        const flowKey = routeDecision.mode.toLowerCase().replace(/_/g, '-') as keyof typeof BUILT_IN_FLOWS;
        const flowName = (['standard', 'quick-fix', 'plan-only', 'code-review-only'] as const).includes(flowKey as 'standard' | 'quick-fix' | 'plan-only' | 'code-review-only')
            ? (flowKey as 'standard' | 'quick-fix' | 'plan-only' | 'code-review-only')
            : 'standard';
        const flow: FlowDefinition = BUILT_IN_FLOWS[flowName] ?? BUILT_IN_FLOWS['standard'];

        const enabledAgents = new Set(flow.agents.map(a => a.agentName));
        const skip = (agentName: AgentName) => !enabledAgents.has(agentName);

        // ── Enhancement 3: RAG — retrieve docs relevant to the requirement ──────
        const ragChunks = retrieveRelevantChunks(requirement, 3);
        const ragContext = formatRAGContext(ragChunks);

        if (ragChunks.length > 0) {
            emitEvent(onEvent, {
                type: 'rag_retrieval',
                stage: 'rag',
                output: `📚 RAG: Retrieved ${ragChunks.length} relevant doc chunk(s): ${ragChunks.map(c => c.source).join(', ')}`,
                ragChunks,
                timestamp: new Date().toISOString(),
            });
        }

        // ── STAGE 1: Requirements Analysis ────────────────────────────────────
        let requirementsOutput = results['requirements']?.output || '';

        if (!skip('requirements-analyst') && !completedStages.includes('requirements')) {
            const { result, failed } = await runStage(
                () => runRequirementsAnalyst(requirement, context),
                'requirements-analyst',
                'requirements',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement
            );
            if (failed) return { success: false, results, context, routeDecision };
            requirementsOutput = result.output;
            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── STAGE 2: Task Planning ─────────────────────────────────────────────
        let tasksOutput = results['tasks']?.output || '';

        if (!skip('task-planner') && !completedStages.includes('tasks')) {
            const { result, failed } = await runStage(
                () => runTaskPlanner(requirementsOutput || requirement, context),
                'task-planner',
                'tasks',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement
            );
            if (failed) return { success: false, results, context, routeDecision };
            tasksOutput = result.output;
            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── STAGE 3 & 4: Developer ↔ Reviewer Feedback Loop ───────────────────
        let codeResult: AgentResult | null = results['code'] || null;
        let reviewResult: AgentResult | null = results['review'] || null;
        let approved = false;
        let reviewerFeedback: string | undefined;

        if (!skip('developer') && !completedStages.includes('code')) {
            for (let iteration = 1; iteration <= MAX_REVIEW_ITERATIONS; iteration++) {
                // ── Enhancement 2 & 3: Web search (non-blocking) + RAG injected ──
                let devSearchContext = '';
                try {
                    const searchResults = await searchWeb(`${requirement} code example best practices`, 2);
                    if (searchResults.length > 0) {
                        devSearchContext = `\n\nWeb references:\n${formatWebResults(searchResults)}`;
                        emitEvent(onEvent, {
                            type: 'tool_call',
                            stage: 'development',
                            output: `🌐 Tool: searchWeb — found ${searchResults.length} reference(s)`,
                            toolCall: { toolName: 'searchWeb', input: { query: requirement }, timestamp: new Date().toISOString() },
                            timestamp: new Date().toISOString(),
                        });
                    }
                } catch { /* non-fatal */ }

                emitEvent(onEvent, { type: 'iteration_info', stage: 'development', iteration, maxIterations: MAX_REVIEW_ITERATIONS, timestamp: new Date().toISOString() });

                const { result: devResult, failed: devFailed } = await runStage(
                    () => runDeveloper(
                        tasksOutput || requirement,
                        requirementsOutput || requirement,
                        context,
                        reviewerFeedback,
                        ragContext + devSearchContext
                    ),
                    'developer',
                    'code',
                    onEvent,
                    results,
                    completedStages,
                    checkpointId,
                    requirement,
                    iteration,
                    MAX_REVIEW_ITERATIONS
                );
                if (devFailed) return { success: false, results, context, routeDecision };
                codeResult = devResult;
                await delay(INTER_AGENT_DELAY_MS);

                if (!skip('code-reviewer')) {
                    // ── Enhancement 2: Lint the generated code before sending to reviewer ──
                    const lintResult = lintCode(codeResult.output);
                    const lintContext = formatLintResult(lintResult);

                    emitEvent(onEvent, {
                        type: 'tool_result',
                        stage: 'review',
                        output: `🔍 Tool: lintCode — Score: ${lintResult.score}/100, ${lintResult.issues.length} issue(s)`,
                        toolResult: { toolName: 'lintCode', output: lintContext, success: true, durationMs: 0 },
                        timestamp: new Date().toISOString(),
                    });

                    const { result: revResult, failed: revFailed } = await runStage(
                        () => runCodeReviewer(
                            codeResult!.output,
                            requirementsOutput || requirement,
                            context,
                            ragContext,
                            lintContext
                        ),
                        'code-reviewer',
                        'review',
                        onEvent,
                        results,
                        completedStages,
                        checkpointId,
                        requirement,
                        iteration,
                        MAX_REVIEW_ITERATIONS
                    );
                    if (revFailed) return { success: false, results, context, routeDecision };
                    reviewResult = revResult;
                    approved = isApproved(reviewResult.output);

                    if (approved) break;
                    reviewerFeedback = reviewResult.output;
                    await delay(INTER_AGENT_DELAY_MS);
                } else {
                    break; // No reviewer in this flow
                }
            }

            if (!approved && !skip('code-reviewer')) {
                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'review',
                    output: `⚠️ Code was not approved after ${MAX_REVIEW_ITERATIONS} iterations. Proceeding anyway.`,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        await delay(INTER_AGENT_DELAY_MS);

        // ── STAGE 5: Testing ───────────────────────────────────────────────────
        if (!skip('testing-agent') && !completedStages.includes('tests')) {
            emitEvent(onEvent, {
                type: 'stage_start',
                stage: 'testing',
                agentName: 'testing-agent',
                status: 'running',
                timestamp: new Date().toISOString(),
            });

            const testingResult = await withRetry(
                () => runTestingAgent(codeResult!.output, requirementsOutput || requirement, context),
                'testing-agent',
                'testing',
                onEvent
            );
            results['tests'] = testingResult;
            completedStages.push('tests');

            if (testingResult.status === 'error') {
                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'testing',
                    output: `⚠️ Testing Agent failed: ${testingResult.error}. Skipping tests.`,
                    timestamp: new Date().toISOString(),
                });
            } else {
                emitEvent(onEvent, {
                    type: 'stage_complete',
                    stage: 'testing',
                    agentName: 'testing-agent',
                    status: 'complete',
                    output: testingResult.output,
                    model: testingResult.model,
                    latencyMs: testingResult.latencyMs,
                    timestamp: new Date().toISOString(),
                });
            }
            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── STAGE 6: Deployment ────────────────────────────────────────────────
        if (!skip('deployment-agent') && !completedStages.includes('deployment')) {
            const { result: depResult, failed: depFailed } = await runStage(
                () => runDeploymentAgent(
                    codeResult?.output || requirementsOutput || requirement,
                    requirementsOutput || requirement,
                    context
                ),
                'deployment-agent',
                'deployment',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement
            );
            if (depFailed) return { success: false, results, context, routeDecision };
        }

        // ── Enhancement 5: Final checkpoint — mark complete ────────────────────
        checkpointId = await saveCheckpoint(requirement, completedStages, results, true, checkpointId);

        emitEvent(onEvent, {
            type: 'pipeline_complete',
            output: `All ${flow.agents.length} agents in "${flow.name}" have completed. Pipeline finished successfully.`,
            timestamp: new Date().toISOString(),
        });

        return { success: true, results, context, checkpointId, routeDecision };

    } catch (error) {
        emitEvent(onEvent, {
            type: 'stage_error',
            error: error instanceof Error ? error.message : 'Pipeline failed unexpectedly',
            timestamp: new Date().toISOString(),
        });
        return { success: false, results, context, checkpointId: checkpointId || undefined };
    }
}
