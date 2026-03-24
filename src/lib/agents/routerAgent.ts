// ============================================================
// Router Agent — Intent Classifier (Enhancement 1)
// Model: llama-3.1-8b-instant (ultra-fast, minimal tokens)
// Classifies user input → PipelineMode in ~200ms
// ============================================================

import { generateText } from 'ai';
import { PipelineMode, RouteDecision, AgentName, AGENT_CONFIGS } from '@/lib/types';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const SKIPPED_AGENTS: Record<PipelineMode, AgentName[]> = {
    FULL_PIPELINE: [],
    QUICK_FIX: ['requirements-analyst', 'task-planner', 'testing-agent', 'deployment-agent'],
    PLAN_ONLY: ['developer', 'code-reviewer', 'testing-agent', 'deployment-agent'],
    CODE_REVIEW_ONLY: ['requirements-analyst', 'task-planner', 'developer', 'testing-agent', 'deployment-agent'],
};

const ROUTER_SYSTEM_PROMPT = `You are an intelligent request classifier for a multi-agent software development pipeline.

Your ONLY job is to classify a user request into ONE of these pipeline modes:

FULL_PIPELINE — The user wants to build something new (an app, feature, service, API, UI component from scratch, or a complex multi-step task).
QUICK_FIX — The user wants a small, targeted change (fix a bug, change styling, update a single function, tweak a value).
PLAN_ONLY — The user wants an architecture plan, design doc, or strategy but no code yet (e.g., "how should I design X?", "plan a microservice for Y").
CODE_REVIEW_ONLY — The user has pasted existing code and only wants it reviewed or explained.

RESPOND WITH EXACTLY THIS JSON FORMAT (no extra text, no markdown fences):
{"mode":"FULL_PIPELINE","reasoning":"brief one-line explanation","confidence":0.95}`;

function getModeFromJSON(text: string): RouteDecision {
    // Try clean JSON parse first
    try {
        const parsed = JSON.parse(text.trim());
        const mode: PipelineMode = parsed.mode || 'FULL_PIPELINE';
        return {
            mode,
            reasoning: parsed.reasoning || 'Auto-classified',
            confidence: parsed.confidence ?? 0.8,
            skippedAgents: SKIPPED_AGENTS[mode],
        };
    } catch {
        // Fallback: extract JSON from text
        const match = text.match(/\{[\s\S]+?\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                const mode: PipelineMode = parsed.mode || 'FULL_PIPELINE';
                return {
                    mode,
                    reasoning: parsed.reasoning || 'Auto-classified',
                    confidence: parsed.confidence ?? 0.7,
                    skippedAgents: SKIPPED_AGENTS[mode],
                };
            } catch { /* fall through */ }
        }
        // Default to full pipeline on any parse failure
        return {
            mode: 'FULL_PIPELINE',
            reasoning: 'Could not classify — defaulting to full pipeline for safety',
            confidence: 0.5,
            skippedAgents: [],
        };
    }
}

export async function classifyIntent(requirement: string, runtime?: ProviderRuntimeOptions): Promise<RouteDecision> {
    try {
        const config = AGENT_CONFIGS['router-agent'];
        const runtimeModel = getRuntimeModelForAgent('router-agent', runtime);

        const { text } = await generateText({
            model: runtimeModel.model as Parameters<typeof generateText>[0]['model'],
            system: ROUTER_SYSTEM_PROMPT,
            prompt: `User request: "${requirement}"`,
            maxOutputTokens: config.maxTokens,
            temperature: 0.1, // Near-deterministic for classification
        });

        return getModeFromJSON(text);
    } catch {
        // On any error, run the full pipeline — never block the user
        return {
            mode: 'FULL_PIPELINE',
            reasoning: 'Router unavailable — running full pipeline',
            confidence: 1.0,
            skippedAgents: [],
        };
    }
}
