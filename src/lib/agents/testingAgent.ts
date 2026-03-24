// ============================================================
// Agent 6 — Testing Agent
// Model: llama-3.3-70b-versatile (strong reasoning for test generation)
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { TESTING_SYSTEM_PROMPT, getTestingPrompt } from '@/lib/prompts/testing.prompt';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['testing-agent'];

export async function runTestingAgent(
    code: string,
    requirements: string,
    context: AgentContext,
    runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
    const startTime = Date.now();
    let modelLabel = config.model;
    try {
        const runtimeModel = getRuntimeModelForAgent('testing-agent', runtime);
        modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

        const { text, usage } = await generateText({
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: TESTING_SYSTEM_PROMPT,
            prompt: getTestingPrompt(code, requirements),
            maxOutputTokens: config.maxTokens,
            temperature: 0.3, // Low temperature for deterministic tests
        });

        const result: AgentResult = {
            agentName: 'testing-agent',
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
            agentName: 'testing-agent',
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
