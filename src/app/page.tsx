'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  AgentName, AgentStatus, AgentResult, PipelineEvent,
  PipelineHistoryEntry, RouteDecision, HITLDecision
} from '@/lib/types';
import { parseGeneratedFiles, ParsedFile } from '@/lib/fileParser';
import { saveToHistory } from '@/lib/history';
import { loadMemory, updateMemory, extractPreferencesFromAnalystOutput } from '@/lib/memory';
import { Role, canManageSettings, canManageWorkflows, canRunPipeline } from '@/lib/rbac';
import RequirementInput from '@/components/RequirementInput';
import PipelineView from '@/components/PipelineView';
import OutputPanel from '@/components/OutputPanel';
import WorkspaceViewer from '@/components/WorkspaceViewer';
import AnalyticsPanel from '@/components/AnalyticsPanel';
import HistoryPanel from '@/components/HistoryPanel';
import HITLModal from '@/components/HITLModal';
import VisualEditor from '@/components/VisualEditor';
import { ObservabilityDashboard } from '@/components/ObservabilityDashboard';
import SettingsPanel from '@/components/SettingsPanel';
import EnterpriseTeamPanel from '@/components/EnterpriseTeamPanel';

const INITIAL_STATUSES: Record<AgentName, AgentStatus> = {
  'router-agent': 'idle',
  'requirements-analyst': 'idle',
  'task-planner': 'idle',
  'developer': 'idle',
  'code-reviewer': 'idle',
  'security-reviewer': 'idle',
  'testing-agent': 'idle',
  'deployment-agent': 'idle',
  'product-manager': 'idle',
  'ux-designer': 'idle',
};

// Map stage names to agent names
const STAGE_TO_AGENT: Record<string, AgentName> = {
  routing: 'router-agent',
  requirements: 'requirements-analyst',
  tasks: 'task-planner',
  development: 'developer',
  code: 'developer',
  review: 'code-reviewer',
  security: 'security-reviewer',
  testing: 'testing-agent',
  tests: 'testing-agent',
  deployment: 'deployment-agent',
};

const PIPELINE_MODE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  FULL_PIPELINE:    { label: 'Full Pipeline',     color: '#6366f1', icon: '⚡' },
  QUICK_FIX:        { label: 'Quick Fix',          color: '#10b981', icon: '🔧' },
  PLAN_ONLY:        { label: 'Plan Only',           color: '#f59e0b', icon: '📋' },
  CODE_REVIEW_ONLY: { label: 'Code Review Only',   color: '#ec4899', icon: '🔎' },
};

// HITL state stored in component
interface HITLState {
  requestId: string;
  stage: string;
  agentOutput: string;
  reviewScore?: number;
}

export default function Home() {
  const [isRunning, setIsRunning] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentName, AgentStatus>>({ ...INITIAL_STATUSES });
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult | null>>({});
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [maxIterations] = useState(3);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [savedWorkspacePath, setSavedWorkspacePath] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [currentRequirement, setCurrentRequirement] = useState('');
  const [routeDecision, setRouteDecision] = useState<RouteDecision | null>(null);
  const [activityFeed, setActivityFeed] = useState<string[]>([]);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  // Gap #1 — HITL state
  const [hitlEnabled, setHitlEnabled] = useState(false);
  const [showHITLModal, setShowHITLModal] = useState(false);
  const [hitlRequest, setHitlRequest] = useState<HITLState | null>(null);

  // Gap #7 — Audit log
  const [auditLogJson, setAuditLogJson] = useState<string | null>(null);

  // Gap #9 — Streaming token buffer for developer
  const [streamingTokens, setStreamingTokens] = useState('');

  // Gap #4 — Security state
  const [securityBlocked, setSecurityBlocked] = useState(false);
  const [securitySeverity, setSecuritySeverity] = useState<string | null>(null);

  // Gap #6 — Parallel group indicator
  const [parallelGroup, setParallelGroup] = useState<string[] | null>(null);

  // Gap #8 — Memory badge
  const [memoryRunCount, setMemoryRunCount] = useState(0);

  // Gap #2 — Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>('admin');

  // New features
  const [showVisualEditor, setShowVisualEditor] = useState(false);

  // GitHub push state (Gap #5)
  const [isPushingToGitHub, setIsPushingToGitHub] = useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMemoryRunCount(loadMemory().runCount);
    const storedRole = localStorage.getItem('mao_user_role') as Role | null;
    if (storedRole === 'admin' || storedRole === 'member' || storedRole === 'viewer') {
      setCurrentRole(storedRole);
    }
  }, []);

  // Clear retry info after a delay
  useEffect(() => {
    if (retryInfo) {
      const t = setTimeout(() => setRetryInfo(null), 6000);
      return () => clearTimeout(t);
    }
  }, [retryInfo]);

  const resetPipeline = useCallback(() => {
    setAgentStatuses({ ...INITIAL_STATUSES });
    setAgentResults({});
    setSelectedAgent(null);
    setCurrentIteration(0);
    setPipelineComplete(false);
    setTotalTokens(0);
    setSavedWorkspacePath(null);
    setShowAnalytics(false);
    setRetryInfo(null);
    setRouteDecision(null);
    setActivityFeed([]);
    setStreamingTokens('');
    setSecurityBlocked(false);
    setSecuritySeverity(null);
    setParallelGroup(null);
    setAuditLogJson(null);
    setGithubRepoUrl(null);
    setShowHITLModal(false);
    setHitlRequest(null);
    setShowVisualEditor(false);
  }, []);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  // Restore a past pipeline run from history
  const handleRestoreHistory = useCallback((entry: PipelineHistoryEntry) => {
    resetPipeline();
    setCurrentRequirement(entry.requirement);

    const statusUpdates: Record<AgentName, AgentStatus> = { ...INITIAL_STATUSES };
    const resultUpdates: Record<string, AgentResult | null> = {};

    Object.entries(entry.agentResults).forEach(([, result]) => {
      if (result) {
        statusUpdates[result.agentName] = result.status;
        resultUpdates[result.agentName] = result;
      }
    });

    setAgentStatuses(statusUpdates);
    setAgentResults(resultUpdates);
    setTotalTokens(entry.totalTokens);
    setPipelineComplete(entry.success);
    if (entry.success) setShowAnalytics(true);
  }, [resetPipeline]);

  // Gap #1: HITL decision handler
  const handleHITLDecision = useCallback((requestId: string, decision: HITLDecision, feedback: string) => {
    console.log('[HITL] Decision submitted:', { requestId, decision, feedback });
    setShowHITLModal(false);
    setHitlRequest(null);
    // The API call itself is done inside HITLModal — the orchestrator will receive the resolution
    if (decision === 'rejected') {
      setIsRunning(false);
    }
  }, []);

  // Gap #5: Push to GitHub
  const handlePushToGitHub = useCallback(async () => {
    const githubToken = localStorage.getItem('mao_github_token');
    const githubOwner = localStorage.getItem('mao_github_owner');

    if (!githubToken || !githubOwner) {
      alert('Please configure GitHub token and owner in Settings first.');
      setShowSettings(true);
      return;
    }

    if (allGeneratedFiles.length === 0) {
      alert('No generated files to push.');
      return;
    }

    setIsPushingToGitHub(true);
    try {
      const repoName = `${projectName}-${Date.now()}`.slice(0, 60);
      const res = await fetch('/api/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'github',
          config: { token: githubToken, owner: githubOwner, repoName },
          files: allGeneratedFiles.map(f => ({ path: f.path, content: f.content })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGithubRepoUrl(data.repoUrl);
      } else {
        alert(`GitHub push failed: ${data.error}`);
      }
    } catch (err) {
      alert(`GitHub push error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPushingToGitHub(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gap #7: Download audit log
  const handleDownloadAuditLog = useCallback(() => {
    if (!auditLogJson) return;
    const blob = new Blob([auditLogJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditLogJson]);

  const handleSubmit = useCallback(async (requirement: string, resumeFromCheckpointId?: string, workflowId?: string) => {
    if (!canRunPipeline(currentRole)) {
      alert('Your role does not allow running pipelines. Please ask an admin for elevated access.');
      return;
    }
    if (!resumeFromCheckpointId) resetPipeline();
    setIsRunning(true);
    setCurrentRequirement(requirement);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const runResults: Record<string, AgentResult> = {};
    let requirementsOutputForMemory = '';

    try {
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          resumeCheckpointId: resumeFromCheckpointId,
          hitlEnabled,
          workflowId,
          customModels: (() => {
            try {
              const raw = localStorage.getItem('mao_agent_models');
              return raw ? JSON.parse(raw) : undefined;
            } catch {
              return undefined;
            }
          })(),
          apiKeys: (() => {
            try {
              const raw = localStorage.getItem('mao_api_keys');
              return raw ? JSON.parse(raw) : undefined;
            } catch {
              return undefined;
            }
          })(),
          ollamaUrl: localStorage.getItem('mao_ollama_url') || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Pipeline request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, '').trim();
          if (!dataLine) continue;

          try {
            const event: PipelineEvent = JSON.parse(dataLine);

            switch (event.type) {
              case 'stage_start': {
                const agentName = event.agentName || (event.stage ? STAGE_TO_AGENT[event.stage] : null);
                if (agentName) {
                  setAgentStatuses(prev => ({ ...prev, [agentName]: 'running' }));
                  setSelectedAgent(agentName);
                }
                // Reset streaming buffer when developer starts
                if (agentName === 'developer') setStreamingTokens('');
                break;
              }

              case 'stage_token': {
                // Gap #9: accumulate streaming tokens
                if (event.stage === 'code' && event.token) {
                  setStreamingTokens(prev => prev + event.token);
                }
                break;
              }

              case 'stage_complete': {
                const agentName = event.agentName || (event.stage ? STAGE_TO_AGENT[event.stage] : null);
                if (agentName && event.output) {
                  setAgentStatuses(prev => ({ ...prev, [agentName]: 'complete' }));
                  const result: AgentResult = {
                    agentName,
                    status: 'complete',
                    output: event.output!,
                    timestamp: event.timestamp,
                    model: event.model || '',
                    iterationNumber: event.iteration,
                    latencyMs: event.latencyMs,
                  };
                  setAgentResults(prev => ({ ...prev, [agentName]: result }));
                  runResults[agentName] = result;
                  if (result.tokensUsed) {
                    setTotalTokens(prev => prev + (result.tokensUsed || 0));
                  }
                  // Capture requirements output for memory update
                  if (agentName === 'requirements-analyst') {
                    requirementsOutputForMemory = event.output!;
                  }
                  // Clear streaming buffer when developer finishes
                  if (agentName === 'developer') setStreamingTokens('');
                }
                break;
              }

              case 'stage_error': {
                const agentName = event.agentName || (event.stage ? STAGE_TO_AGENT[event.stage] : null);
                if (agentName) {
                  setAgentStatuses(prev => ({ ...prev, [agentName]: 'error' }));
                  setAgentResults(prev => ({
                    ...prev,
                    [agentName]: {
                      agentName,
                      status: 'error',
                      output: '',
                      timestamp: event.timestamp,
                      model: '',
                      error: event.error,
                    },
                  }));
                }
                break;
              }

              case 'retry_attempt': {
                setRetryInfo(event.output || null);
                break;
              }

              case 'iteration_info': {
                if (event.iteration) setCurrentIteration(event.iteration);
                if (event.output) setActivityFeed(prev => [event.output!, ...prev].slice(0, 20));
                break;
              }

              case 'route_decision': {
                if (event.routeDecision) {
                  setRouteDecision(event.routeDecision);
                  setAgentStatuses(prev => ({ ...prev, 'router-agent': 'complete' }));
                  const skipped = event.routeDecision.skippedAgents;
                  if (skipped.length > 0) {
                    setAgentStatuses(prev => {
                      const next = { ...prev };
                      skipped.forEach(a => { next[a] = 'skipped'; });
                      return next;
                    });
                  }
                }
                break;
              }

              case 'tool_call':
              case 'tool_result':
              case 'rag_retrieval':
              case 'validation_error': {
                if (event.output) setActivityFeed(prev => [event.output!, ...prev].slice(0, 20));
                break;
              }

              case 'checkpoint_saved': {
                if (event.checkpointId) setCheckpointId(event.checkpointId);
                break;
              }

              // Gap #1: HITL events
              case 'hitl_requested': {
                setHitlRequest({
                  requestId: event.requestId!,
                  stage: event.stage || 'post_review',
                  agentOutput: event.output || '',
                  reviewScore: event.reviewScore,
                });
                setShowHITLModal(true);
                setAgentStatuses(prev => ({ ...prev, 'developer': 'waiting_hitl' }));
                break;
              }

              case 'hitl_resolved': {
                setShowHITLModal(false);
                setHitlRequest(null);
                break;
              }

              // Gap #4: Security blocked
              case 'pipeline_blocked': {
                setSecurityBlocked(true);
                setSecuritySeverity(event.severity || null);
                if (event.error) setActivityFeed(prev => [`🔴 ${event.error}`, ...prev].slice(0, 20));
                break;
              }

              // Gap #6: Parallel group events
              case 'parallel_group_start': {
                setParallelGroup(event.agents || null);
                if (event.output) setActivityFeed(prev => [event.output!, ...prev].slice(0, 20));
                break;
              }

              case 'parallel_group_complete': {
                setParallelGroup(null);
                if (event.output) setActivityFeed(prev => [event.output!, ...prev].slice(0, 20));
                break;
              }

              case 'pipeline_complete': {
                setPipelineComplete(true);
                setShowAnalytics(true);
                break;
              }

              case 'final_result': {
                if (event.results) {
                  const agentNameMap: Record<string, AgentName> = {
                    requirements: 'requirements-analyst',
                    tasks: 'task-planner',
                    code: 'developer',
                    review: 'code-reviewer',
                    security: 'security-reviewer',
                    tests: 'testing-agent',
                    deployment: 'deployment-agent',
                  };
                  Object.entries(event.results).forEach(([key, result]) => {
                    if (result) {
                      const agentName = agentNameMap[key];
                      if (agentName) {
                        setAgentResults(prev => ({ ...prev, [agentName]: result }));
                        setAgentStatuses(prev => ({
                          ...prev,
                          [agentName]: result.status === 'error' ? 'error' : 'complete',
                        }));
                        runResults[agentName] = result;
                      }
                    }
                  });
                }
                if ((event as PipelineEvent & { checkpointId?: string }).checkpointId) {
                  setCheckpointId((event as PipelineEvent & { checkpointId?: string }).checkpointId!);
                }
                if ((event as PipelineEvent & { routeDecision?: RouteDecision }).routeDecision) {
                  setRouteDecision((event as PipelineEvent & { routeDecision?: RouteDecision }).routeDecision!);
                }
                // Gap #7: Store audit log
                if ((event as PipelineEvent & { auditLog?: string }).auditLog) {
                  setAuditLogJson((event as PipelineEvent & { auditLog?: string }).auditLog!);
                }
                setPipelineComplete(true);
                setShowAnalytics(true);
                break;
              }
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Pipeline aborted by user');
      } else {
        console.error('Pipeline error:', error);
      }
    } finally {
      setIsRunning(false);
      // Gap #8: Update memory after pipeline run
      if (requirementsOutputForMemory && Object.keys(runResults).length > 0) {
        const memoryUpdates = extractPreferencesFromAnalystOutput(
          requirementsOutputForMemory,
          currentRequirement || requirement
        );
        updateMemory(memoryUpdates);
        setMemoryRunCount(prev => prev + 1);
      }
      // Persist the run to history
      if (Object.keys(runResults).length > 0) {
        saveToHistory(requirement, currentRequirement || 'generated-project', runResults, pipelineComplete);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetPipeline, currentRequirement, pipelineComplete, hitlEnabled, currentRole]);

  // Parse generated files from developer output
  const parsedFiles: ParsedFile[] = useMemo(() => {
    const devResult = agentResults['developer'];
    if (!devResult?.output) return [];
    return parseGeneratedFiles(devResult.output);
  }, [agentResults]);

  const testFiles: ParsedFile[] = useMemo(() => {
    const testResult = agentResults['testing-agent'];
    if (!testResult?.output) return [];
    return parseGeneratedFiles(testResult.output);
  }, [agentResults]);

  const deploymentFiles: ParsedFile[] = useMemo(() => {
    const deployResult = agentResults['deployment-agent'];
    if (!deployResult?.output) return [];
    return parseGeneratedFiles(deployResult.output);
  }, [agentResults]);

  const allGeneratedFiles = useMemo(() => {
    return [...parsedFiles, ...testFiles, ...deploymentFiles];
  }, [parsedFiles, testFiles, deploymentFiles]);

  // Extract project name from requirements
  const projectName = useMemo(() => {
    const reqResult = agentResults['requirements-analyst'];
    if (!reqResult?.output) return 'generated-project';
    try {
      const jsonMatch = reqResult.output.match(/```(?:json)?\s*([\s\S]*?)```/);
      const json = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(reqResult.output);
      return (json.title || 'generated-project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
    } catch {
      return 'generated-project';
    }
  }, [agentResults]);

  // Save to workspace handler
  const handleSaveToWorkspace = useCallback(async () => {
    if (allGeneratedFiles.length === 0) return;
    setIsSavingWorkspace(true);
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          files: allGeneratedFiles.map(f => ({ path: f.path, content: f.content })),
        }),
      });
      const data = await response.json();
      if (data.success) setSavedWorkspacePath(data.projectPath);
    } catch (error) {
      console.error('Failed to save workspace:', error);
    } finally {
      setIsSavingWorkspace(false);
    }
  }, [allGeneratedFiles, projectName]);

  const completedCount = Object.values(agentStatuses).filter(s => s === 'complete').length;
  const totalAgents = 8; // Router + 7 pipeline agents (now includes security-reviewer)

  return (
    <div className="app-container">
      {/* Background decorative orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* Gap #1: HITL Modal */}
      {showHITLModal && hitlRequest && (
        <HITLModal
          requestId={hitlRequest.requestId}
          stage={hitlRequest.stage}
          agentOutput={hitlRequest.agentOutput}
          reviewScore={hitlRequest.reviewScore}
          onDecision={handleHITLDecision}
        />
      )}

      {/* Gap #2: Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        hitlEnabled={hitlEnabled}
        onHITLToggle={setHitlEnabled}
      />
      <EnterpriseTeamPanel
        isOpen={showTeamPanel}
        onClose={() => setShowTeamPanel(false)}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
      />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🤖</div>
            <span className="logo-text">Multi-Agent Orchestrator</span>
            <span className="logo-badge">v3 · 8 Agents · 9 Enhancements</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Gap #8: Memory badge */}
            {memoryRunCount > 0 && (
              <div style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(139,92,246,0.12)',
                color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                🧠 Session #{memoryRunCount} — Memory Active
              </div>
            )}

            {/* Gap #1: HITL badge */}
            {hitlEnabled && (
              <div style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(245,158,11,0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.2)',
              }}>
                ⏸️ HITL Active
              </div>
            )}

            {/* Visual Editor Toggle */}
            <button
              onClick={() => setShowVisualEditor(true)}
              disabled={!canManageWorkflows(currentRole)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 600,
                cursor: canManageWorkflows(currentRole) ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
                opacity: canManageWorkflows(currentRole) ? 1 : 0.55,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Visual Builder
            </button>

            {/* Gap #2: Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              disabled={!canManageSettings(currentRole)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: canManageSettings(currentRole) ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s',
                opacity: canManageSettings(currentRole) ? 1 : 0.55,
              }}
            >
              ⚙️ Settings
            </button>

            <button
              onClick={() => setShowTeamPanel(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(99,102,241,0.25)',
                background: 'rgba(99,102,241,0.1)',
                color: '#a5b4fc',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              👥 Team
            </button>

            <HistoryPanel onRestore={handleRestoreHistory} />

            <div className="header-status">
              <div className="status-dot" />
              <span>Groq API Connected</span>
            </div>
            <div style={{
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(147,197,253,0.35)',
              background: 'rgba(59,130,246,0.12)',
              color: '#93c5fd',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              {currentRole}
            </div>
          </div>
        </div>
      </header>

      {/* Retry notification banner */}
      {retryInfo && (
        <div style={{
          padding: '8px 32px',
          background: 'rgba(245,158,11,0.08)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          fontSize: '12px',
          color: 'var(--accent-amber)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          {retryInfo}
        </div>
      )}

      {/* Gap #4: Security Blocked Banner */}
      {securityBlocked && securitySeverity && (
        <div style={{
          padding: '10px 32px',
          background: 'rgba(239,68,68,0.08)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          fontSize: '13px',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
        }}>
          🔴 Pipeline blocked by Security Reviewer — <strong>{securitySeverity.toUpperCase()}</strong> severity vulnerabilities detected. Review the Security output for details.
        </div>
      )}

      {/* Route Decision Banner */}
      {routeDecision && (
        <div style={{
          padding: '8px 32px',
          background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>🧭 Router classified:</span>
          <span style={{
            padding: '2px 10px',
            borderRadius: '20px',
            fontWeight: 600,
            fontSize: '11px',
            background: `${PIPELINE_MODE_LABELS[routeDecision.mode]?.color}22`,
            color: PIPELINE_MODE_LABELS[routeDecision.mode]?.color ?? '#fff',
            border: `1px solid ${PIPELINE_MODE_LABELS[routeDecision.mode]?.color}44`,
          }}>
            {PIPELINE_MODE_LABELS[routeDecision.mode]?.icon} {PIPELINE_MODE_LABELS[routeDecision.mode]?.label ?? routeDecision.mode}
          </span>
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{routeDecision.reasoning}</span>
          {routeDecision.skippedAgents.length > 0 && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Skipping: {routeDecision.skippedAgents.join(', ')}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            {Math.round(routeDecision.confidence * 100)}% confidence
          </span>
        </div>
      )}

      {/* Full-Screen Visual Editor */}
      {showVisualEditor && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-main)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Visual Pipeline Builder</h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Drag and drop nodes to visually program DAG workflows.</div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowVisualEditor(false)}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))',
                borderRadius: '8px',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close Builder
            </button>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <VisualEditor onRunWorkflow={(workflowId) => {
              setShowVisualEditor(false);
              handleSubmit(currentRequirement || 'Run from Visual Editor', undefined, workflowId);
            }} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        <RequirementInput
          onSubmit={handleSubmit}
          isRunning={isRunning}
          onStop={handleStop}
          initialValue={currentRequirement}
        />

        {/* Stats Bar */}
        {(isRunning || pipelineComplete) && (
          <div className="stats-bar animate-fade-in">
            <div className="stat-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Progress: <span className="stat-value">{completedCount}/{totalAgents}</span>
            </div>
            <div className="stat-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Status: <span className="stat-value" style={{
                color: securityBlocked
                  ? '#f87171'
                  : pipelineComplete
                    ? 'var(--accent-emerald)'
                    : isRunning
                      ? 'var(--accent-indigo)'
                      : 'var(--text-primary)',
              }}>
                {securityBlocked ? '🔴 Blocked' : pipelineComplete ? '✅ Complete' : isRunning ? '⚡ Running' : 'Ready'}
              </span>
            </div>
            {currentIteration > 0 && (
              <div className="stat-item">
                Review Iteration: <span className="stat-value">{currentIteration}/{maxIterations}</span>
              </div>
            )}
            {totalTokens > 0 && (
              <div className="stat-item">
                Tokens Used: <span className="stat-value">{totalTokens.toLocaleString()}</span>
              </div>
            )}
            {/* Gap #6: Parallel indicator */}
            {parallelGroup && parallelGroup.length > 0 && (
              <div className="stat-item" style={{ color: 'var(--accent-indigo)' }}>
                ⚡ Parallel: {parallelGroup.join(' + ')}
              </div>
            )}
            {pipelineComplete && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {/* Gap #7: Audit log export */}
                {auditLogJson && (
                  <button
                    onClick={handleDownloadAuditLog}
                    style={{
                      padding: '3px 10px',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#818cf8',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    📋 Export Audit Log
                  </button>
                )}
                <button
                  onClick={() => setShowAnalytics(prev => !prev)}
                  style={{
                    padding: '3px 10px',
                    background: showAnalytics ? 'rgba(99,102,241,0.15)' : 'var(--bg-glass)',
                    border: `1px solid ${showAnalytics ? 'rgba(99,102,241,0.3)' : 'var(--border-primary)'}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: showAnalytics ? 'var(--accent-indigo)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  📊 {showAnalytics ? 'Hide' : 'Show'} Analytics
                </button>
              </div>
            )}
          </div>
        )}

        {/* Analytics Panel */}
        {showAnalytics && pipelineComplete && (
          <div className="flex flex-col gap-6">
            <AnalyticsPanel agentResults={agentResults} />
            <ObservabilityDashboard auditLogJson={auditLogJson || undefined} runId={checkpointId || 'unknown'} />
          </div>
        )}

        {/* Activity Feed */}
        {activityFeed.length > 0 && (
          <div style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ⚡ Agent Activity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activityFeed.map((item, i) => (
                <div key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', opacity: 1 - i * 0.04 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gap #9: Token streaming preview */}
        {isRunning && streamingTokens && agentStatuses['developer'] === 'running' && (
          <div style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.15)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#22d3ee', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              💻 Developer — Live Code Stream
            </div>
            <pre style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {streamingTokens.slice(-1200)}
              <span style={{ display: 'inline-block', animation: 'blink 1s step-start infinite', color: '#22d3ee' }}>▋</span>
            </pre>
          </div>
        )}

        {/* Two-column layout for pipeline + output */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isRunning || pipelineComplete ? '1fr 1.5fr' : '1fr',
          gap: '24px',
          alignItems: 'start',
        }}>
          {(isRunning || pipelineComplete) && (
            <PipelineView
              agentStatuses={agentStatuses}
              agentResults={agentResults}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              currentIteration={currentIteration}
              maxIterations={maxIterations}
              isRunning={isRunning}
              parallelGroup={parallelGroup}
            />
          )}

          {(isRunning || pipelineComplete) && (
            <OutputPanel
              selectedAgent={selectedAgent}
              agentResults={agentResults}
            />
          )}
        </div>

        {/* Generated Project Files */}
        {pipelineComplete && allGeneratedFiles.length > 0 && (
          <>
            <div className="section-divider">
              Generated Project Files
              {testFiles.length > 0 && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '12px',
                  padding: '2px 8px',
                  background: 'rgba(236,72,153,0.12)',
                  color: '#ec4899',
                  borderRadius: '20px',
                  border: '1px solid rgba(236,72,153,0.2)',
                }}>
                  🧪 {testFiles.length} test file{testFiles.length !== 1 ? 's' : ''} included
                </span>
              )}
            </div>

            {/* Gap #5: GitHub push button */}
            {githubRepoUrl ? (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>🐙</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>Pushed to GitHub!</div>
                  <a
                    href={githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#6ee7b7', textDecoration: 'underline' }}
                  >
                    {githubRepoUrl}
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={handlePushToGitHub}
                  disabled={isPushingToGitHub}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '9px',
                    border: '1px solid rgba(139,92,246,0.3)',
                    background: 'rgba(139,92,246,0.1)',
                    color: '#a78bfa',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isPushingToGitHub ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isPushingToGitHub ? '⏳ Pushing...' : '🐙 Push to GitHub'}
                </button>
              </div>
            )}

            <WorkspaceViewer
              files={allGeneratedFiles}
              projectName={projectName}
              onSaveToWorkspace={handleSaveToWorkspace}
              isSaving={isSavingWorkspace}
              savedPath={savedWorkspacePath}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 32px',
        borderTop: '1px solid var(--border-primary)',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)',
        background: 'rgba(10, 10, 15, 0.5)',
      }}>
        Multi-Agent Orchestrator v3 · 9 Enterprise Enhancements · Next.js · Vercel AI SDK · Groq
        · HITL · Multi-Provider · Schema Validation · Security Review · MCP GitHub · Parallel Exec
        · Audit Log · Agent Memory · Token Streaming
      </footer>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
