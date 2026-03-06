// ============================================================
// Agent 2 — Task Planner
// Model: meta-llama/llama-4-scout-17b-16e-instruct
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { PLANNER_SYSTEM_PROMPT, getPlannerPrompt } from '@/lib/prompts/planner.prompt';

const config = AGENT_CONFIGS['task-planner'];

export async function runTaskPlanner(
    requirementsJson: string,
    context: AgentContext
): Promise<AgentResult> {
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

        const { text, usage } = await generateText({
            model: groq(config.model),
            system: PLANNER_SYSTEM_PROMPT,
            prompt: getPlannerPrompt(requirementsJson),
            maxOutputTokens: config.maxTokens,
            temperature: 0.4,
        });

        const result: AgentResult = {
            agentName: 'task-planner',
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
            agentName: 'task-planner',
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
