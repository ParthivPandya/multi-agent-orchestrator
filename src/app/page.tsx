'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { AgentName, AgentStatus, AgentResult, PipelineEvent } from '@/lib/types';
import { parseGeneratedFiles, ParsedFile } from '@/lib/fileParser';
import RequirementInput from '@/components/RequirementInput';
import PipelineView from '@/components/PipelineView';
import OutputPanel from '@/components/OutputPanel';
import WorkspaceViewer from '@/components/WorkspaceViewer';

const INITIAL_STATUSES: Record<AgentName, AgentStatus> = {
  'requirements-analyst': 'idle',
  'task-planner': 'idle',
  developer: 'idle',
  'code-reviewer': 'idle',
  'deployment-agent': 'idle',
};

// Map stage names to agent names
const STAGE_TO_AGENT: Record<string, AgentName> = {
  requirements: 'requirements-analyst',
  tasks: 'task-planner',
  development: 'developer',
  review: 'code-reviewer',
  deployment: 'deployment-agent',
};

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
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetPipeline = useCallback(() => {
    setAgentStatuses({ ...INITIAL_STATUSES });
    setAgentResults({});
    setSelectedAgent(null);
    setCurrentIteration(0);
    setPipelineComplete(false);
    setTotalTokens(0);
    setSavedWorkspacePath(null);
  }, []);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  const handleSubmit = useCallback(async (requirement: string) => {
    resetPipeline();
    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement }),
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
                break;
              }

              case 'stage_complete': {
                const agentName = event.agentName || (event.stage ? STAGE_TO_AGENT[event.stage] : null);
                if (agentName && event.output) {
                  setAgentStatuses(prev => ({ ...prev, [agentName]: 'complete' }));
                  const result: AgentResult = {
                    agentName,
                    status: 'complete',
                    output: event.output,
                    timestamp: event.timestamp,
                    model: event.model || '',
                    iterationNumber: event.iteration,
                  };
                  setAgentResults(prev => ({ ...prev, [agentName]: result }));
                  if (result.tokensUsed) {
                    setTotalTokens(prev => prev + (result.tokensUsed || 0));
                  }
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

              case 'iteration_info': {
                if (event.iteration) {
                  setCurrentIteration(event.iteration);
                }
                break;
              }

              case 'pipeline_complete': {
                setPipelineComplete(true);
                break;
              }

              case 'final_result': {
                if (event.results) {
                  // Update all results from final payload
                  Object.entries(event.results).forEach(([key, result]) => {
                    if (result) {
                      // Map result keys to agent names
                      const agentNameMap: Record<string, AgentName> = {
                        requirements: 'requirements-analyst',
                        tasks: 'task-planner',
                        code: 'developer',
                        review: 'code-reviewer',
                        deployment: 'deployment-agent',
                      };
                      const agentName = agentNameMap[key];
                      if (agentName) {
                        setAgentResults(prev => ({ ...prev, [agentName]: result }));
                        setAgentStatuses(prev => ({
                          ...prev,
                          [agentName]: result.status === 'error' ? 'error' : 'complete',
                        }));
                      }
                    }
                  });
                }
                setPipelineComplete(true);
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
    }
  }, [resetPipeline]);

  // Parse generated files from developer output
  const parsedFiles: ParsedFile[] = useMemo(() => {
    const devResult = agentResults['developer'];
    if (!devResult?.output) return [];
    return parseGeneratedFiles(devResult.output);
  }, [agentResults]);

  // Also parse deployment files
  const deploymentFiles: ParsedFile[] = useMemo(() => {
    const deployResult = agentResults['deployment-agent'];
    if (!deployResult?.output) return [];
    return parseGeneratedFiles(deployResult.output);
  }, [agentResults]);

  const allGeneratedFiles = useMemo(() => {
    return [...parsedFiles, ...deploymentFiles];
  }, [parsedFiles, deploymentFiles]);

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
      if (data.success) {
        setSavedWorkspacePath(data.projectPath);
      }
    } catch (error) {
      console.error('Failed to save workspace:', error);
    } finally {
      setIsSavingWorkspace(false);
    }
  }, [allGeneratedFiles, projectName]);

  const completedCount = Object.values(agentStatuses).filter(s => s === 'complete').length;

  return (
    <div className="app-container">
      {/* Background decorative orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🤖</div>
            <span className="logo-text">Multi-Agent Orchestrator</span>
            <span className="logo-badge">AI Pipeline</span>
          </div>

          <div className="header-status">
            <div className="status-dot" />
            <span>Groq API Connected</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Input Section */}
        <RequirementInput
          onSubmit={handleSubmit}
          isRunning={isRunning}
          onStop={handleStop}
        />

        {/* Stats Bar (shown when pipeline is running or complete) */}
        {(isRunning || pipelineComplete) && (
          <div className="stats-bar animate-fade-in">
            <div className="stat-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Progress: <span className="stat-value">{completedCount}/5</span>
            </div>
            <div className="stat-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Status: <span className="stat-value" style={{
                color: pipelineComplete ? 'var(--accent-emerald)' : isRunning ? 'var(--accent-indigo)' : 'var(--text-primary)',
              }}>
                {pipelineComplete ? '✅ Complete' : isRunning ? '⚡ Running' : 'Ready'}
              </span>
            </div>
            {currentIteration > 0 && (
              <div className="stat-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Review Iteration: <span className="stat-value">{currentIteration}/{maxIterations}</span>
              </div>
            )}
            {totalTokens > 0 && (
              <div className="stat-item">
                Tokens Used: <span className="stat-value">{totalTokens.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Two-column layout for pipeline + output */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isRunning || pipelineComplete ? '1fr 1.5fr' : '1fr',
          gap: '24px',
          alignItems: 'start',
        }}>
          {/* Pipeline View */}
          {(isRunning || pipelineComplete) && (
            <PipelineView
              agentStatuses={agentStatuses}
              agentResults={agentResults}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              currentIteration={currentIteration}
              maxIterations={maxIterations}
              isRunning={isRunning}
            />
          )}

          {/* Output Panel */}
          {(isRunning || pipelineComplete) && (
            <OutputPanel
              selectedAgent={selectedAgent}
              agentResults={agentResults}
            />
          )}
        </div>

        {/* Generated Project Files — File Tree + Code Viewer */}
        {pipelineComplete && allGeneratedFiles.length > 0 && (
          <>
            <div className="section-divider">
              Generated Project Files
            </div>
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
        Built with Next.js · Vercel AI SDK · Groq API — Zero Cost AI Pipeline
      </footer>
    </div>
  );
}
