// ============================================================
// Agent 5 — Deployment Agent
// Model: llama-3.1-8b-instant (fast, template-based work)
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { DEPLOYER_SYSTEM_PROMPT, getDeployerPrompt } from '@/lib/prompts/deployer.prompt';

const config = AGENT_CONFIGS['deployment-agent'];

export async function runDeploymentAgent(
    code: string,
    requirements: string,
    context: AgentContext
): Promise<AgentResult> {
    const startTime = Date.now();
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

        const { text, usage } = await generateText({
            model: groq(config.model),
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
            model: config.model,
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
            model: config.model,
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };

        context.add(errorResult);
        return errorResult;
    }
}
