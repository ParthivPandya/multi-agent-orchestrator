// ============================================================
// Multi-Agent Orchestration System — Shared Type Definitions
// ============================================================

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error' | 'skipped' | 'waiting_hitl';

export type AgentName =
  | 'requirements-analyst'
  | 'task-planner'
  | 'developer'
  | 'code-reviewer'
  | 'security-reviewer'
  | 'testing-agent'
  | 'deployment-agent'
  | 'product-manager'
  | 'ux-designer'
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
  security: AgentResult | null;
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

// ─── Gap #1: HITL Types ────────────────────────────────────────────────────────

export type HITLDecision = 'approved' | 'rejected' | 'changes_requested';

export interface HITLRequest {
  id: string;
  pipelineRunId: string;
  stage: 'post_review' | 'pre_deployment' | 'post_security';
  agentOutput: string;
  reviewScore?: number;
  requestedAt: number;
}

export interface HITLResponse {
  requestId: string;
  decision: HITLDecision;
  feedback?: string;
  reviewerNote?: string;
  decidedAt: number;
}

// ─── Gap #7: Audit Log Types ────────────────────────────────────────────────────

export interface AuditEvent {
  eventId: string;
  pipelineRunId: string;
  timestamp: number;
  eventType:
    | 'pipeline_start' | 'pipeline_complete' | 'pipeline_aborted'
    | 'stage_start' | 'stage_complete' | 'stage_error'
    | 'retry_attempt' | 'iteration_info'
    | 'hitl_requested' | 'hitl_resolved'
    | 'security_blocked' | 'delivery_action'
    | 'validation_error' | 'parallel_group_start' | 'parallel_group_complete';
  stage?: string;
  agentName?: string;
  input?: string;
  output?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  latencyMs?: number;
  retryAttempt?: number;
  decision?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Gap #2: Multi-Provider LLM Types ─────────────────────────────────────────

export type ProviderName = 'groq' | 'openai' | 'anthropic' | 'ollama' | 'google' | 'aws-bedrock' | 'azure-openai';

export interface AgentModelConfig {
  provider: ProviderName;
  model: string;
}

// Pipeline event for streaming updates to the frontend
export interface PipelineEvent {
  type:
  | 'stage_start'
  | 'stage_complete'
  | 'stage_error'
  | 'stage_token'
  | 'pipeline_complete'
  | 'pipeline_blocked'
  | 'iteration_info'
  | 'final_result'
  | 'retry_attempt'
  | 'pipeline_paused'
  | 'route_decision'
  | 'tool_call'
  | 'tool_result'
  | 'rag_retrieval'
  | 'checkpoint_saved'
  | 'hitl_requested'
  | 'hitl_resolved'
  | 'parallel_group_start'
  | 'parallel_group_complete'
  | 'validation_error'
  | 'memory_loaded';
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
  // HITL-specific
  requestId?: string;
  decision?: HITLDecision;
  feedback?: string;
  reviewScore?: number;
  // Parallel-specific
  agents?: string[];
  // Token streaming
  token?: string;
  // Security-specific
  severity?: string;
  vulnerabilities?: unknown[];
  blocked?: boolean;
  // Validation-specific
  details?: string[];
  // Memory-specific
  memoryContext?: string;
  runCount?: number;
}

// API Request/Response types
export interface OrchestrateRequest {
  requirement: string;
  resumeCheckpointId?: string;
  flowName?: string;
  hitlEnabled?: boolean;
  workflowId?: string;
  customModels?: Partial<Record<string, AgentModelConfig>>;
  apiKeys?: Partial<Record<ProviderName, string>>;
  ollamaUrl?: string;
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
  checkpointId?: string;
  pipelineMode?: PipelineMode;
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
  'security-reviewer': {
    name: 'security-reviewer',
    displayName: 'Security Reviewer',
    description: 'Scans generated code for OWASP Top 10 vulnerabilities',
    model: 'llama-3.3-70b-versatile',
    icon: '🛡️',
    color: '#ef4444',
    maxTokens: 3072,
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
  'product-manager': {
    name: 'product-manager',
    displayName: 'Product Manager',
    description: 'Generates user stories, PRDs, and prioritizations',
    model: 'llama-3.3-70b-versatile',
    icon: '📊',
    color: '#f59e0b',
    maxTokens: 2048,
  },
  'ux-designer': {
    name: 'ux-designer',
    displayName: 'UX/UI Designer',
    description: 'Creates comprehensive design systems and wireframes',
    model: 'llama-3.3-70b-versatile',
    icon: '🎨',
    color: '#ec4899',
    maxTokens: 2048,
  },
};
