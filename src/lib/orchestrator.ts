// ============================================================
// Main Orchestrator — Pipeline Controller
// Manages the entire multi-agent pipeline with feedback loops
// ============================================================

import { AgentContext } from '@/lib/context';
import { AgentResult, PipelineEvent, AgentName } from '@/lib/types';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer, isApproved } from '@/lib/agents/codeReviewer';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';

const MAX_REVIEW_ITERATIONS = 3;
const INTER_AGENT_DELAY_MS = 1500; // Rate limit protection

/**
 * Utility to wait between agent calls (rate limiting)
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main orchestration function — runs the full pipeline
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

        const requirementsResult = await runRequirementsAnalyst(requirement, context);
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

        const tasksResult = await runTaskPlanner(requirementsResult.output, context);
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

            codeResult = await runDeveloper(
                tasksResult.output,
                requirementsResult.output,
                context,
                reviewerFeedback
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

            reviewResult = await runCodeReviewer(
                codeResult.output,
                requirementsResult.output,
                context
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

            // Check if approved
            approved = isApproved(reviewResult.output);

            emitEvent(onEvent, {
                type: 'stage_complete',
                stage: 'review',
                agentName: 'code-reviewer',
                status: 'complete',
                output: reviewResult.output,
                model: reviewResult.model,
                iteration,
                timestamp: new Date().toISOString(),
            });

            if (approved) {
                break;
            }

            // Save feedback for next developer iteration
            reviewerFeedback = reviewResult.output;
            await delay(INTER_AGENT_DELAY_MS);
        }

        // If not approved after MAX iterations, proceed anyway with a warning
        if (!approved) {
            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'review',
                output: `⚠️ Code was not approved after ${MAX_REVIEW_ITERATIONS} iterations. Proceeding with deployment anyway.`,
                timestamp: new Date().toISOString(),
            });
        }

        await delay(INTER_AGENT_DELAY_MS);

        // ═══════════════════════════════════════════════════════
        // STAGE 5: Deployment Configuration
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'stage_start',
            stage: 'deployment',
            agentName: 'deployment-agent',
            status: 'running',
            timestamp: new Date().toISOString(),
        });

        const deploymentResult = await runDeploymentAgent(
            codeResult!.output,
            requirementsResult.output,
            context
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
            timestamp: new Date().toISOString(),
        });

        // ═══════════════════════════════════════════════════════
        // PIPELINE COMPLETE
        // ═══════════════════════════════════════════════════════
        emitEvent(onEvent, {
            type: 'pipeline_complete',
            output: 'All agents have completed. Pipeline finished successfully.',
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
        // Silently handle callback errors to not break the pipeline
        console.error('Failed to emit event:', event.type);
    }
}
