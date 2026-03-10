// ============================================================
// Agent 3 — Developer Agent
// Model: qwen/qwen3-32b (best code generation on Groq free tier)
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { DEVELOPER_SYSTEM_PROMPT, getDeveloperPrompt } from '@/lib/prompts/developer.prompt';

const config = AGENT_CONFIGS['developer'];

export async function runDeveloper(
    tasks: string,
    requirements: string,
    context: AgentContext,
    reviewerFeedback?: string
): Promise<AgentResult> {
    const startTime = Date.now();
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
        const iteration = context.getIterationCount('developer') + 1;

        const { text, usage } = await generateText({
            model: groq(config.model),
            system: DEVELOPER_SYSTEM_PROMPT,
            prompt: getDeveloperPrompt(tasks, requirements, reviewerFeedback),
            maxOutputTokens: config.maxTokens,
            temperature: 0.5, // Slightly higher for creative code generation
        });

        const result: AgentResult = {
            agentName: 'developer',
            status: 'complete',
            output: text,
            timestamp: new Date().toISOString(),
            model: config.model,
            tokensUsed: usage?.totalTokens,
            iterationNumber: iteration,
            latencyMs: Date.now() - startTime,
        };

        context.add(result);
        return result;
    } catch (error) {
        const errorResult: AgentResult = {
            agentName: 'developer',
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
