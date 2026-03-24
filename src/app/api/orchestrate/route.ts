// ============================================================
// POST /api/orchestrate — DAG Topological Loop Executor
// Deeply refactored to use dagExecutor.ts instead of linear pipeline.
// ============================================================

import { NextRequest } from 'next/server';
import { PipelineEvent, AgentResult, RouteDecision } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { AuditLog, generateRunId } from '@/lib/audit';
import { saveCheckpoint, loadCheckpoint } from '@/lib/workspace/checkpoint';
import { emitEvent, runStage } from '@/lib/orchestrator';
import { topologicalSort, BUILT_IN_DAG_WORKFLOWS } from '@/lib/flows/dagExecutor';

// Agent Executors
import { classifyIntent } from '@/lib/agents/routerAgent';
import { runRequirementsAnalyst } from '@/lib/agents/requirementsAnalyst';
import { runTaskPlanner } from '@/lib/agents/taskPlanner';
import { runDeveloper } from '@/lib/agents/developer';
import { runCodeReviewer } from '@/lib/agents/codeReviewer';
import { runSecurityReviewer } from '@/lib/agents/securityReviewer';
import { runTestingAgent } from '@/lib/agents/testingAgent';
import { runDeploymentAgent } from '@/lib/agents/deploymentAgent';
import { runPipeline } from '@/lib/orchestrator';
import { ProviderRuntimeOptions } from '@/lib/providers/runtime';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            requirement,
            resumeCheckpointId,
            hitlEnabled,
            workflowId = 'standard-pipeline',
            customModels,
            apiKeys,
            ollamaUrl,
        } = body;
        const runtime: ProviderRuntimeOptions = { customModels, apiKeys, ollamaUrl };

        if (!requirement || typeof requirement !== 'string' || requirement.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'Requirement required' }), { status: 400 });
        }

        if (!process.env.GROQ_API_KEY) {
            return new Response(JSON.stringify({ error: 'GROQ_API_KEY missing' }), { status: 500 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const onEvent = (event: PipelineEvent) => {
                    const data = `data: ${JSON.stringify(event)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                };

                try {
                    // Default workflow should use the primary orchestrator path,
                    // because it includes full enterprise features (HITL, validation,
                    // retries, RAG/tools, audit and checkpoint semantics).
                    if (workflowId === 'standard-pipeline') {
                        const result = await runPipeline(requirement, onEvent, resumeCheckpointId, Boolean(hitlEnabled), runtime);
                        const finalEvent = `data: ${JSON.stringify({
                            type: 'final_result',
                            success: result.success,
                            results: result.results,
                            checkpointId: result.checkpointId,
                            routeDecision: result.routeDecision,
                            debtReport: result.debtReport,
                            complianceReport: result.complianceReport,
                            detectedLanguage: result.detectedLanguage,
                            auditLog: result.auditLog?.export(),
                            timestamp: new Date().toISOString(),
                        })}\n\n`;
                        controller.enqueue(encoder.encode(finalEvent));
                        return;
                    }

                    const workflow = BUILT_IN_DAG_WORKFLOWS[workflowId];
                    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

                    // Perform Topological Sort
                    const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);
                    
                    const context = new AgentContext();
                    const results: Record<string, AgentResult> = {};
                    const completedStages: string[] = [];
                    let checkpointId = resumeCheckpointId || '';
                    const auditLog = new AuditLog(generateRunId());
                    let routeDecision: RouteDecision | undefined;

                    auditLog.log({ eventType: 'pipeline_start', input: requirement });

                    if (resumeCheckpointId) {
                        const checkpoint = await loadCheckpoint(resumeCheckpointId);
                        if (checkpoint) {
                            emitEvent(onEvent, {
                                type: 'iteration_info',
                                stage: 'checkpoint',
                                output: `🔄 Resuming checkpoint. ${checkpoint.completedStages.length} stages complete.`,
                                timestamp: new Date().toISOString()
                            });
                            Object.assign(results, checkpoint.results);
                            completedStages.push(...checkpoint.completedStages);
                            for (const result of Object.values(checkpoint.results)) {
                                context.add(result);
                            }
                        }
                    }

                    // DAG Topological Traversal Loop
                    const skippedBranches = new Set<string>();
                    const STAGE_BY_AGENT: Record<string, string> = {
                        'router-agent': 'routing',
                        'requirements-analyst': 'requirements',
                        'task-planner': 'tasks',
                        'developer': 'code',
                        'code-reviewer': 'review',
                        'security-reviewer': 'security',
                        'testing-agent': 'tests',
                        'deployment-agent': 'deployment',
                    };

                    for (const nodeId of sortedNodes) {
                        if (skippedBranches.has(nodeId)) {
                            // If a node is in a skipped branch, also skip its descendants
                            continue;
                        }

                        const node = workflow.nodes.find(n => n.id === nodeId);
                        if (!node) continue;

                        if (node.type === 'condition') {
                            // Evaluate condition visually without running an agent
                            const condition = node.condition;
                            if (condition) {
                                let evalsToTrue = false;
                                if (condition.field === 'review.decision') {
                                    evalsToTrue = (results['review']?.output?.includes('APPROVED') || false) === (condition.value === 'APPROVED');
                                } else if (condition.field === 'security.blocked') {
                                    evalsToTrue = ((results['security']?.error ? 'true' : 'false') === condition.value);
                                }
                                
                                emitEvent(onEvent, {
                                    type: 'iteration_info',
                                    stage: 'condition_eval',
                                    output: `🔀 Evaluating condition '${node.label}': ${evalsToTrue}`,
                                    timestamp: new Date().toISOString()
                                });

                                if (evalsToTrue) {
                                    skippedBranches.add(condition.falseBranch);
                                } else {
                                    skippedBranches.add(condition.trueBranch);
                                }
                            }
                            continue;
                        }

                        if (node.type === 'parallel' || node.type === 'merge' || node.type === 'human_checkpoint') {
                            emitEvent(onEvent, {
                                type: 'iteration_info',
                                stage: node.type,
                                output: `⚙️ DAG Node logic: ${node.label} (${node.type})`,
                                timestamp: new Date().toISOString()
                            });
                            continue; // Skip execution logic, just emit progress
                        }

                        if (node.type === 'agent' && node.agentName) {
                            const agentName = node.agentName;
                            // Map agent node to specific executor based on agentName mapping
                            const stageName = STAGE_BY_AGENT[agentName] || agentName;
                            
                            if (completedStages.includes(stageName)) continue;

                            let runnerFn: () => Promise<AgentResult>;
                            
                            switch (agentName) {
                                case 'router-agent':
                                    runnerFn = async () => {
                                        const route = await classifyIntent(requirement, runtime);
                                        routeDecision = route;
                                        return { agentName, status: 'complete', output: JSON.stringify(route), timestamp: new Date().toISOString(), model: 'router-agent' };
                                    };
                                    break;
                                case 'requirements-analyst':
                                    runnerFn = () => runRequirementsAnalyst(requirement, context, runtime);
                                    break;
                                case 'task-planner':
                                    runnerFn = () => runTaskPlanner(results['requirements']?.output || requirement, context, runtime);
                                    break;
                                case 'developer':
                                    runnerFn = () => runDeveloper(
                                        results['tasks']?.output || '{}',
                                        results['requirements']?.output || requirement,
                                        context,
                                        undefined,
                                        undefined,
                                        (chunk) => onEvent({
                                            type: 'stage_token',
                                            stage: 'code',
                                            agentName: 'developer',
                                            token: chunk,
                                            timestamp: new Date().toISOString(),
                                        }),
                                        undefined,
                                        runtime
                                    );
                                    break;
                                case 'code-reviewer':
                                    runnerFn = () => runCodeReviewer(
                                        results['code']?.output || '',
                                        results['requirements']?.output || requirement,
                                        context,
                                        undefined,
                                        undefined,
                                        runtime
                                    );
                                    break;
                                case 'security-reviewer':
                                    runnerFn = () => runSecurityReviewer(results['code']?.output || '', context, runtime);
                                    break;
                                case 'testing-agent':
                                    runnerFn = () => runTestingAgent(
                                        results['code']?.output || '',
                                        results['requirements']?.output || requirement,
                                        context,
                                        runtime
                                    );
                                    break;
                                case 'deployment-agent':
                                    runnerFn = () => runDeploymentAgent(
                                        results['code']?.output || requirement,
                                        results['requirements']?.output || requirement,
                                        context,
                                        runtime
                                    );
                                    break;
                                default:
                                    throw new Error(`Agent ${agentName} not mapped`);
                            }

                            const { result, failed } = await runStage(
                                runnerFn,
                                agentName,
                                stageName,
                                onEvent,
                                results,
                                completedStages,
                                checkpointId,
                                requirement,
                                auditLog
                            );

                            context.add(result);

                            if (failed) {
                                throw new Error(`${agentName} failed in DAG loop`);
                            }
                        }
                    }

                    checkpointId = await saveCheckpoint(requirement, completedStages, results, true, checkpointId);
                    auditLog.log({ eventType: 'pipeline_complete', output: `DAG Execution finished.` });

                    const finalEvent = `data: ${JSON.stringify({
                        type: 'final_result',
                        success: true,
                        results,
                        checkpointId,
                        routeDecision,
                        auditLog: auditLog.export(),
                        timestamp: new Date().toISOString(),
                    })}\n\n`;
                    controller.enqueue(encoder.encode(finalEvent));

                } catch (error) {
                    const errorEvent = `data: ${JSON.stringify({
                        type: 'stage_error',
                        error: error instanceof Error ? error.message : 'Pipeline DAG failed',
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
            JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
