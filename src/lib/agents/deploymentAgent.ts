// ============================================================
// Agent 5 — Deployment Agent
// Model: llama-3.1-8b-instant (fast, template-based work)
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { DEPLOYER_SYSTEM_PROMPT, getDeployerPrompt } from '@/lib/prompts/deployer.prompt';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['deployment-agent'];

export async function runDeploymentAgent(
    code: string,
    requirements: string,
    context: AgentContext,
    runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
    const startTime = Date.now();
    let modelLabel = config.model;
    try {
        const runtimeModel = getRuntimeModelForAgent('deployment-agent', runtime);
        modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

        const { text, usage } = await generateText({
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: DEPLOYER_SYSTEM_PROMPT,
            prompt: getDeployerPrompt(code, requirements),
            maxOutputTokens: config.maxTokens,
            temperature: 0.3,
        });

        const result: AgentResult = {
            agentName: 'deployment-agent',
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
            agentName: 'deployment-agent',
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
