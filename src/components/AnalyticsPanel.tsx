// ============================================================
// Analytics Panel — Token usage, latency, and cost breakdown
// ============================================================
'use client';

import React from 'react';
import { AgentResult, AgentName, AGENT_CONFIGS, PipelineAnalytics } from '@/lib/types';
import { computeAnalytics } from '@/lib/history';

interface AnalyticsPanelProps {
    agentResults: Record<string, AgentResult | null>;
}

function FmtMs({ ms }: { ms: number }) {
    if (ms < 1000) return <>{ms}ms</>;
    return <>{(ms / 1000).toFixed(1)}s</>;
}

export default function AnalyticsPanel({ agentResults }: AnalyticsPanelProps) {
    const validResults = Object.fromEntries(
        Object.entries(agentResults).filter(([, v]) => v != null)
    ) as Record<string, AgentResult>;

    if (Object.keys(validResults).length === 0) return null;

    const analytics = computeAnalytics(validResults);
    const maxTokens = Math.max(...analytics.agentBreakdown.map(a => a.tokens), 1);
    const maxLatency = Math.max(...analytics.agentBreakdown.map(a => a.latencyMs), 1);

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            animation: 'fadeIn 0.4s ease',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-primary)',
                background: 'var(--bg-glass)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span>📊</span>
                    Pipeline Analytics
                </div>

                {/* Summary pills */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {[
                        { label: 'Total Tokens', value: analytics.totalTokens.toLocaleString(), color: '#6366f1' },
                        { label: 'Total Time', value: <FmtMs ms={analytics.totalLatencyMs} />, color: '#06b6d4' },
                        { label: 'Est. Cost', value: analytics.estimatedCostUsd < 0.0001 ? '~$0.00' : `~$${analytics.estimatedCostUsd.toFixed(4)}`, color: '#10b981' },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            background: `${color}18`,
                            border: `1px solid ${color}30`,
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>{label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Per-agent breakdown */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.agentBreakdown.map(({ agentName, tokens, latencyMs }) => {
                    const config = AGENT_CONFIGS[agentName as AgentName];
                    if (!config) return null;
                    const tokenPct = (tokens / maxTokens) * 100;
                    const latencyPct = (latencyMs / maxLatency) * 100;
                    return (
                        <div key={agentName}>
                            {/* Agent label row */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '6px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px' }}>{config.icon}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {config.displayName}
                                    </span>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-glass)',
                                        color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-mono)',
                                    }}>
                                        {config.model.split('/').pop()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                                    <span style={{ color: config.color }}>{tokens.toLocaleString()} tok</span>
                                    <span style={{ color: 'var(--text-muted)' }}><FmtMs ms={latencyMs} /></span>
                                </div>
                            </div>

                            {/* Token bar */}
                            <div style={{
                                position: 'relative',
                                height: '4px',
                                background: 'var(--bg-glass)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                                marginBottom: '4px',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${tokenPct}%`,
                                    background: config.color,
                                    borderRadius: '2px',
                                    transition: 'width 0.6s ease',
                                }} />
                            </div>

                            {/* Latency bar */}
                            <div style={{
                                position: 'relative',
                                height: '2px',
                                background: 'var(--bg-glass)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${latencyPct}%`,
                                    background: `${config.color}60`,
                                    borderRadius: '2px',
                                    transition: 'width 0.6s ease',
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{
                padding: '8px 20px 12px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-primary)',
            }}>
                🟣 Tokens used (thick bar) &nbsp;·&nbsp; 🔵 Latency (thin bar) &nbsp;·&nbsp; Cost is reference-only — Groq free tier has no charge
            </div>
        </div>
    );
}
