'use client';

import { AgentName, AgentStatus, AgentResult, AGENT_CONFIGS } from '@/lib/types';
import AgentCard from './AgentCard';

interface PipelineViewProps {
    agentStatuses: Record<AgentName, AgentStatus>;
    agentResults: Record<string, AgentResult | null>;
    selectedAgent: AgentName | null;
    onSelectAgent: (agent: AgentName) => void;
    currentIteration: number;
    maxIterations: number;
    isRunning: boolean;
}

// Router runs first, then the standard 6 pipeline agents
const ROUTER_AGENT: AgentName = 'router-agent';

const PIPELINE_ORDER: AgentName[] = [
    'requirements-analyst',
    'task-planner',
    'developer',
    'code-reviewer',
    'testing-agent',
    'deployment-agent',
];

export default function PipelineView({
    agentStatuses,
    agentResults,
    selectedAgent,
    onSelectAgent,
    currentIteration,
    maxIterations,
    isRunning,
}: PipelineViewProps) {
    const getConnectorStatus = (index: number): string => {
        const currentAgent = PIPELINE_ORDER[index];
        const nextAgent = PIPELINE_ORDER[index + 1];

        if (agentStatuses[currentAgent] === 'complete') {
            if (agentStatuses[nextAgent] === 'running') return 'active';
            if (agentStatuses[nextAgent] === 'complete') return 'complete';
        }
        return '';
    };

    // Loop is between Developer (index 2) and Code Reviewer (index 3)
    const isInLoop = (
        agentStatuses['developer'] === 'running' ||
        agentStatuses['code-reviewer'] === 'running' ||
        (agentStatuses['developer'] === 'complete' && agentStatuses['code-reviewer'] === 'complete' &&
            agentStatuses['testing-agent'] === 'idle' && currentIteration > 1)
    );

    const routerStatus = agentStatuses[ROUTER_AGENT] ?? 'idle';
    const routerResult = agentResults[ROUTER_AGENT] ?? null;
    const routerConfig = AGENT_CONFIGS[ROUTER_AGENT];

    return (
        <div className="pipeline-section">
            <div className="pipeline-header">
                <div className="pipeline-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                        <line x1="4" y1="4" x2="9" y2="9" />
                    </svg>
                    Agent Pipeline
                    {isRunning && (
                        <span style={{
                            fontSize: '12px',
                            color: 'var(--accent-indigo)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <div className="spinner" style={{ width: '12px', height: '12px' }} />
                            Processing
                        </span>
                    )}
                </div>

                {currentIteration > 0 && (
                    <span className="pipeline-iteration-badge">
                        Iteration {currentIteration}/{maxIterations}
                    </span>
                )}
            </div>

            {/* Router Agent (Enhancement 1) — shown at top of pipeline */}
            {(routerStatus !== 'idle') && (
                <div>
                    <AgentCard
                        agentName={ROUTER_AGENT}
                        status={routerStatus}
                        result={routerResult}
                        isSelected={selectedAgent === ROUTER_AGENT}
                        onClick={() => onSelectAgent(ROUTER_AGENT)}
                    />
                    {/* Connector from router to first pipeline agent */}
                    <div className={`pipeline-connector ${routerStatus === 'complete' ? 'complete' : ''}`} />
                </div>
            )}

            {PIPELINE_ORDER.map((agentName, index) => {
                const status = agentStatuses[agentName];
                const isSkipped = status === 'skipped';

                return (
                    <div key={agentName} style={isSkipped ? { opacity: 0.35, filter: 'grayscale(0.7)' } : undefined}>
                        <AgentCard
                            agentName={agentName}
                            status={status}
                            result={agentResults[agentName.replace(/-/g, '')] || agentResults[agentName]}
                            isSelected={selectedAgent === agentName}
                            onClick={() => !isSkipped && onSelectAgent(agentName)}
                            iteration={
                                (agentName === 'developer' || agentName === 'code-reviewer') ? currentIteration : undefined
                            }
                            maxIterations={
                                (agentName === 'developer' || agentName === 'code-reviewer') ? maxIterations : undefined
                            }
                        />

                        {/* Skipped label */}
                        {isSkipped && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '2px 12px',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                            }}>
                                ⏭ Skipped by router
                            </div>
                        )}

                        {/* Connector line between agents */}
                        {index < PIPELINE_ORDER.length - 1 && (
                            <>
                                {/* Dev ↔ Reviewer loop indicator */}
                                {index === 2 && isInLoop && (
                                    <div className="loop-indicator">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 4 23 10 17 10" />
                                            <polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                        </svg>
                                        Feedback Loop — Revision {currentIteration}/{maxIterations}
                                    </div>
                                )}
                                <div className={`pipeline-connector ${getConnectorStatus(index)}`} />
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
