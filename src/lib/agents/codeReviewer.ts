// ============================================================
// Agent 4 — Code Reviewer
// Model: llama-3.3-70b-versatile (strongest reasoning on free tier)
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { REVIEWER_SYSTEM_PROMPT, getReviewerPrompt } from '@/lib/prompts/reviewer.prompt';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['code-reviewer'];

export async function runCodeReviewer(
    code: string,
    requirements: string,
    context: AgentContext,
    ragContext?: string,
    lintContext?: string,
    runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
    const startTime = Date.now();
    let modelLabel = config.model;
    try {
        const runtimeModel = getRuntimeModelForAgent('code-reviewer', runtime);
        modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;
        const iteration = context.getIterationCount('code-reviewer') + 1;

        const { text, usage } = await generateText({
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: REVIEWER_SYSTEM_PROMPT,
            prompt: getReviewerPrompt(code, requirements, ragContext, lintContext),
            maxOutputTokens: config.maxTokens,
            temperature: 0.2, // Low temperature for consistent evaluation
        });

        const result: AgentResult = {
            agentName: 'code-reviewer',
            status: 'complete',
            output: text,
            timestamp: new Date().toISOString(),
            model: modelLabel,
            tokensUsed: usage?.totalTokens,
            iterationNumber: iteration,
            latencyMs: Date.now() - startTime,
        };

        context.add(result);
        return result;
    } catch (error) {
        const errorResult: AgentResult = {
            agentName: 'code-reviewer',
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

/**
 * Parse the reviewer's output to determine if code was approved
 */
export function isApproved(reviewOutput: string): boolean {
    const firstLine = reviewOutput.trim().split('\n')[0].trim().toUpperCase();
    return firstLine.startsWith('APPROVED');
}
