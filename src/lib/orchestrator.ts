// ============================================================
// Main Orchestrator — Pipeline Controller
// Manages the 6-agent pipeline with feedback loops, retry logic,
// and the new Testing Agent (Agent 6)
// ============================================================

import { AgentContext } from '@/lib/context';
import { AgentResult, PipelineEvent, AgentName } from '@/lib/types';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer, isApproved } from '@/lib/agents/codeReviewer';
import { runTestingAgent } from '@/lib/agents/testingAgent';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';

const MAX_REVIEW_ITERATIONS = 3;
const INTER_AGENT_DELAY_MS = 1500; // Rate limit protection
const MAX_RETRY_ATTEMPTS = 3;       // Retry each agent up to 3 times

/**
 * Utility to wait between agent calls (rate limiting + retry backoff)
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff calculator
 * Attempt 1 → 2s, Attempt 2 → 4s, Attempt 3 → 8s
 */
function backoffMs(attempt: number): number {
    return Math.min(2000 * Math.pow(2, attempt - 1), 15000);
}

/**
 * Retries an agent function with exponential backoff.
 * Emits retry_attempt events so the UI can display them.
 */
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

        // On error: emit a retry event if we have more attempts
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

/**
 * Main orchestration function — runs the full 6-agent pipeline
 * Emits events via the callback for real-time frontend updates
 */
export async function runPipeline(
    requirement: string,
    onEvent: (event: PipelineEvent) => void
): Promise<{
    success: boolean;
    results: Record<string, AgentResult>;
    context: AgentContext;
}> {
    const context = new AgentContext();
    const results: Record<string, AgentResult> = {};

    try {
        // ═══════════════════════════════════════════════════════
        // STAGE 1: Requirements Analysis
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'requirements',
            agentName: 'requirements-analyst',
            status: 'running',
            timestamp: new Date().toISOString(),
        });

        const requirementsResult = await withRetry(
            () => runRequirementsAnalyst(requirement, context),
            'requirements-analyst',
            'requirements',
            onEvent
        );
        results['requirements'] = requirementsResult;

        if (requirementsResult.status === 'error') {
            emitEvent(onEvent, {
                type: 'stage_error',
                stage: 'requirements',
                agentName: 'requirements-analyst',
                status: 'error',
                error: requirementsResult.error,
                timestamp: new Date().toISOString(),
            });
            return { success: false, results, context };
        }

        emitEvent(onEvent, {
            type: 'stage_complete',
            stage: 'requirements',
            agentName: 'requirements-analyst',
            status: 'complete',
            output: requirementsResult.output,
            model: requirementsResult.model,
            latencyMs: requirementsResult.latencyMs,
            timestamp: new Date().toISOString(),
        });

        await delay(INTER_AGENT_DELAY_MS);

        // ═══════════════════════════════════════════════════════
        // STAGE 2: Task Planning
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'tasks',
            agentName: 'task-planner',
            status: 'running',
            timestamp: new Date().toISOString(),
        });

        const tasksResult = await withRetry(
            () => runTaskPlanner(requirementsResult.output, context),
            'task-planner',
            'tasks',
            onEvent
        );
        results['tasks'] = tasksResult;

        if (tasksResult.status === 'error') {
            emitEvent(onEvent, {
                type: 'stage_error',
                stage: 'tasks',
                agentName: 'task-planner',
                status: 'error',
                error: tasksResult.error,
                timestamp: new Date().toISOString(),
            });
            return { success: false, results, context };
        }

        emitEvent(onEvent, {
            type: 'stage_complete',
            stage: 'tasks',
            agentName: 'task-planner',
            status: 'complete',
            output: tasksResult.output,
            model: tasksResult.model,
            latencyMs: tasksResult.latencyMs,
            timestamp: new Date().toISOString(),
        });

        await delay(INTER_AGENT_DELAY_MS);

        // ═══════════════════════════════════════════════════════
        // STAGE 3 & 4: Developer ↔ Reviewer Feedback Loop
        // ═══════════════════════════════════════════════════════
        let codeResult: AgentResult | null = null;
        let reviewResult: AgentResult | null = null;
        let approved = false;
        let reviewerFeedback: string | undefined;

        for (let iteration = 1; iteration <= MAX_REVIEW_ITERATIONS; iteration++) {
            // --- Developer Phase ---
            emitEvent(onEvent, {
                type: 'stage_start',
                stage: 'development',
                agentName: 'developer',
                status: 'running',
                iteration,
                maxIterations: MAX_REVIEW_ITERATIONS,
                timestamp: new Date().toISOString(),
            });

            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'development',
                iteration,
                maxIterations: MAX_REVIEW_ITERATIONS,
                timestamp: new Date().toISOString(),
            });

            codeResult = await withRetry(
                () => runDeveloper(tasksResult.output, requirementsResult.output, context, reviewerFeedback),
                'developer',
                'development',
                onEvent
            );

            if (codeResult.status === 'error') {
                emitEvent(onEvent, {
                    type: 'stage_error',
                    stage: 'development',
                    agentName: 'developer',
                    status: 'error',
                    error: codeResult.error,
                    timestamp: new Date().toISOString(),
                });
                results['code'] = codeResult;
                return { success: false, results, context };
            }

            emitEvent(onEvent, {
                type: 'stage_complete',
                stage: 'development',
                agentName: 'developer',
                status: 'complete',
                output: codeResult.output,
                model: codeResult.model,
                iteration,
                latencyMs: codeResult.latencyMs,
                timestamp: new Date().toISOString(),
            });

            results['code'] = codeResult;
            await delay(INTER_AGENT_DELAY_MS);

            // --- Reviewer Phase ---
            emitEvent(onEvent, {
                type: 'stage_start',
                stage: 'review',
                agentName: 'code-reviewer',
                status: 'running',
                iteration,
                maxIterations: MAX_REVIEW_ITERATIONS,
                timestamp: new Date().toISOString(),
            });

            reviewResult = await withRetry(
                () => runCodeReviewer(codeResult!.output, requirementsResult.output, context),
                'code-reviewer',
                'review',
                onEvent
            );

            if (reviewResult.status === 'error') {
                emitEvent(onEvent, {
                    type: 'stage_error',
                    stage: 'review',
                    agentName: 'code-reviewer',
                    status: 'error',
                    error: reviewResult.error,
                    timestamp: new Date().toISOString(),
                });
                results['review'] = reviewResult;
                return { success: false, results, context };
            }

            results['review'] = reviewResult;
            approved = isApproved(reviewResult.output);

            emitEvent(onEvent, {
                type: 'stage_complete',
                stage: 'review',
                agentName: 'code-reviewer',
                status: 'complete',
                output: reviewResult.output,
                model: reviewResult.model,
                iteration,
                latencyMs: reviewResult.latencyMs,
                timestamp: new Date().toISOString(),
            });

            if (approved) break;

            reviewerFeedback = reviewResult.output;
            await delay(INTER_AGENT_DELAY_MS);
        }

        if (!approved) {
            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'review',
                output: `⚠️ Code was not approved after ${MAX_REVIEW_ITERATIONS} iterations. Proceeding anyway.`,
                timestamp: new Date().toISOString(),
            });
        }

        await delay(INTER_AGENT_DELAY_MS);

        // ═══════════════════════════════════════════════════════
        // STAGE 5: Testing Agent (NEW)
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'testing',
            agentName: 'testing-agent',
            status: 'running',
            timestamp: new Date().toISOString(),
        });

        const testingResult = await withRetry(
            () => runTestingAgent(codeResult!.output, requirementsResult.output, context),
            'testing-agent',
            'testing',
            onEvent
        );
        results['tests'] = testingResult;

        if (testingResult.status === 'error') {
            // Testing failure is non-fatal — emit warning and continue
            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'testing',
                output: `⚠️ Testing Agent failed: ${testingResult.error}. Skipping tests and proceeding to deployment.`,
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

        // ═══════════════════════════════════════════════════════
        // STAGE 6: Deployment Configuration
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'deployment',
            agentName: 'deployment-agent',
            status: 'running',
            timestamp: new Date().toISOString(),
        });

        const deploymentResult = await withRetry(
            () => runDeploymentAgent(codeResult!.output, requirementsResult.output, context),
            'deployment-agent',
            'deployment',
            onEvent
        );
        results['deployment'] = deploymentResult;

        if (deploymentResult.status === 'error') {
            emitEvent(onEvent, {
                type: 'stage_error',
                stage: 'deployment',
                agentName: 'deployment-agent',
                status: 'error',
                error: deploymentResult.error,
                timestamp: new Date().toISOString(),
            });
            return { success: false, results, context };
        }

        emitEvent(onEvent, {
            type: 'stage_complete',
            stage: 'deployment',
            agentName: 'deployment-agent',
            status: 'complete',
            output: deploymentResult.output,
            model: deploymentResult.model,
            latencyMs: deploymentResult.latencyMs,
            timestamp: new Date().toISOString(),
        });

        // ═══════════════════════════════════════════════════════
        // PIPELINE COMPLETE
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'pipeline_complete',
            output: 'All 6 agents have completed. Pipeline finished successfully.',
            timestamp: new Date().toISOString(),
        });

        return { success: true, results, context };

    } catch (error) {
        emitEvent(onEvent, {
            type: 'stage_error',
            error: error instanceof Error ? error.message : 'Pipeline failed unexpectedly',
            timestamp: new Date().toISOString(),
        });
        return { success: false, results, context };
    }
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
