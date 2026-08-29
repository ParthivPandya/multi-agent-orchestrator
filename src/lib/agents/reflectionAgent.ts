// ============================================================
// Loop Engineering — Reflection Agent (Post-Pipeline Analysis)
// Analyzes the entire pipeline trajectory after completion and
// generates improvement suggestions for future runs.
// Non-blocking — runs after pipeline completes successfully.
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AuditEvent, AGENT_CONFIGS } from '@/lib/types';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['reflection-agent'];

const REFLECTION_SYSTEM_PROMPT = `You are a Pipeline Reflection Agent. Your job is to analyze a completed AI pipeline run and generate actionable improvement suggestions.

You will receive:
1. A summary of all agent results (what each agent produced)
2. Pipeline metrics (retries, iterations, timing)
3. Any errors or warnings that occurred

Your output MUST be a JSON object with this structure:
{
  "overallAssessment": "brief 1-2 sentence assessment of the pipeline run",
  "qualityScore": <1-10>,
  "insights": [
    {
      "category": "performance|quality|security|process",
      "observation": "what you observed",
      "suggestion": "what to improve next time",
      "priority": "high|medium|low"
    }
  ],
  "lessonsLearned": [
    "brief rule or pattern to remember for future runs"
  ],
  "bottlenecks": [
    { "agent": "agent-name", "issue": "what slowed it down", "fix": "suggestion" }
  ]
}

Focus on ACTIONABLE improvements. Be specific. Identify patterns.`;

export interface ReflectionReport {
  overallAssessment: string;
  qualityScore: number;
  insights: {
    category: string;
    observation: string;
    suggestion: string;
    priority: string;
  }[];
  lessonsLearned: string[];
  bottlenecks: {
    agent: string;
    issue: string;
    fix: string;
  }[];
}

/**
 * Analyzes a completed pipeline run and generates improvement suggestions.
 */
export async function runReflectionAgent(
  auditEvents: AuditEvent[],
  results: Record<string, AgentResult>,
  detectedLanguage?: string,
  runtime?: ProviderRuntimeOptions
): Promise<AgentResult & { reflectionReport?: ReflectionReport }> {
  const startTime = Date.now();
  let modelLabel = config.model;

  try {
    const runtimeModel = getRuntimeModelForAgent('reflection-agent', runtime);
    modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

    // Build pipeline summary for analysis
    const pipelineSummary = buildPipelineSummary(auditEvents, results, detectedLanguage);

    const response = await generateText({
      model: runtimeModel.model,
      system: REFLECTION_SYSTEM_PROMPT,
      prompt: pipelineSummary,
      maxTokens: config.maxTokens,
      temperature: 0.3,
    });

    const output = response.text;
    let reflectionReport: ReflectionReport | undefined;

    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reflectionReport = JSON.parse(jsonMatch[0]) as ReflectionReport;
      }
    } catch { /* JSON parse failed — output is still useful as raw text */ }

    return {
      agentName: 'reflection-agent',
      status: 'complete',
      output,
      model: modelLabel,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      tokensUsed: response.usage?.totalTokens,
      reflectionReport,
    };
  } catch (error) {
    return {
      agentName: 'reflection-agent',
      status: 'error',
      output: '',
      model: modelLabel,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Reflection agent failed',
    };
  }
}

/**
 * Builds a structured summary of the pipeline run for the reflection agent.
 */
function buildPipelineSummary(
  events: AuditEvent[],
  results: Record<string, AgentResult>,
  detectedLanguage?: string
): string {
  const sections: string[] = [];

  // 1. Pipeline overview
  const stageCompletes = events.filter(e => e.eventType === 'stage_complete');
  const stageErrors = events.filter(e => e.eventType === 'stage_error');
  const retries = events.filter(e => e.eventType === 'retry_attempt');
  const totalDuration = events.length > 1
    ? events[events.length - 1].timestamp - events[0].timestamp
    : 0;

  sections.push(`## Pipeline Run Summary
- Total stages completed: ${stageCompletes.length}
- Total errors: ${stageErrors.length}
- Total retries: ${retries.length}
- Total duration: ${(totalDuration / 1000).toFixed(1)}s
- Detected language: ${detectedLanguage || 'unknown'}`);

  // 2. Agent results summary
  sections.push(`\n## Agent Results`);
  for (const [stage, result] of Object.entries(results)) {
    const outputPreview = result.output.slice(0, 300);
    sections.push(`### ${result.agentName} (${stage})
- Status: ${result.status}
- Model: ${result.model}
- Latency: ${result.latencyMs}ms
- Tokens: ${result.tokensUsed || 'unknown'}
- Output preview: ${outputPreview}...`);
  }

  // 3. Errors and retries
  if (stageErrors.length > 0) {
    sections.push(`\n## Errors`);
    for (const err of stageErrors) {
      sections.push(`- ${err.agentName}: ${err.error}`);
    }
  }

  if (retries.length > 0) {
    sections.push(`\n## Retries`);
    for (const retry of retries) {
      sections.push(`- ${retry.agentName}: attempt ${retry.retryAttempt}`);
    }
  }

  return sections.join('\n');
}
