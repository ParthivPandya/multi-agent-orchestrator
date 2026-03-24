// ============================================================
// Agent 1 — Requirements Analyst
// Model: llama-3.1-8b-instant (fast structured extraction)
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { ANALYST_SYSTEM_PROMPT, getAnalystPrompt } from '@/lib/prompts/analyst.prompt';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['requirements-analyst'];

export async function runRequirementsAnalyst(
    requirement: string,
    context: AgentContext,
    runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
    const startTime = Date.now();
    let modelLabel = config.model;
    try {
        const runtimeModel = getRuntimeModelForAgent('requirements-analyst', runtime);
        modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

        const { text, usage } = await generateText({
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: ANALYST_SYSTEM_PROMPT,
            prompt: getAnalystPrompt(requirement),
            maxOutputTokens: config.maxTokens,
            temperature: 0.3, // Low temperature for structured output
        });

        const result: AgentResult = {
            agentName: 'requirements-analyst',
            status: 'complete',
            output: text,
            timestamp: new Date().toISOString(),
            model: modelLabel,
            tokensUsed: usage?.totalTokens,
            latencyMs: Date.now() - startTime,
        };

        context.add(result);
        return result;
    } catch (error) {
        const errorResult: AgentResult = {
            agentName: 'requirements-analyst',
            status: 'error',
            output: '',
            timestamp: new Date().toISOString(),
            model: modelLabel,
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };

        context.add(errorResult);
        return errorResult;
    }
}
