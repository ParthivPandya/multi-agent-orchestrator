// ============================================================
// Observability Dashboard (Competitor Feature: Composio/Flowise-style)
// Traces, metrics, logging, and token usage analytics view.
// ============================================================

import React, { useState, useEffect } from 'react';
import { AgentResult, PipelineEvent } from '@/lib/types';
import { Activity, Clock, Cpu, Database, Server, Zap, Search, Filter, ShieldAlert, Play } from 'lucide-react';

interface ObservabilityDashboardProps {
  auditLogJson?: string;
  runId: string;
}

export const ObservabilityDashboard: React.FC<ObservabilityDashboardProps> = ({ auditLogJson, runId }) => {
  const [logData, setLogData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'traces' | 'metrics' | 'errors'>('metrics');

  useEffect(() => {
    if (auditLogJson) {
      try {
        setLogData(JSON.parse(auditLogJson));
      } catch (e) {
        console.error("Failed to parse audit log", e);
      }
    }
  }, [auditLogJson]);

  if (!logData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] h-[400px]">
        <Activity size={48} className="text-[var(--text-muted)] mb-4 opacity-50" />
        <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Observability Dashboard</h3>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">
          No audit log data available for this run. The pipeline must complete or be aborted to generate an exportable trace.
        </p>
      </div>
    );
  }

  // Calculate metrics
  const totalEvents = logData.events.length;
  const errors = logData.events.filter((e: any) => e.eventType === 'stage_error' || e.eventType === 'pipeline_aborted');
  const durationMs = logData.durationMs;
  
  // Calculate tokens
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const agentMetrics: Record<string, { latency: number, tokens: number, calls: number }> = {};
  
  logData.events.forEach((e: any) => {
    if (e.tokenUsage) {
      totalInputTokens += e.tokenUsage.inputTokens || 0;
      totalOutputTokens += e.tokenUsage.outputTokens || 0;
    }
    
    if (e.agentName && e.eventType === 'stage_complete') {
      if (!agentMetrics[e.agentName]) {
        agentMetrics[e.agentName] = { latency: 0, tokens: 0, calls: 0 };
      }
      agentMetrics[e.agentName].latency += e.latencyMs || 0;
      agentMetrics[e.agentName].tokens += (e.tokenUsage?.outputTokens || 0);
      agentMetrics[e.agentName].calls += 1;
    }
  });

  return (
    <div className="flex flex-col h-[700px] bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] bg-[var(--bg-glass)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--accent-indigo)] bg-opacity-20 flex items-center justify-center border border-[var(--accent-indigo)] border-opacity-30">
            <Activity size={18} className="text-[var(--accent-indigo)]" />
          </div>
          <div>
            <h2 className="text-[var(--text-primary)] font-semibold text-sm">Telemetry & Traces</h2>
            <div className="text-[var(--text-muted)] text-[10px] font-mono mt-0.5">Run ID: {logData.pipelineRunId}</div>
          </div>
        </div>

        <div className="flex bg-[var(--bg-primary)] p-1 rounded-md border border-[var(--border-primary)]">
          {(['metrics', 'traces', 'errors'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === tab 
                  ? 'bg-[var(--bg-glass)] text-[var(--text-primary)] shadow-sm' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'errors' && errors.length > 0 && (
                <span className="ml-2 bg-[var(--accent-rose)] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {errors.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'metrics' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4 flex flex-col gap-2">
                <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} /> Total Duration
                </div>
                <div className="text-2xl font-mono text-[var(--accent-emerald)]">
                  {(durationMs / 1000).toFixed(2)}s
                </div>
              </div>
              
              <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4 flex flex-col gap-2">
                <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Cpu size={14} /> Output Tokens
                </div>
                <div className="text-2xl font-mono text-[var(--accent-indigo)]">
                  {totalOutputTokens.toLocaleString()}
                </div>
              </div>

              <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4 flex flex-col gap-2">
                <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Server size={14} /> Events Logged
                </div>
                <div className="text-2xl font-mono text-[var(--accent-cyan)]">
                  {totalEvents}
                </div>
              </div>

              <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4 flex flex-col gap-2">
                <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={14} /> Error Rate
                </div>
                <div className={`text-2xl font-mono ${errors.length > 0 ? 'text-[var(--accent-rose)]' : 'text-[var(--text-secondary)]'}`}>
                  {((errors.length / Math.max(1, totalEvents)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Agent Breakdown Table */}
            <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-primary)]">
              <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-glass)] flex items-center gap-2">
                <Database size={16} className="text-[var(--text-secondary)]" />
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">Agent Performance Details</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                    <th className="font-medium p-3">Agent</th>
                    <th className="font-medium p-3 text-right">Calls</th>
                    <th className="font-medium p-3 text-right">Total Latency</th>
                    <th className="font-medium p-3 text-right">Avg Latency</th>
                    <th className="font-medium p-3 text-right">Tokens Used</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-secondary)]">
                  {Object.entries(agentMetrics).sort((a,b) => b[1].latency - a[1].latency).map(([agent, stats], idx) => (
                    <tr key={agent} className={`border-b border-[var(--border-primary)] ${idx % 2 === 0 ? 'bg-[var(--bg-glass)]' : ''}`}>
                      <td className="p-3 font-mono text-xs text-[var(--text-primary)]">{agent}</td>
                      <td className="p-3 text-right">{stats.calls}</td>
                      <td className="p-3 text-right font-mono text-[var(--accent-emerald)]">{(stats.latency / 1000).toFixed(2)}s</td>
                      <td className="p-3 text-right font-mono text-[var(--text-muted)]">{((stats.latency / stats.calls) / 1000).toFixed(2)}s</td>
                      <td className="p-3 text-right font-mono text-[var(--accent-indigo)]">{stats.tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                  {Object.keys(agentMetrics).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[var(--text-muted)] italic">No agent execution data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Traces View (OpenTelemetry style waterfall) */}
        {activeTab === 'traces' && (
          <div className="space-y-3 animate-fade-in relative pl-4 border-l-2 border-[var(--border-primary)] ml-4">
            {logData.events.map((event: any, idx: number) => {
              // Calculate relative offset percentage for waterfall charting
              const relativeStartMs = event.timestamp - (logData.events[0]?.timestamp || 0);
              
              let Icon = Zap;
              let color = 'var(--text-muted)';
              let bg = 'var(--bg-primary)';
              
              if (event.eventType.includes('start')) {
                Icon = Play;
                color = 'var(--accent-indigo)';
                bg = 'rgba(99,102,241,0.1)';
              } else if (event.eventType.includes('complete')) {
                Icon = Clock;
                color = 'var(--accent-emerald)';
                bg = 'rgba(16,185,129,0.1)';
              } else if (event.eventType.includes('error') || event.eventType.includes('blocked')) {
                Icon = ShieldAlert;
                color = 'var(--accent-rose)';
                bg = 'rgba(244,63,94,0.1)';
              } else if (event.eventType.includes('hitl')) {
                Icon = Activity;
                color = 'var(--accent-amber)';
                bg = 'rgba(245,158,11,0.1)';
              }

              return (
                <div key={event.eventId} className="relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md p-3 hover:border-[var(--text-muted)] transition-colors group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[23px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[var(--bg-card)]" style={{ backgroundColor: color }} />
                  
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded" style={{ backgroundColor: bg, color }}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[var(--text-primary)] uppercase">{event.eventType}</span>
                          {event.agentName && <span className="text-[10px] bg-[var(--bg-glass)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] font-mono">{event.agentName}</span>}
                          {event.stage && <span className="text-[10px] text-[var(--text-muted)]">@{event.stage}</span>}
                        </div>
                        {event.output && (
                          <div className="mt-1 text-xs text-[var(--text-muted)] font-mono truncate max-w-2xl" title={event.output}>
                            {event.output.length > 100 ? event.output.substring(0, 100) + '...' : event.output}
                          </div>
                        )}
                        {event.error && (
                          <div className="mt-1 text-xs text-[var(--accent-rose)] font-mono">
                            {event.error}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        +{relativeStartMs}ms
                      </span>
                      {event.latencyMs && (
                        <span className="text-xs font-mono text-[var(--accent-emerald)] bg-[var(--bg-glass)] px-1.5 rounded">
                          {event.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Errors View */}
        {activeTab === 'errors' && (
          <div className="space-y-4 animate-fade-in">
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)] h-full">
                <div className="w-16 h-16 rounded-full bg-[rgba(16,185,129,0.1)] text-[var(--accent-emerald)] flex items-center justify-center mb-4">
                  <ShieldAlert size={32} />
                </div>
                <p>No errors recorded in this trace block.</p>
              </div>
            ) : (
              errors.map((error: any) => (
                <div key={error.eventId} className="bg-[rgba(244,63,94,0.05)] border border-[rgba(244,63,94,0.2)] rounded-lg p-5">
                  <div className="flex items-center gap-2 text-[var(--accent-rose)] font-semibold text-sm mb-3">
                    <ShieldAlert size={16} />
                    {error.eventType} / {error.agentName || 'System'}
                  </div>
                  <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words bg-[var(--bg-primary)] p-3 rounded border border-[var(--border-primary)]">
                    {error.error || error.output || JSON.stringify(error.metadata, null, 2)}
                  </pre>
                  <div className="mt-3 text-[10px] font-mono text-[var(--text-muted)] text-right">
                    Trace ID: {error.eventId} • Offset: +{error.timestamp - logData.events[0].timestamp}ms
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
