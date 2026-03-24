// ============================================================
// Main Orchestrator — Enhanced Pipeline Controller v3
//
// Enhancements from v2:
//   1. Intelligent Routing — classifyIntent() pre-routes before any agent runs
//   2. Agentic Tools — lintCode injected into reviewer prompt; searchWeb into developer
//   3. RAG Knowledge — retrieveRelevantChunks() prepended to developer + reviewer prompts
//   4. Flows DSL — BUILT_IN_FLOWS maps PipelineMode → agent subset
//   5. Checkpointing — saveCheckpoint() called after each agent stage
//
// New v3 Enhancements (9 Gaps):
//   Gap #1: Human-in-the-Loop (HITL) approval gate after Code Review
//   Gap #3: Structured output validation at every handoff (Zod schemas)
//   Gap #4: Dedicated Security Reviewer Agent (OWASP aligned)
//   Gap #6: Parallel execution of Testing + Doc agents
//   Gap #7: Full Audit Log captured and exportable
//   Gap #8: Agent Memory — cross-session preference injection
//   Gap #9: Token Streaming — Developer agent streams character-by-character
// ============================================================

import { AgentContext } from '@/lib/context';
import { AgentResult, PipelineEvent, AgentName, RouteDecision } from '@/lib/types';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer, isApproved } from '@/lib/agents/codeReviewer';
import { runTestingAgent } from '@/lib/agents/testingAgent';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';
import { runSecurityReviewer } from '@/lib/agents/securityReviewer';
import { runTechnicalDebtScanner } from '@/lib/agents/debtScanner';
import { runComplianceAgent } from '@/lib/agents/complianceAgent';
import { classifyIntent } from '@/lib/agents/routerAgent';
import { retrieveRelevantChunks, formatRAGContext } from '@/lib/rag/retriever';
import { lintCode, formatLintResult } from '@/lib/tools/lintCode';
import { searchWeb, formatWebResults } from '@/lib/tools/searchWeb';
import { saveCheckpoint, loadCheckpoint } from '@/lib/workspace/checkpoint';
import { BUILT_IN_FLOWS, FlowDefinition } from '@/lib/flows/types';
import { createHITLRequest, waitForHumanDecision } from '@/lib/hitl';
import { AuditLog, generateRunId } from '@/lib/audit';
import { ProviderRuntimeOptions } from '@/lib/providers/runtime';
import { detectLanguage, getSkillPrompt } from '@/lib/skills/languages';
import {
  validateHandoff,
} from '@/lib/validation/handoff';
import {
  AnalystOutputSchema,
  PlannerOutputSchema,
  ReviewerOutputSchema,
} from '@/lib/validation/schemas';

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

export function emitEvent(
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

export async function runStage<T extends AgentResult>(
    agentFn: () => Promise<T>,
    agentName: AgentName,
    stage: string,
    onEvent: (event: PipelineEvent) => void,
    results: Record<string, AgentResult>,
    completedStages: string[],
    checkpointId: string,
    requirement: string,
    auditLog: AuditLog,
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

    auditLog.log({ eventType: 'stage_start', stage, agentName });

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

        auditLog.log({
            eventType: 'stage_error',
            stage,
            agentName,
            error: result.error,
            latencyMs: result.latencyMs,
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

    auditLog.log({
        eventType: 'stage_complete',
        stage,
        agentName,
        output: result.output,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokensUsed ? { inputTokens: 0, outputTokens: result.tokensUsed } : undefined,
    });

    // ── Checkpoint after each stage ──
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
    resumeCheckpointId?: string,
    hitlEnabled = false,
    runtime?: ProviderRuntimeOptions
): Promise<{
    success: boolean;
    results: Record<string, AgentResult>;
    context: AgentContext;
    checkpointId?: string;
    routeDecision?: RouteDecision;
    auditLog?: AuditLog;
    debtReport?: unknown;
    complianceReport?: unknown;
    detectedLanguage?: string;
}> {
    const context = new AgentContext();
    const results: Record<string, AgentResult> = {};
    const completedStages: string[] = [];
    let checkpointId = resumeCheckpointId || '';
    const auditLog = new AuditLog(generateRunId());

    auditLog.log({ eventType: 'pipeline_start', input: requirement });

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

        const routeDecision = await classifyIntent(requirement, runtime);

        emitEvent(onEvent, {
            type: 'route_decision',
            stage: 'routing',
            agentName: 'router-agent',
            status: 'complete',
            output: `🧭 Route: ${routeDecision.mode} (${Math.round(routeDecision.confidence * 100)}% confidence) — ${routeDecision.reasoning}`,
            routeDecision,
            timestamp: new Date().toISOString(),
        });

        const flowKey = routeDecision.mode.toLowerCase().replace(/_/g, '-') as keyof typeof BUILT_IN_FLOWS;
        const flowName = (['standard', 'quick-fix', 'plan-only', 'code-review-only'] as const).includes(flowKey as 'standard' | 'quick-fix' | 'plan-only' | 'code-review-only')
            ? (flowKey as 'standard' | 'quick-fix' | 'plan-only' | 'code-review-only')
            : 'standard';
        const flow: FlowDefinition = BUILT_IN_FLOWS[flowName] ?? BUILT_IN_FLOWS['standard'];

        const enabledAgents = new Set(flow.agents.map(a => a.agentName));
        const skip = (agentName: AgentName) => !enabledAgents.has(agentName);

        // ── Enhancement 3: RAG ──────────────────────────────────────────────────
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
                () => runRequirementsAnalyst(requirement, context, runtime),
                'requirements-analyst',
                'requirements',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement,
                auditLog
            );
            if (failed) {
                auditLog.log({ eventType: 'pipeline_aborted', error: 'Requirements analyst failed' });
                return { success: false, results, context, routeDecision, auditLog };
            }
            requirementsOutput = result.output;

            // Gap #3: Validate analyst output
            const analystValidation = validateHandoff('requirements-analyst', requirementsOutput, AnalystOutputSchema);
            if (!analystValidation.success) {
                emitEvent(onEvent, {
                    type: 'validation_error',
                    stage: 'requirements',
                    agentName: 'requirements-analyst',
                    details: analystValidation.errors,
                    output: `⚠️ Analyst output validation warning: ${analystValidation.errors?.join('; ')}`,
                    timestamp: new Date().toISOString(),
                });
                auditLog.log({ eventType: 'validation_error', stage: 'requirements', error: analystValidation.errors?.join('; ') });
            }

            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── STAGE 2: Task Planning ─────────────────────────────────────────────
        let tasksOutput = results['tasks']?.output || '';

        if (!skip('task-planner') && !completedStages.includes('tasks')) {
            const { result, failed } = await runStage(
                () => runTaskPlanner(requirementsOutput || requirement, context, runtime),
                'task-planner',
                'tasks',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement,
                auditLog
            );
            if (failed) {
                auditLog.log({ eventType: 'pipeline_aborted', error: 'Task planner failed' });
                return { success: false, results, context, routeDecision, auditLog };
            }
            tasksOutput = result.output;

            // Gap #3: Validate planner output
            const plannerValidation = validateHandoff('task-planner', tasksOutput, PlannerOutputSchema);
            if (!plannerValidation.success) {
                emitEvent(onEvent, {
                    type: 'validation_error',
                    stage: 'tasks',
                    agentName: 'task-planner',
                    details: plannerValidation.errors,
                    output: `⚠️ Planner output validation warning: ${plannerValidation.errors?.join('; ')}`,
                    timestamp: new Date().toISOString(),
                });
                auditLog.log({ eventType: 'validation_error', stage: 'tasks', error: plannerValidation.errors?.join('; ') });
            }

            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── Feature 5: Auto-detect language from requirement ───────────────────
        const detectedLanguage = detectLanguage(requirementsOutput || requirement);
        const languageSkillPrompt = getSkillPrompt(detectedLanguage);

        emitEvent(onEvent, {
            type: 'iteration_info',
            stage: 'language_detection',
            output: `🌐 Language detected: ${detectedLanguage} — skill injected into Developer agent`,
            timestamp: new Date().toISOString(),
        });

        // ── STAGE 3 & 4: Developer ↔ Reviewer Feedback Loop ───────────────────
        let codeResult: AgentResult | null = results['code'] || null;
        let reviewResult: AgentResult | null = results['review'] || null;
        let approved = false;
        let reviewerFeedback: string | undefined;

        if (!skip('developer') && !completedStages.includes('code')) {
            for (let iteration = 1; iteration <= MAX_REVIEW_ITERATIONS; iteration++) {
                // ── Enhancement 2 & 3: Web search + RAG injected ──
                let devSearchContext = '';
                try {
                    const searchResults = await searchWeb(`${requirement} ${detectedLanguage} code example best practices`, 2);
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

                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'development',
                    iteration,
                    maxIterations: MAX_REVIEW_ITERATIONS,
                    timestamp: new Date().toISOString(),
                });

                // Gap #9: Stream developer tokens to UI
                const developerChunkHandler = (chunk: string) => {
                    emitEvent(onEvent, {
                        type: 'stage_token',
                        stage: 'code',
                        agentName: 'developer',
                        token: chunk,
                        timestamp: new Date().toISOString(),
                    });
                };

                // Emit stage_start for developer before streaming begins
                emitEvent(onEvent, {
                    type: 'stage_start',
                    stage: 'code',
                    agentName: 'developer',
                    status: 'running',
                    timestamp: new Date().toISOString(),
                    iteration,
                    maxIterations: MAX_REVIEW_ITERATIONS,
                });

                auditLog.log({ eventType: 'stage_start', stage: 'code', agentName: 'developer' });

                const devResult = await withRetry(
                    () => runDeveloper(
                        tasksOutput || requirement,
                        requirementsOutput || requirement,
                        context,
                        reviewerFeedback,
                        ragContext + devSearchContext,
                        developerChunkHandler,
                        languageSkillPrompt,  // Feature 5: language skill injection
                        runtime
                    ),
                    'developer',
                    'code',
                    onEvent
                );

                if (devResult.status === 'error') {
                    emitEvent(onEvent, {
                        type: 'stage_error',
                        stage: 'code',
                        agentName: 'developer',
                        status: 'error',
                        error: devResult.error,
                        timestamp: new Date().toISOString(),
                    });
                    auditLog.log({ eventType: 'stage_error', stage: 'code', error: devResult.error });
                    return { success: false, results, context, routeDecision, auditLog };
                }

                emitEvent(onEvent, {
                    type: 'stage_complete',
                    stage: 'code',
                    agentName: 'developer',
                    status: 'complete',
                    output: devResult.output,
                    model: devResult.model,
                    latencyMs: devResult.latencyMs,
                    timestamp: new Date().toISOString(),
                    iteration,
                });

                auditLog.log({
                    eventType: 'stage_complete',
                    stage: 'code',
                    agentName: 'developer',
                    output: devResult.output,
                    latencyMs: devResult.latencyMs,
                });

                results['code'] = devResult;
                completedStages.push('code');
                codeResult = devResult;
                await delay(INTER_AGENT_DELAY_MS);

                if (!skip('code-reviewer')) {
                    // ── Enhancement 2: Lint before reviewer ──
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
                            lintContext,
                            runtime
                        ),
                        'code-reviewer',
                        'review',
                        onEvent,
                        results,
                        completedStages,
                        checkpointId,
                        requirement,
                        auditLog,
                        iteration,
                        MAX_REVIEW_ITERATIONS
                    );
                    if (revFailed) {
                        auditLog.log({ eventType: 'pipeline_aborted', error: 'Code reviewer failed' });
                        return { success: false, results, context, routeDecision, auditLog };
                    }
                    reviewResult = revResult;

                    // Gap #3: Validate reviewer output
                    const reviewerValidation = validateHandoff('code-reviewer', reviewResult.output, ReviewerOutputSchema);
                    if (!reviewerValidation.success) {
                        emitEvent(onEvent, {
                            type: 'validation_error',
                            stage: 'review',
                            agentName: 'code-reviewer',
                            details: reviewerValidation.errors,
                            output: `⚠️ Reviewer output validation warning: ${reviewerValidation.errors?.join('; ')}`,
                            timestamp: new Date().toISOString(),
                        });
                    }

                    approved = isApproved(reviewResult.output);

                    // ── Gap #1: HITL approval gate after code is approved ──
                    if (approved && hitlEnabled) {
                        const hitlRequest = createHITLRequest(
                            'post_review',
                            codeResult.output,
                            auditLog.getRunId(),
                            reviewerValidation.data?.score as number | undefined
                        );

                        emitEvent(onEvent, {
                            type: 'hitl_requested',
                            stage: 'post_review',
                            requestId: hitlRequest.id,
                            reviewScore: hitlRequest.reviewScore,
                            output: hitlRequest.agentOutput,
                            timestamp: new Date().toISOString(),
                        });

                        auditLog.log({
                            eventType: 'hitl_requested',
                            stage: 'post_review',
                            metadata: { requestId: hitlRequest.id },
                        });

                        const humanDecision = await waitForHumanDecision(hitlRequest.id);

                        emitEvent(onEvent, {
                            type: 'hitl_resolved',
                            decision: humanDecision.decision,
                            feedback: humanDecision.feedback,
                            timestamp: new Date().toISOString(),
                        });

                        auditLog.log({
                            eventType: 'hitl_resolved',
                            decision: humanDecision.decision,
                            metadata: { feedback: humanDecision.feedback, requestId: hitlRequest.id },
                        });

                        if (humanDecision.decision === 'rejected') {
                            emitEvent(onEvent, {
                                type: 'stage_error',
                                stage: 'hitl',
                                error: `Pipeline rejected by human reviewer: ${humanDecision.feedback || 'No feedback provided'}`,
                                timestamp: new Date().toISOString(),
                            });
                            auditLog.log({ eventType: 'pipeline_aborted', error: 'Rejected by human reviewer' });
                            return { success: false, results, context, routeDecision, auditLog };
                        }

                        if (humanDecision.decision === 'changes_requested') {
                            // Re-enter developer loop with human feedback
                            reviewerFeedback = `Human reviewer requested changes: ${humanDecision.feedback}\n\n${reviewResult.output}`;
                            approved = false;
                            await delay(INTER_AGENT_DELAY_MS);
                            continue;
                        }
                        // 'approved' falls through — continue pipeline
                    }

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

        // ── Gap #4: Security Reviewer ─────────────────────────────────────────
        const securityCode = codeResult?.output || requirementsOutput || requirement;

        if (!skip('developer') && codeResult && !completedStages.includes('security')) {
            emitEvent(onEvent, {
                type: 'stage_start',
                stage: 'security',
                agentName: 'security-reviewer',
                status: 'running',
                timestamp: new Date().toISOString(),
            });

            auditLog.log({ eventType: 'stage_start', stage: 'security', agentName: 'security-reviewer' });

            const securityResult = await runSecurityReviewer(securityCode, context, runtime);

            emitEvent(onEvent, {
                type: 'stage_complete',
                stage: 'security',
                agentName: 'security-reviewer',
                status: 'complete',
                output: securityResult.output,
                model: securityResult.model,
                latencyMs: securityResult.latencyMs,
                blocked: securityResult.blocked,
                severity: securityResult.securityOutput?.severity,
                vulnerabilities: securityResult.securityOutput?.vulnerabilities,
                timestamp: new Date().toISOString(),
            });

            auditLog.log({
                eventType: 'stage_complete',
                stage: 'security',
                agentName: 'security-reviewer',
                output: securityResult.output,
                latencyMs: securityResult.latencyMs,
                metadata: {
                    severity: securityResult.securityOutput?.severity,
                    blocked: securityResult.blocked,
                },
            });

            results['security'] = securityResult;
            completedStages.push('security');

            if (securityResult.blocked) {
                emitEvent(onEvent, {
                    type: 'pipeline_blocked',
                    stage: 'security',
                    severity: securityResult.securityOutput?.severity,
                    vulnerabilities: securityResult.securityOutput?.vulnerabilities,
                    error: `Pipeline blocked: ${securityResult.securityOutput?.severity?.toUpperCase()} security vulnerabilities detected`,
                    timestamp: new Date().toISOString(),
                });

                auditLog.log({
                    eventType: 'security_blocked',
                    stage: 'security',
                    error: `Blocked due to ${securityResult.securityOutput?.severity} vulnerabilities`,
                });

                return { success: false, results, context, routeDecision, auditLog };
            }

            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── Feature 4: Compliance Agent gate ──────────────────────────────────
        let complianceReport = undefined;
        if (codeResult?.output && !completedStages.includes('compliance')) {
            emitEvent(onEvent, {
                type: 'iteration_info',
                stage: 'compliance',
                output: '⚖️ Running compliance analysis (OWASP/GDPR/SOC2)...',
                timestamp: new Date().toISOString(),
            });
            try {
                const complianceResult = await runComplianceAgent(
                    codeResult.output,
                    ['OWASP_TOP10', 'GDPR', 'SOC2']
                );
                complianceReport = complianceResult.complianceReport;
                results['compliance'] = complianceResult;
                completedStages.push('compliance');

                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'compliance',
                    output: `⚖️ Compliance status: ${complianceResult.complianceReport?.overallStatus ?? 'WARNING'} (${complianceResult.complianceReport?.overallScore ?? 0}/100)`,
                    timestamp: new Date().toISOString(),
                });

                auditLog.log({
                    eventType: 'stage_complete',
                    stage: 'compliance',
                    agentName: 'compliance-agent',
                    output: complianceResult.output,
                    latencyMs: complianceResult.latencyMs,
                    metadata: {
                        overallStatus: complianceResult.complianceReport?.overallStatus,
                        blockedByCompliance: complianceResult.complianceReport?.blockedByCompliance,
                    },
                });

                if (complianceResult.complianceReport?.blockedByCompliance) {
                    emitEvent(onEvent, {
                        type: 'pipeline_blocked',
                        stage: 'compliance',
                        error: 'Pipeline blocked by Compliance Agent due to critical violations.',
                        timestamp: new Date().toISOString(),
                    });
                    auditLog.log({
                        eventType: 'pipeline_aborted',
                        stage: 'compliance',
                        error: 'Blocked by compliance critical violations',
                    });
                    return { success: false, results, context, routeDecision, auditLog, complianceReport, detectedLanguage };
                }
            } catch {
                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'compliance',
                    output: '⚠️ Compliance analysis unavailable for this run. Pipeline continues.',
                    timestamp: new Date().toISOString(),
                });
            }

            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── Gap #6: Parallel Execution — Testing runs in parallel ─────────────
        if (!skip('testing-agent') && !completedStages.includes('tests')) {
            emitEvent(onEvent, {
                type: 'parallel_group_start',
                agents: ['testing-agent'],
                timestamp: new Date().toISOString(),
                output: '⚡ Starting parallel execution: Testing Agent',
            });

            auditLog.log({ eventType: 'parallel_group_start', metadata: { agents: ['testing-agent'] } });

            const [testingOutcome] = await Promise.allSettled([
                withRetry(
                    () => runTestingAgent(
                        codeResult?.output || requirementsOutput || requirement,
                        requirementsOutput || requirement,
                        context,
                        runtime
                    ),
                    'testing-agent',
                    'testing',
                    onEvent
                ),
            ]);

            const testingResult = testingOutcome.status === 'fulfilled' ? testingOutcome.value : null;

            if (testingResult && testingResult.status !== 'error') {
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
                auditLog.log({
                    eventType: 'stage_complete',
                    stage: 'testing',
                    agentName: 'testing-agent',
                    output: testingResult.output,
                    latencyMs: testingResult.latencyMs,
                });
                results['tests'] = testingResult;
                completedStages.push('tests');
            } else {
                emitEvent(onEvent, {
                    type: 'iteration_info',
                    stage: 'testing',
                    output: `⚠️ Testing Agent failed or was skipped. Pipeline continues.`,
                    timestamp: new Date().toISOString(),
                });
            }

            emitEvent(onEvent, {
                type: 'parallel_group_complete',
                agents: ['testing-agent'],
                timestamp: new Date().toISOString(),
                output: '✅ Parallel execution complete',
            });

            auditLog.log({ eventType: 'parallel_group_complete', metadata: { agents: ['testing-agent'] } });

            await delay(INTER_AGENT_DELAY_MS);
        }

        // ── STAGE 6: Deployment ────────────────────────────────────────────────
        if (!skip('deployment-agent') && !completedStages.includes('deployment')) {
            const { result: depResult, failed: depFailed } = await runStage(
                () => runDeploymentAgent(
                    codeResult?.output || requirementsOutput || requirement,
                    requirementsOutput || requirement,
                    context,
                    runtime
                ),
                'deployment-agent',
                'deployment',
                onEvent,
                results,
                completedStages,
                checkpointId,
                requirement,
                auditLog
            );
            if (depFailed) {
                auditLog.log({ eventType: 'pipeline_aborted', error: 'Deployment agent failed' });
                return { success: false, results, context, routeDecision, auditLog };
            }
        }

        // ── Enhancement 5: Final checkpoint — mark complete ────────────────────
        checkpointId = await saveCheckpoint(requirement, completedStages, results, true, checkpointId);

        auditLog.log({
            eventType: 'pipeline_complete',
            output: `Pipeline completed. ${completedStages.length} stages finished.`,
        });

        emitEvent(onEvent, {
            type: 'pipeline_complete',
            output: `All ${flow.agents.length} agents in "${flow.name}" have completed. Pipeline finished successfully.`,
            timestamp: new Date().toISOString(),
        });

        // ── Feature 2: Non-blocking Technical Debt Scan ────────────────────────
        let debtReport = undefined;
        if (codeResult?.output) {
            try {
                const debtResult = await runTechnicalDebtScanner(
                    codeResult.output,
                    detectedLanguage
                );
                if (debtResult.status === 'complete') {
                    debtReport = (debtResult as { debtReport?: unknown }).debtReport;
                    emitEvent(onEvent, {
                        type: 'iteration_info',
                        stage: 'debt_scan',
                        output: `🏗️ Technical Debt Scan complete — Grade: ${(debtReport as { grade?: string })?.grade ?? 'N/A'}, Score: ${(debtReport as { debtScore?: number })?.debtScore?.toFixed(1) ?? '?'}/10`,
                        timestamp: new Date().toISOString(),
                    });
                    results['debt-scan'] = debtResult;
                }
            } catch { /* non-fatal — debt scan is always optional */ }
        }

        return { success: true, results, context, checkpointId, routeDecision, auditLog, debtReport, complianceReport, detectedLanguage };


    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Pipeline failed unexpectedly';
        emitEvent(onEvent, {
            type: 'stage_error',
            error: errMsg,
            timestamp: new Date().toISOString(),
        });
        auditLog.log({ eventType: 'pipeline_aborted', error: errMsg });
        return { success: false, results, context, checkpointId: checkpointId || undefined, auditLog };
    }
}
