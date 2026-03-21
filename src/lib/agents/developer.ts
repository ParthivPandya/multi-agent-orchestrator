// ============================================================
// Agent 3 — Developer Agent
// Gap #9: Enhanced with streamText for token-by-token streaming
// Gap #8: Memory context injected from analyst output
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { DEVELOPER_SYSTEM_PROMPT, getDeveloperPrompt } from '@/lib/prompts/developer.prompt';

const config = AGENT_CONFIGS['developer'];

/**
 * Run the developer agent.
 * If an onChunk callback is provided, uses streamText for live token output.
 * Falls back to generateText if streaming fails.
 */
export async function runDeveloper(
    tasks: string,
    requirements: string,
    context: AgentContext,
    reviewerFeedback?: string,
    ragAndSearchContext?: string,
    onChunk?: (chunk: string) => void
): Promise<AgentResult> {
    const startTime = Date.now();
    try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
        const iteration = context.getIterationCount('developer') + 1;
        const prompt = getDeveloperPrompt(tasks, requirements, reviewerFeedback, ragAndSearchContext);

        // Gap #9: Use streamText when a chunk callback is provided
        if (onChunk) {
            try {
                const { textStream, usage } = await streamText({
                    model: groq(config.model),
                    system: DEVELOPER_SYSTEM_PROMPT,
                    prompt,
                    maxOutputTokens: config.maxTokens,
                    temperature: 0.5,
                });

                let fullText = '';
                for await (const chunk of textStream) {
                    fullText += chunk;
                    onChunk(chunk);
                }

                const resolvedUsage = await usage;
                const result: AgentResult = {
                    agentName: 'developer',
                    status: 'complete',
                    output: fullText,
                    timestamp: new Date().toISOString(),
                    model: config.model,
                    tokensUsed: resolvedUsage?.totalTokens,
                    iterationNumber: iteration,
                    latencyMs: Date.now() - startTime,
                };

                context.add(result);
                return result;
            } catch (streamError) {
                // Streaming failed — fall through to generateText
                console.warn('[developer] streamText failed, falling back to generateText:', streamError);
            }
        }

        // Fallback: standard generateText (non-streaming)
        const { text, usage } = await generateText({
            model: groq(config.model),
            system: DEVELOPER_SYSTEM_PROMPT,
            prompt,
            maxOutputTokens: config.maxTokens,
            temperature: 0.5,
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
