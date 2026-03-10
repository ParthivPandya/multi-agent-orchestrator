// ============================================================
// Pipeline History Manager
// Persists pipeline runs to localStorage for recall & analysis
// ============================================================

import { AgentResult, AgentName, PipelineHistoryEntry, PipelineAnalytics } from '@/lib/types';

const HISTORY_KEY = 'mao_pipeline_history';
const MAX_HISTORY = 20; // Keep last 20 runs

// Groq free tier: cost is $0, but we estimate as if using paid tier for display
// Using rough llama-3.3-70b pricing as reference baseline
const COST_PER_1K_TOKENS_USD = 0.0000006; // ~$0.6/M tokens (reference)

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

export function saveToHistory(
    requirement: string,
    projectName: string,
    agentResults: Record<string, AgentResult>,
    success: boolean
): PipelineHistoryEntry {
    const totalTokens = Object.values(agentResults).reduce(
        (sum, r) => sum + (r?.tokensUsed || 0), 0
    );
    const totalLatencyMs = Object.values(agentResults).reduce(
        (sum, r) => sum + (r?.latencyMs || 0), 0
    );

    const entry: PipelineHistoryEntry = {
        id: crypto.randomUUID(),
        requirement,
        timestamp: new Date().toISOString(),
        success,
        totalTokens,
        totalLatencyMs,
        agentResults,
        projectName,
    };

    if (!isBrowser()) return entry;

    try {
        const existing = loadHistory();
        const updated = [entry, ...existing].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
        // Ignore storage errors (quota exceeded, private browsing, etc.)
    }

    return entry;
}

export function loadHistory(): PipelineHistoryEntry[] {
    if (!isBrowser()) return [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as PipelineHistoryEntry[];
    } catch {
        return [];
    }
}

export function removeFromHistory(id: string): void {
    if (!isBrowser()) return;
    try {
        const existing = loadHistory();
        const updated = existing.filter(e => e.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
}

export function clearHistory(): void {
    if (!isBrowser()) return;
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch { /* ignore */ }
}

export function computeAnalytics(
    agentResults: Record<string, AgentResult>
): PipelineAnalytics {
    const agentOrder: AgentName[] = [
        'requirements-analyst',
        'task-planner',
        'developer',
        'code-reviewer',
        'testing-agent',
        'deployment-agent',
    ];

    const agentBreakdown = agentOrder
        .filter(name => agentResults[name])
        .map(name => {
            const result = agentResults[name]!;
            const tokens = result.tokensUsed || 0;
            const latencyMs = result.latencyMs || 0;
            const cost = (tokens / 1000) * COST_PER_1K_TOKENS_USD;
            return { agentName: name, tokens, latencyMs, cost };
        });

    const totalTokens = agentBreakdown.reduce((sum, a) => sum + a.tokens, 0);
    const totalLatencyMs = agentBreakdown.reduce((sum, a) => sum + a.latencyMs, 0);
    const estimatedCostUsd = agentBreakdown.reduce((sum, a) => sum + a.cost, 0);

    return { totalTokens, totalLatencyMs, agentBreakdown, estimatedCostUsd };
}
