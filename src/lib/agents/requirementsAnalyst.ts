// ============================================================
// Agent 1 — Requirements Analyst
// Model: llama-3.1-8b-instant (fast structured extraction)
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { ANALYST_SYSTEM_PROMPT, getAnalystPrompt } from '@/lib/prompts/analyst.prompt';

const config = AGENT_CONFIGS['requirements-analyst'];

export async function runRequirementsAnalyst(
    requirement: string,
    context: AgentContext
): Promise<AgentResult> {
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

        const { text, usage } = await generateText({
            model: groq(config.model),
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
            model: config.model,
            tokensUsed: usage?.totalTokens,
        };

        context.add(result);
        return result;
    } catch (error) {
        const errorResult: AgentResult = {
            agentName: 'requirements-analyst',
            status: 'error',
            output: '',
            timestamp: new Date().toISOString(),
            model: config.model,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };

        context.add(errorResult);
        return errorResult;
    }
}
