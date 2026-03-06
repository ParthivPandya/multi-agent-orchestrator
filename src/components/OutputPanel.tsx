'use client';

import React, { useState, useCallback } from 'react';
import { AgentName, AgentResult, AGENT_CONFIGS } from '@/lib/types';

interface OutputPanelProps {
    selectedAgent: AgentName | null;
    agentResults: Record<string, AgentResult | null>;
}

type OutputTab = 'formatted' | 'raw' | 'json';

export default function OutputPanel({ selectedAgent, agentResults }: OutputPanelProps) {
    const [activeTab, setActiveTab] = useState<OutputTab>('formatted');

    const result = selectedAgent
        ? agentResults[selectedAgent] || null
        : null;

    const handleCopy = useCallback(() => {
        if (result?.output) {
            navigator.clipboard.writeText(result.output);
        }
    }, [result]);

    if (!selectedAgent) {
        return (
            <div className="output-section animate-fade-in">
                <div className="output-header">
                    <div className="output-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        Output
                    </div>
                </div>
                <div className="output-body">
                    <div className="output-empty">
                        <div className="output-empty-icon">📄</div>
                        <div className="output-empty-text">Select an agent to view its output</div>
                    </div>
                </div>
            </div>
        );
    }

    const config = AGENT_CONFIGS[selectedAgent];

    if (!result || result.status === 'idle') {
        return (
            <div className="output-section animate-fade-in">
                <div className="output-header">
                    <div className="output-title">
                        <span>{config.icon}</span>
                        {config.displayName}
                    </div>
                </div>
                <div className="output-body">
                    <div className="output-empty">
                        <div className="output-empty-icon">⏳</div>
                        <div className="output-empty-text">Waiting for {config.displayName} to run...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (result.status === 'error') {
        return (
            <div className="output-section animate-fade-in">
                <div className="output-header">
                    <div className="output-title" style={{ color: 'var(--accent-rose)' }}>
                        <span>❌</span>
                        {config.displayName} — Error
                    </div>
                </div>
                <div className="output-body">
                    <div style={{
                        padding: '16px',
                        background: 'rgba(244, 63, 94, 0.08)',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-rose)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        lineHeight: '1.6',
                    }}>
                        {result.error || 'An unknown error occurred'}
                    </div>
                </div>
            </div>
        );
    }

    // Try parsing JSON for pretty display
    let parsedJson: object | null = null;
    try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = result.output.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[1].trim());
        } else {
            parsedJson = JSON.parse(result.output);
        }
    } catch {
        parsedJson = null;
    }

    const renderFormatted = () => {
        const output = result.output;

        // Split content into sections based on markdown headers and code blocks
        const lines = output.split('\n');
        const elements: React.ReactNode[] = [];
        let codeBlock: string[] = [];
        let inCodeBlock = false;
        let codeLang = '';

        lines.forEach((line, i) => {
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    // End code block
                    elements.push(
                        <div key={`code-${i}`} className="code-block">
                            <div className="code-block-header">
                                <span className="code-block-lang">{codeLang || 'code'}</span>
                                <button
                                    className="code-block-copy"
                                    onClick={() => navigator.clipboard.writeText(codeBlock.join('\n'))}
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="code-block-body">
                                <pre>{codeBlock.join('\n')}</pre>
                            </div>
                        </div>
                    );
                    codeBlock = [];
                    inCodeBlock = false;
                    codeLang = '';
                } else {
                    // Start code block
                    inCodeBlock = true;
                    codeLang = line.replace('```', '').trim();
                }
                return;
            }

            if (inCodeBlock) {
                codeBlock.push(line);
                return;
            }

            if (line.startsWith('### ')) {
                elements.push(<h3 key={i} style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px', margin: '20px 0 8px' }}>{line.replace('### ', '')}</h3>);
            } else if (line.startsWith('## ')) {
                elements.push(<h2 key={i} style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '17px', margin: '24px 0 10px' }}>{line.replace('## ', '')}</h2>);
            } else if (line.startsWith('# ')) {
                elements.push(<h1 key={i} style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '20px', margin: '28px 0 12px' }}>{line.replace('# ', '')}</h1>);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                elements.push(
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent-indigo)' }}>•</span>
                        <span>{line.replace(/^[-*]\s/, '')}</span>
                    </div>
                );
            } else if (line.match(/^\d+\.\s/)) {
                const num = line.match(/^(\d+)\./)?.[1];
                elements.push(
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px', minWidth: '20px' }}>{num}.</span>
                        <span>{line.replace(/^\d+\.\s/, '')}</span>
                    </div>
                );
            } else if (line.startsWith('🔴') || line.startsWith('🟡') || line.startsWith('🟢')) {
                elements.push(
                    <div key={i} style={{ padding: '8px 12px', margin: '4px 0', borderRadius: '8px', background: 'var(--bg-glass)', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        {line}
                    </div>
                );
            } else if (line.trim() === '') {
                elements.push(<div key={i} style={{ height: '8px' }} />);
            } else {
                elements.push(
                    <p key={i} style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        {line}
                    </p>
                );
            }
        });

        return <div className="markdown-content">{elements}</div>;
    };

    return (
        <div className="output-section animate-fade-in">
            <div className="output-header">
                <div className="output-title">
                    <span>{config.icon}</span>
                    {config.displayName}
                    {result.iterationNumber && (
                        <span className="pipeline-iteration-badge" style={{ marginLeft: '8px' }}>
                            v{result.iterationNumber}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="output-tabs">
                        <button
                            className={`output-tab ${activeTab === 'formatted' ? 'active' : ''}`}
                            onClick={() => setActiveTab('formatted')}
                        >
                            Formatted
                        </button>
                        <button
                            className={`output-tab ${activeTab === 'raw' ? 'active' : ''}`}
                            onClick={() => setActiveTab('raw')}
                        >
                            Raw
                        </button>
                        {parsedJson && (
                            <button
                                className={`output-tab ${activeTab === 'json' ? 'active' : ''}`}
                                onClick={() => setActiveTab('json')}
                            >
                                JSON
                            </button>
                        )}
                    </div>

                    <button className="btn-secondary" onClick={handleCopy} style={{ padding: '5px 10px', fontSize: '11px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                    </button>
                </div>
            </div>

            <div className="output-body">
                {activeTab === 'formatted' && renderFormatted()}
                {activeTab === 'raw' && (
                    <div className="code-block">
                        <div className="code-block-body">
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {result.output}
                            </pre>
                        </div>
                    </div>
                )}
                {activeTab === 'json' && parsedJson && (
                    <div className="code-block">
                        <div className="code-block-header">
                            <span className="code-block-lang">JSON</span>
                        </div>
                        <div className="code-block-body">
                            <pre style={{ whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(parsedJson, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Metadata footer */}
                <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                }}>
                    <span>Model: <strong style={{ color: 'var(--text-secondary)' }}>{result.model}</strong></span>
                    {result.tokensUsed && (
                        <span>Tokens: <strong style={{ color: 'var(--text-secondary)' }}>{result.tokensUsed}</strong></span>
                    )}
                    <span>Time: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(result.timestamp).toLocaleTimeString()}</strong></span>
                </div>
            </div>
        </div>
    );
}
