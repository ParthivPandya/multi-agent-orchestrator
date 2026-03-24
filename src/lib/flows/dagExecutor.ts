// ============================================================
// DAG-Based Workflow Executor (Competitor Feature: Flexible Workflow Graphs)
// Supports branching, conditional routing, parallel groups,
// and human checkpoints — similar to Microsoft Agent Framework.
// ============================================================

import { AgentName } from '@/lib/types';

// ─── DAG Node Types ──────────────────────────────────────────

export type DAGNodeType = 'agent' | 'condition' | 'parallel' | 'human_checkpoint' | 'merge';

export interface DAGNode {
  id: string;
  type: DAGNodeType;
  agentName?: AgentName;
  label: string;
  description?: string;
  // Position for visual editor
  x: number;
  y: number;
  // Condition node config
  condition?: {
    field: string;       // e.g., 'review.decision'
    operator: '==' | '!=' | '>' | '<' | 'contains';
    value: string;
    trueBranch: string;   // target node id
    falseBranch: string;  // target node id
  };
  // Parallel node config
  parallelBranches?: string[][]; // arrays of node IDs per branch
  // Human checkpoint config
  checkpointConfig?: {
    timeoutMs: number;
    autoApprove: boolean;
    instructions: string;
  };
}

export interface DAGEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: string; // e.g., 'approved', 'rejected'
}

export interface DAGWorkflow {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  entryNodeId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Execution State ─────────────────────────────────────────

export type NodeExecutionStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped' | 'waiting';

export interface NodeExecution {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
}

export interface DAGExecutionState {
  workflowId: string;
  runId: string;
  nodeExecutions: Record<string, NodeExecution>;
  currentNodes: string[]; // nodes currently executing (can be parallel)
  completedNodes: string[];
  isComplete: boolean;
  startedAt: number;
}

// ─── Graph Utilities ─────────────────────────────────────────

/**
 * Topological sort of a DAG. Returns ordered node IDs.
 * Throws if a cycle is detected.
 */
export function topologicalSort(nodes: DAGNode[], edges: DAGEdge[]): string[] {
  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  nodes.forEach(n => {
    adjacency[n.id] = [];
    inDegree[n.id] = 0;
  });

  edges.forEach(e => {
    if (adjacency[e.from]) {
      adjacency[e.from].push(e.to);
      inDegree[e.to] = (inDegree[e.to] || 0) + 1;
    }
  });

  const queue: string[] = [];
  Object.entries(inDegree).forEach(([id, deg]) => {
    if (deg === 0) queue.push(id);
  });

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Cycle detected in workflow DAG');
  }
  return sorted;
}

/**
 * Get the immediate successors of a node.
 */
export function getSuccessors(nodeId: string, edges: DAGEdge[]): string[] {
  return edges.filter(e => e.from === nodeId).map(e => e.to);
}

/**
 * Get the immediate predecessors of a node.
 */
export function getPredecessors(nodeId: string, edges: DAGEdge[]): string[] {
  return edges.filter(e => e.to === nodeId).map(e => e.from);
}

/**
 * Check if all predecessors are complete.
 */
export function allPredecessorsComplete(
  nodeId: string,
  edges: DAGEdge[],
  completedNodes: Set<string>
): boolean {
  const preds = getPredecessors(nodeId, edges);
  return preds.every(p => completedNodes.has(p));
}

/**
 * Get the next executable nodes given current state.
 */
export function getNextExecutableNodes(
  workflow: DAGWorkflow,
  completedNodes: Set<string>,
  runningNodes: Set<string>
): string[] {
  return workflow.nodes
    .filter(n =>
      !completedNodes.has(n.id) &&
      !runningNodes.has(n.id) &&
      allPredecessorsComplete(n.id, workflow.edges, completedNodes)
    )
    .map(n => n.id);
}

// ─── Built-in DAG Workflows ─────────────────────────────────

export const BUILT_IN_DAG_WORKFLOWS: Record<string, DAGWorkflow> = {
  'standard-pipeline': {
    id: 'standard-pipeline',
    name: 'Standard Pipeline',
    description: 'Full 8-agent linear pipeline with review loop',
    version: '3.0',
    entryNodeId: 'n-router',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 'n-router', type: 'agent', agentName: 'router-agent', label: 'Router', x: 400, y: 50 },
      { id: 'n-analyst', type: 'agent', agentName: 'requirements-analyst', label: 'Analyst', x: 400, y: 150 },
      { id: 'n-planner', type: 'agent', agentName: 'task-planner', label: 'Planner', x: 400, y: 250 },
      { id: 'n-developer', type: 'agent', agentName: 'developer', label: 'Developer', x: 400, y: 350 },
      { id: 'n-reviewer', type: 'agent', agentName: 'code-reviewer', label: 'Reviewer', x: 400, y: 450 },
      { id: 'n-review-gate', type: 'condition', label: 'Approved?', x: 400, y: 550, condition: { field: 'review.decision', operator: '==', value: 'APPROVED', trueBranch: 'n-security', falseBranch: 'n-developer' } },
      { id: 'n-security', type: 'agent', agentName: 'security-reviewer', label: 'Security', x: 400, y: 650 },
      { id: 'n-parallel-gate', type: 'parallel', label: 'Parallel Stage', x: 400, y: 750, parallelBranches: [['n-tester'], ['n-deployer']] },
      { id: 'n-tester', type: 'agent', agentName: 'testing-agent', label: 'Tester', x: 250, y: 850 },
      { id: 'n-deployer', type: 'agent', agentName: 'deployment-agent', label: 'Deployer', x: 550, y: 850 },
      { id: 'n-merge', type: 'merge', label: 'Complete', x: 400, y: 950 },
    ],
    edges: [
      { id: 'e1', from: 'n-router', to: 'n-analyst' },
      { id: 'e2', from: 'n-analyst', to: 'n-planner' },
      { id: 'e3', from: 'n-planner', to: 'n-developer' },
      { id: 'e4', from: 'n-developer', to: 'n-reviewer' },
      { id: 'e5', from: 'n-reviewer', to: 'n-review-gate' },
      { id: 'e6', from: 'n-review-gate', to: 'n-security', label: 'approved' },
      { id: 'e7', from: 'n-review-gate', to: 'n-developer', label: 'rejected' },
      { id: 'e8', from: 'n-security', to: 'n-parallel-gate' },
      { id: 'e9', from: 'n-parallel-gate', to: 'n-tester' },
      { id: 'e10', from: 'n-parallel-gate', to: 'n-deployer' },
      { id: 'e11', from: 'n-tester', to: 'n-merge' },
      { id: 'e12', from: 'n-deployer', to: 'n-merge' },
    ],
  },

  'security-first': {
    id: 'security-first',
    name: 'Security-First Pipeline',
    description: 'Security review runs before code review with human checkpoint',
    version: '1.0',
    entryNodeId: 'n-router',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 'n-router', type: 'agent', agentName: 'router-agent', label: 'Router', x: 400, y: 50 },
      { id: 'n-analyst', type: 'agent', agentName: 'requirements-analyst', label: 'Analyst', x: 400, y: 150 },
      { id: 'n-planner', type: 'agent', agentName: 'task-planner', label: 'Planner', x: 400, y: 250 },
      { id: 'n-developer', type: 'agent', agentName: 'developer', label: 'Developer', x: 400, y: 350 },
      { id: 'n-security', type: 'agent', agentName: 'security-reviewer', label: 'Security', x: 400, y: 450 },
      { id: 'n-sec-gate', type: 'condition', label: 'Secure?', x: 400, y: 550, condition: { field: 'security.blocked', operator: '==', value: 'false', trueBranch: 'n-reviewer', falseBranch: 'n-developer' } },
      { id: 'n-reviewer', type: 'agent', agentName: 'code-reviewer', label: 'Reviewer', x: 400, y: 650 },
      { id: 'n-human', type: 'human_checkpoint', label: 'Human Review', x: 400, y: 750, checkpointConfig: { timeoutMs: 600000, autoApprove: true, instructions: 'Review the generated code and security report before deployment.' } },
      { id: 'n-tester', type: 'agent', agentName: 'testing-agent', label: 'Tester', x: 400, y: 850 },
      { id: 'n-deployer', type: 'agent', agentName: 'deployment-agent', label: 'Deployer', x: 400, y: 950 },
    ],
    edges: [
      { id: 'e1', from: 'n-router', to: 'n-analyst' },
      { id: 'e2', from: 'n-analyst', to: 'n-planner' },
      { id: 'e3', from: 'n-planner', to: 'n-developer' },
      { id: 'e4', from: 'n-developer', to: 'n-security' },
      { id: 'e5', from: 'n-security', to: 'n-sec-gate' },
      { id: 'e6', from: 'n-sec-gate', to: 'n-reviewer', label: 'secure' },
      { id: 'e7', from: 'n-sec-gate', to: 'n-developer', label: 'vulnerable' },
      { id: 'e8', from: 'n-reviewer', to: 'n-human' },
      { id: 'e9', from: 'n-human', to: 'n-tester' },
      { id: 'e10', from: 'n-tester', to: 'n-deployer' },
    ],
  },

  'rapid-prototype': {
    id: 'rapid-prototype',
    name: 'Rapid Prototype',
    description: 'Developer only — skip planning and review for fast iteration',
    version: '1.0',
    entryNodeId: 'n-developer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 'n-developer', type: 'agent', agentName: 'developer', label: 'Developer', x: 400, y: 200 },
      { id: 'n-deployer', type: 'agent', agentName: 'deployment-agent', label: 'Deployer', x: 400, y: 400 },
    ],
    edges: [
      { id: 'e1', from: 'n-developer', to: 'n-deployer' },
    ],
  },
};
