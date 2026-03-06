// ============================================================
// Agent Context — Shared state management between agents
// ============================================================

import { AgentResult } from '@/lib/types';

export class AgentContext {
    private history: AgentResult[] = [];

    add(result: AgentResult): void {
        this.history.push(result);
    }

    getHistory(): AgentResult[] {
        return [...this.history];
    }

    getLastOutput(agentName: string): string | null {
        const results = this.history.filter(r => r.agentName === agentName);
        return results.length > 0 ? results[results.length - 1].output : null;
    }

    getLastResult(agentName: string): AgentResult | null {
        const results = this.history.filter(r => r.agentName === agentName);
        return results.length > 0 ? results[results.length - 1] : null;
    }

    /**
     * Generate a compressed summary of all agent outputs for context efficiency.
     * This keeps token usage low when passing context between agents.
     */
    getSummary(): string {
        if (this.history.length === 0) return 'No previous agent outputs.';

        return this.history
            .map(r => {
                // Truncate very long outputs in the summary
                const truncated = r.output.length > 1500
                    ? r.output.substring(0, 1500) + '\n... [truncated for brevity]'
                    : r.output;
                return `--- ${r.agentName} (${r.model}) ---\n${truncated}`;
            })
            .join('\n\n');
    }

    /**
     * Get the number of iterations for a specific agent
     */
    getIterationCount(agentName: string): number {
        return this.history.filter(r => r.agentName === agentName).length;
    }

    reset(): void {
        this.history = [];
    }

    toJSON(): object {
        return {
            history: this.history,
            agentCount: this.history.length,
        };
    }
}
