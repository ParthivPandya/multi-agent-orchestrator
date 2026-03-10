// ============================================================
// Multi-Agent Orchestration System — Shared Type Definitions
// ============================================================

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export type AgentName =
  | 'requirements-analyst'
  | 'task-planner'
  | 'developer'
  | 'code-reviewer'
  | 'testing-agent'
  | 'deployment-agent';

export interface AgentResult {
  agentName: AgentName;
  status: AgentStatus;
  output: string;
  timestamp: string;
  model: string;
  tokensUsed?: number;
  iterationNumber?: number;
  latencyMs?: number;
  error?: string;
}

export interface PipelineState {
  requirement: string;
  requirements: AgentResult | null;
  tasks: AgentResult | null;
  code: AgentResult | null;
  review: AgentResult | null;
  tests: AgentResult | null;
  deployment: AgentResult | null;
  currentAgent: AgentName | null;
  isComplete: boolean;
  hasError: boolean;
  iterationCount: number;
  maxIterations: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  size: 'S' | 'M' | 'L' | 'XL';
  dependencies: string[];
}

export interface RequirementsOutput {
  title: string;
  description: string;
  acceptance_criteria: string[];
  tech_stack: string[];
  constraints: string[];
  assumptions: string[];
}

export interface TaskPlannerOutput {
  tasks: Task[];
  total_complexity: string;
  estimated_effort: string;
  parallel_groups: string[][];
}

export interface ReviewOutput {
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  summary: string;
  issues: {
    severity: 'critical' | 'major' | 'minor' | 'suggestion';
    description: string;
    location?: string;
    suggestion?: string;
  }[];
  score: number;
}

// Pipeline event for streaming updates to the frontend
export interface PipelineEvent {
  type:
  | 'stage_start'
  | 'stage_complete'
  | 'stage_error'
  | 'pipeline_complete'
  | 'iteration_info'
  | 'final_result'
  | 'retry_attempt'
  | 'pipeline_paused';
  stage?: string;
  agentName?: AgentName;
  status?: AgentStatus;
  output?: string;
  model?: string;
  iteration?: number;
  maxIterations?: number;
  timestamp: string;
  error?: string;
  success?: boolean;
  results?: Record<string, AgentResult>;
  retryAttempt?: number;
  maxRetries?: number;
  latencyMs?: number;
}

// API Request/Response types
export interface OrchestrateRequest {
  requirement: string;
}

export interface AgentTestRequest {
  agentName: AgentName;
  input: string;
  context?: string;
}

// Agent configuration
export interface AgentConfig {
  name: AgentName;
  displayName: string;
  description: string;
  model: string;
  icon: string;
  color: string;
  maxTokens: number;
}

// Pipeline history — persisted runs
export interface PipelineHistoryEntry {
  id: string;
  requirement: string;
  timestamp: string;
  success: boolean;
  totalTokens: number;
  totalLatencyMs: number;
  agentResults: Record<string, AgentResult>;
  projectName: string;
}

// Analytics per pipeline run
export interface PipelineAnalytics {
  totalTokens: number;
  totalLatencyMs: number;
  agentBreakdown: {
    agentName: AgentName;
    tokens: number;
    latencyMs: number;
    cost: number; // estimated USD
  }[];
  estimatedCostUsd: number;
}

export const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  'requirements-analyst': {
    name: 'requirements-analyst',
    displayName: 'Requirements Analyst',
    description: 'Parses raw user input into structured specifications',
    model: 'llama-3.1-8b-instant',
    icon: '🔍',
    color: '#6366f1',
    maxTokens: 2048,
  },
  'task-planner': {
    name: 'task-planner',
    displayName: 'Task Planner',
    description: 'Breaks requirements into granular development tasks',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    icon: '📋',
    color: '#8b5cf6',
    maxTokens: 2048,
  },
  'developer': {
    name: 'developer',
    displayName: 'Developer Agent',
    description: 'Writes production-ready code for all tasks',
    model: 'qwen/qwen3-32b',
    icon: '💻',
    color: '#06b6d4',
    maxTokens: 4096,
  },
  'code-reviewer': {
    name: 'code-reviewer',
    displayName: 'Code Reviewer',
    description: 'Reviews code for quality, security, and correctness',
    model: 'llama-3.3-70b-versatile',
    icon: '🔎',
    color: '#f59e0b',
    maxTokens: 2048,
  },
  'testing-agent': {
    name: 'testing-agent',
    displayName: 'Testing Agent',
    description: 'Auto-generates unit & integration tests for the code',
    model: 'llama-3.3-70b-versatile',
    icon: '🧪',
    color: '#ec4899',
    maxTokens: 3072,
  },
  'deployment-agent': {
    name: 'deployment-agent',
    displayName: 'Deployment Agent',
    description: 'Generates deployment configs and instructions',
    model: 'llama-3.1-8b-instant',
    icon: '🚀',
    color: '#10b981',
    maxTokens: 2048,
  },
};
