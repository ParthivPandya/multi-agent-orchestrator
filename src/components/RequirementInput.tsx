'use client';

import { useState, useRef, useEffect } from 'react';

interface RequirementInputProps {
    onSubmit: (requirement: string) => void;
    isRunning: boolean;
    onStop?: () => void;
    initialValue?: string;
}

const EXAMPLE_PROMPTS = [
    'Build a REST API for a todo app with authentication',
    'Create a real-time chat application with WebSocket support',
    'Build an e-commerce product catalog with search and filtering',
    'Create a URL shortener service with analytics dashboard',
    'Build a markdown-based blog platform with SSR',
];

export default function RequirementInput({ onSubmit, isRunning, onStop, initialValue }: RequirementInputProps) {
    const [requirement, setRequirement] = useState(initialValue || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        if (requirement.trim() && !isRunning) {
            onSubmit(requirement.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleExampleClick = (example: string) => {
        setRequirement(example);
        textareaRef.current?.focus();
    };

    return (
        <div className="input-section animate-fade-in">
            <label className="input-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
                Describe your project requirement
            </label>

            <textarea
                ref={textareaRef}
                className="input-textarea"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build in plain English. Be as detailed as possible — include features, tech preferences, constraints, and any specific requirements..."
                disabled={isRunning}
            />

            {!isRunning && !requirement && (
                <div className="example-chips">
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Try:</span>
                    {EXAMPLE_PROMPTS.map((example, i) => (
                        <button
                            key={i}
                            className="example-chip"
                            onClick={() => handleExampleClick(example)}
                        >
                            {example}
                        </button>
                    ))}
                </div>
            )}

            <div className="input-actions">
                <span className="char-count">
                    {requirement.length} characters · Ctrl+Enter to submit
                </span>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {isRunning && onStop && (
                        <button className="btn-secondary" onClick={onStop}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="1" />
                            </svg>
                            Stop Pipeline
                        </button>
                    )}

                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={!requirement.trim() || isRunning}
                    >
                        {isRunning ? (
                            <>
                                <div className="spinner" />
                                Running Pipeline...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                Run Pipeline
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
