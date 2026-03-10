// ============================================================
// Agent 6 — Testing Agent
// Model: llama-3.3-70b-versatile (strong reasoning for test generation)
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { TESTING_SYSTEM_PROMPT, getTestingPrompt } from '@/lib/prompts/testing.prompt';

const config = AGENT_CONFIGS['testing-agent'];

export async function runTestingAgent(
    code: string,
    requirements: string,
    context: AgentContext
): Promise<AgentResult> {
    const startTime = Date.now();
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

        const { text, usage } = await generateText({
            model: groq(config.model),
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
            model: config.model,
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
            model: config.model,
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };

        context.add(errorResult);
        return errorResult;
    }
}
