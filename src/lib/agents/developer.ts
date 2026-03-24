// ============================================================
// Agent 3 — Developer Agent
// Gap #9: Enhanced with streamText for token-by-token streaming
// Gap #8: Memory context injected from analyst output
// Feature 5: Language skill injection for multi-language support
// ============================================================

import { generateText, streamText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { DEVELOPER_SYSTEM_PROMPT, getDeveloperPrompt } from '@/lib/prompts/developer.prompt';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['developer'];

/**
 * Run the developer agent.
 * If an onChunk callback is provided, uses streamText for live token output.
 * Falls back to generateText if streaming fails.
 * languageSkillPrompt: injected from Feature 5 language skill registry.
 */
export async function runDeveloper(
    tasks: string,
    requirements: string,
    context: AgentContext,
    reviewerFeedback?: string,
    ragAndSearchContext?: string,
    onChunk?: (chunk: string) => void,
    languageSkillPrompt?: string,
    runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
    const startTime = Date.now();
    let modelLabel = config.model;
    try {
        const runtimeModel = getRuntimeModelForAgent('developer', runtime);
        modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;
        const iteration = context.getIterationCount('developer') + 1;
        const prompt = getDeveloperPrompt(tasks, requirements, reviewerFeedback, ragAndSearchContext);

        // Feature 5: Append language-specific idioms to the system prompt
        const systemPrompt = languageSkillPrompt
            ? `${DEVELOPER_SYSTEM_PROMPT}\n\n${languageSkillPrompt}`
            : DEVELOPER_SYSTEM_PROMPT;

        // Gap #9: Use streamText when a chunk callback is provided
        if (onChunk) {
            try {
                const { textStream, usage } = await streamText({
                    model: runtimeModel.model as Parameters<typeof streamText>[0]['model'],
                    system: systemPrompt,
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
                    model: modelLabel,
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
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: systemPrompt,
            prompt,
            maxOutputTokens: config.maxTokens,
            temperature: 0.5,
        });

        const result: AgentResult = {
            agentName: 'developer',
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
            agentName: 'developer',
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
