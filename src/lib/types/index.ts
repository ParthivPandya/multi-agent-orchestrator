// ============================================================
// Multi-Agent Orchestration System — Shared Type Definitions
// ============================================================

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error' | 'skipped';

export type AgentName =
  | 'requirements-analyst'
  | 'task-planner'
  | 'developer'
  | 'code-reviewer'
  | 'testing-agent'
  | 'deployment-agent'
  | 'router-agent';

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

// ─── Enhancement 1: Intelligent Routing ────────────────────────────────────────

export type PipelineMode =
  | 'FULL_PIPELINE'   // All 6 agents — complex feature build
  | 'QUICK_FIX'       // Developer + Reviewer only — small bug fix / tweak
  | 'PLAN_ONLY'       // Analyst + Planner only — architecture / planning question
  | 'CODE_REVIEW_ONLY'; // Reviewer only — user pastes code for review

export interface RouteDecision {
  mode: PipelineMode;
  reasoning: string;
  skippedAgents: AgentName[];
  confidence: number; // 0-1
}

// ─── Enhancement 2: Agentic Tools ──────────────────────────────────────────────

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
  timestamp: string;
}

export interface ToolResult {
  toolName: string;
  output: string;
  success: boolean;
  durationMs: number;
}

// ─── Enhancement 3: RAG / Knowledge ────────────────────────────────────────────

export interface RAGChunk {
  id: string;
  source: string;       // e.g. "Next.js 14 App Router Docs"
  content: string;
  keywords: string[];
  score?: number;       // populated after retrieval
}

// ─── Enhancement 4: Flows DSL ──────────────────────────────────────────────────

export interface AgentNode {
  id: string;
  agentName: AgentName;
  description?: string;
}

export interface FlowEdge {
  from: string;  // AgentNode id
  to: string;    // AgentNode id
}

export interface FlowGraph {
  name: string;
  description: string;
  version: string;
  nodes: AgentNode[];
  edges: FlowEdge[];
  parallelGroups?: string[][]; // groups of node IDs that run in parallel
}

// ─── Enhancement 5: Checkpoint / Stateful Orchestration ───────────────────────

export interface PipelineCheckpoint {
  id: string;
  requirement: string;
  createdAt: string;
  lastUpdatedAt: string;
  completedStages: string[];
  results: Record<string, AgentResult>;
  isComplete: boolean;
  workspacePath?: string;
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
  | 'pipeline_paused'
  | 'route_decision'    // NEW: router classified the intent
  | 'tool_call'         // NEW: an agent is calling a tool
  | 'tool_result'       // NEW: tool returned a result
  | 'rag_retrieval'     // NEW: RAG retrieved relevant docs
  | 'checkpoint_saved'; // NEW: pipeline state saved to disk
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
  // Routing-specific
  routeDecision?: RouteDecision;
  // Tool-specific
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  // RAG-specific
  ragChunks?: RAGChunk[];
  // Checkpoint-specific
  checkpointId?: string;
}

// API Request/Response types
export interface OrchestrateRequest {
  requirement: string;
  resumeCheckpointId?: string; // Enhancement 5: resume from saved checkpoint
  flowName?: string;           // Enhancement 4: run a named custom flow
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
  checkpointId?: string; // Enhancement 5: link to resumable checkpoint
  pipelineMode?: PipelineMode; // Enhancement 1: which mode was used
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
  'router-agent': {
    name: 'router-agent',
    displayName: 'Router / Classifier',
    description: 'Classifies user intent and routes to the optimal pipeline subset',
    model: 'llama-3.1-8b-instant',
    icon: '🧭',
    color: '#f43f5e',
    maxTokens: 512,
  },
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
