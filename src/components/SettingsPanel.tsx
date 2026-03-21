'use client';

import { useState, useEffect } from 'react';
import {
  ProviderName,
  AgentModelConfig,
  AgentName,
} from '@/lib/types';
import {
  DEFAULT_AGENT_MODELS,
  PROVIDER_MODELS,
} from '@/lib/providers';
import { loadMemory, clearMemory } from '@/lib/memory';

const PROVIDERS: ProviderName[] = ['groq', 'openai', 'anthropic', 'ollama'];

const PROVIDER_DISPLAY: Record<ProviderName, { label: string; color: string; icon: string }> = {
  groq: { label: 'Groq', color: '#f97316', icon: '⚡' },
  openai: { label: 'OpenAI', color: '#10a37f', icon: '🤖' },
  anthropic: { label: 'Anthropic', color: '#c8a2e9', icon: '🔮' },
  ollama: { label: 'Ollama (Local)', color: '#6366f1', icon: '🦙' },
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'requirements-analyst': '🔍 Requirements Analyst',
  'task-planner': '📋 Task Planner',
  'developer': '💻 Developer',
  'code-reviewer': '🔎 Code Reviewer',
  'security-reviewer': '🛡️ Security Reviewer',
  'testing-agent': '🧪 Testing Agent',
  'deployment-agent': '🚀 Deployment Agent',
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  hitlEnabled: boolean;
  onHITLToggle: (enabled: boolean) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  hitlEnabled,
  onHITLToggle,
}: SettingsPanelProps) {
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderName, string>>>({});
  const [agentModels, setAgentModels] = useState<Record<string, AgentModelConfig>>({ ...DEFAULT_AGENT_MODELS });
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [saved, setSaved] = useState(false);
  const [memoryRunCount, setMemoryRunCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'providers' | 'agents' | 'delivery' | 'memory'>('providers');

  useEffect(() => {
    if (isOpen) {
      try {
        const savedKeys = localStorage.getItem('mao_api_keys');
        if (savedKeys) setApiKeys(JSON.parse(savedKeys));
        const savedModels = localStorage.getItem('mao_agent_models');
        if (savedModels) setAgentModels(JSON.parse(savedModels));
        const savedOllama = localStorage.getItem('mao_ollama_url');
        if (savedOllama) setOllamaUrl(savedOllama);
        const savedGHToken = localStorage.getItem('mao_github_token');
        if (savedGHToken) setGithubToken(savedGHToken);
        const savedGHOwner = localStorage.getItem('mao_github_owner');
        if (savedGHOwner) setGithubOwner(savedGHOwner);
      } catch { /* ignore */ }
      setMemoryRunCount(loadMemory().runCount);
    }
  }, [isOpen]);

  const save = () => {
    try {
      localStorage.setItem('mao_api_keys', JSON.stringify(apiKeys));
      localStorage.setItem('mao_agent_models', JSON.stringify(agentModels));
      localStorage.setItem('mao_ollama_url', ollamaUrl);
      localStorage.setItem('mao_github_token', githubToken);
      localStorage.setItem('mao_github_owner', githubOwner);
    } catch { /* quota exceeded */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearMemory = () => {
    clearMemory();
    setMemoryRunCount(0);
  };

  if (!isOpen) return null;

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px',
    borderRadius: '8px',
    border: 'none',
    background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
    color: active ? '#818cf8' : 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
    boxShadow: active ? 'inset 0 0 0 1px rgba(99,102,241,0.3)' : 'none',
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 900,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      padding: '24px',
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(12,12,22,0.99), rgba(18,18,32,0.99))',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '28px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>Settings</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Providers, Models, Delivery & Memory
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '20px',
            lineHeight: 1,
            padding: '4px',
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', padding: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px' }}>
          {(['providers', 'agents', 'delivery', 'memory'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
              {{ providers: '🔑 Providers', agents: '🤖 Agent Models', delivery: '📦 Delivery', memory: '🧠 Memory' }[tab]}
            </button>
          ))}
        </div>

        {/* Tab: Providers */}
        {activeTab === 'providers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* HITL Toggle */}
            <div style={{
              padding: '16px',
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>⏸️ Human-in-the-Loop (HITL)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Pause pipeline after code review for human approval
                  </div>
                </div>
                <div
                  onClick={() => onHITLToggle(!hitlEnabled)}
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    background: hitlEnabled ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '3px',
                    left: hitlEnabled ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
            </div>

            {/* API Keys */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                API Keys
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {PROVIDERS.filter(p => p !== 'ollama').map(provider => (
                  <div key={provider}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <span style={{ color: PROVIDER_DISPLAY[provider].color }}>
                        {PROVIDER_DISPLAY[provider].icon}
                      </span>{' '}
                      {PROVIDER_DISPLAY[provider].label} API Key
                    </label>
                    <input
                      type="password"
                      placeholder={`sk-... (leave empty to use server env)`}
                      value={apiKeys[provider] ?? ''}
                      onChange={e => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    🦙 Ollama Base URL (local)
                  </label>
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={e => setOllamaUrl(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Agent Models */}
        {activeTab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Each agent can use a different provider and model independently.
            </p>
            {Object.entries(agentModels).map(([agent, conf]) => (
              <div key={agent} style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '10px' }}>
                  {AGENT_DISPLAY_NAMES[agent] || agent}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={conf.provider}
                    onChange={e => setAgentModels(prev => ({
                      ...prev,
                      [agent]: { ...prev[agent], provider: e.target.value as ProviderName },
                    }))}
                    style={{ ...inputStyle, width: '140px', flexShrink: 0 }}
                  >
                    {PROVIDERS.map(p => (
                      <option key={p} value={p}>{PROVIDER_DISPLAY[p].label}</option>
                    ))}
                  </select>
                  <select
                    value={conf.model}
                    onChange={e => setAgentModels(prev => ({
                      ...prev,
                      [agent]: { ...prev[agent], model: e.target.value },
                    }))}
                    style={inputStyle}
                  >
                    {PROVIDER_MODELS[conf.provider]?.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Delivery (Gap #5 MCP) */}
        {activeTab === 'delivery' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              padding: '16px',
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '10px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                🐙 GitHub Push (MCP)
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Automatically push generated code to a new GitHub repository after pipeline completion.
                Token stored locally only.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    GitHub Personal Access Token (repo scope)
                  </label>
                  <input
                    type="password"
                    placeholder="ghp_..."
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    GitHub Username / Owner
                  </label>
                  <input
                    type="text"
                    placeholder="your-github-username"
                    value={githubOwner}
                    onChange={e => setGithubOwner(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              {githubToken && githubOwner && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#34d399',
                }}>
                  ✅ GitHub configured — &quot;Push to GitHub&quot; button will appear after pipeline completion.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Memory (Gap #8) */}
        {activeTab === 'memory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '16px',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '10px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                🧠 Agent Memory
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                The system learns your tech preferences (language, framework, DB) across sessions
                and injects them into agent prompts. All data stays in your browser localStorage.
              </p>

              {memoryRunCount > 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'rgba(139,92,246,0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>
                      Memory Active — {memoryRunCount} previous run{memoryRunCount !== 1 ? 's' : ''} tracked
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Preferences automatically injected into future pipelines
                    </div>
                  </div>
                  <button
                    onClick={handleClearMemory}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#f87171',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                    }}
                  >
                    🗑️ Clear Memory
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}>
                  No memory yet. Run a pipeline and your preferences will be learned automatically.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '28px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px',
            borderRadius: '9px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
            Cancel
          </button>
          <button
            onClick={save}
            style={{
              padding: '10px 24px',
              borderRadius: '9px',
              border: 'none',
              background: saved
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s',
            }}
          >
            {saved ? '✅ Saved!' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
