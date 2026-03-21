'use client';

import { AgentName, AgentStatus, AGENT_CONFIGS, AgentResult } from '@/lib/types';

interface AgentCardProps {
    agentName: AgentName;
    status: AgentStatus;
    result?: AgentResult | null;
    isSelected: boolean;
    onClick: () => void;
    iteration?: number;
    maxIterations?: number;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
    idle: 'Waiting',
    running: 'Running...',
    complete: 'Complete',
    error: 'Failed',
    skipped: 'Skipped',
    waiting_hitl: 'Awaiting Review',
};

const STATUS_ICONS: Record<AgentStatus, string> = {
    idle: '⏳',
    running: '🔄',
    complete: '✅',
    error: '❌',
    skipped: '⏭',
    waiting_hitl: '⏸️',
};

export default function AgentCard({
    agentName,
    status,
    result,
    isSelected,
    onClick,
    iteration,
    maxIterations,
}: AgentCardProps) {
    const config = AGENT_CONFIGS[agentName];

    return (
        <div
            className={`agent-card status-${status} ${isSelected ? 'active' : ''} animate-fade-in`}
            style={{ '--agent-color': config.color } as React.CSSProperties}
            onClick={onClick}
            role="button"
            tabIndex={0}
            id={`agent-card-${agentName}`}
        >
            <div className="agent-icon" style={{ background: `${config.color}15` }}>
                {config.icon}
            </div>

            <div className="agent-info">
                <div className="agent-name">{config.displayName}</div>
                <div className="agent-description">{config.description}</div>
            </div>

            <div className="agent-meta">
                <span className="agent-model-tag">{config.model.split('/').pop()}</span>

                {iteration !== undefined && (agentName === 'developer' || agentName === 'code-reviewer') && (
                    <span className="pipeline-iteration-badge">
                        Rev {iteration}/{maxIterations || 3}
                    </span>
                )}

                <div className={`agent-status-indicator ${status}`}>
                    {status === 'running' ? (
                        <div className="spinner" />
                    ) : (
                        <span>{STATUS_ICONS[status]}</span>
                    )}
                    <span>{STATUS_LABELS[status]}</span>
                </div>

                {result?.tokensUsed && (
                    <span className="agent-model-tag" style={{ borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)' }}>
                        {result.tokensUsed} tokens
                    </span>
                )}
            </div>
        </div>
    );
}
