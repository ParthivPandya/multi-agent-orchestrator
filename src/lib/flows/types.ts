// ============================================================
// Flows DSL — Type Definitions (Enhancement 4)
// ============================================================

import { AgentName } from '@/lib/types';

export interface FlowAgentNode {
    id: string;
    agentName: AgentName;
    label?: string;
    enabled: boolean;
    parallelGroup?: string; // Nodes with the same group ID run concurrently
}

export interface FlowDefinition {
    name: string;
    description: string;
    version: string;
    agents: FlowAgentNode[];
}

export type BuiltInFlowName = 'standard' | 'quick-fix' | 'plan-only' | 'code-review-only';

// The set of agents to run for each built-in flow (in order)
export const BUILT_IN_FLOWS: Record<BuiltInFlowName, FlowDefinition> = {
    'standard': {
        name: 'Standard Pipeline',
        description: 'Full 7-agent pipeline: Analyst → Planner → Developer → Reviewer → Security → Tester → Deployer',
        version: '3.0',
        agents: [
            { id: 'a1', agentName: 'requirements-analyst', label: 'Requirements Analyst', enabled: true },
            { id: 'a2', agentName: 'task-planner', label: 'Task Planner', enabled: true },
            { id: 'a3', agentName: 'developer', label: 'Developer', enabled: true },
            { id: 'a4', agentName: 'code-reviewer', label: 'Code Reviewer', enabled: true },
            { id: 'a7', agentName: 'security-reviewer', label: 'Security Reviewer', enabled: true },
            { id: 'a5', agentName: 'testing-agent', label: 'Testing Agent', enabled: true },
            { id: 'a6', agentName: 'deployment-agent', label: 'Deployment Agent', enabled: true },
        ],
    },
    'quick-fix': {
        name: 'Quick Fix',
        description: 'Fast path: Developer → Code Reviewer only. Best for small bug fixes and tweaks.',
        version: '1.0',
        agents: [
            { id: 'a3', agentName: 'developer', label: 'Developer', enabled: true },
            { id: 'a4', agentName: 'code-reviewer', label: 'Code Reviewer', enabled: true },
        ],
    },
    'plan-only': {
        name: 'Plan Only',
        description: 'Architecture mode: Requirements Analyst → Task Planner. Generates a detailed plan—no code.',
        version: '1.0',
        agents: [
            { id: 'a1', agentName: 'requirements-analyst', label: 'Requirements Analyst', enabled: true },
            { id: 'a2', agentName: 'task-planner', label: 'Task Planner', enabled: true },
        ],
    },
    'code-review-only': {
        name: 'Code Review Only',
        description: 'Paste existing code for a deep review. Skips all generation stages.',
        version: '1.0',
        agents: [
            { id: 'a4', agentName: 'code-reviewer', label: 'Code Reviewer', enabled: true },
        ],
    },
};
