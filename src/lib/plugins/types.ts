// ============================================================
// Plugin Architecture — Type Definitions
// Defines the plugin interface for extending the orchestrator
// with custom agents, tools, and connectors.
// ============================================================

import { z } from 'zod';
import { AgentResult, AgentName } from '@/lib/types';
import { AgentContext } from '@/lib/context';

// ─── Plugin Types ────────────────────────────────────────────

export type PluginType = 'agent' | 'tool' | 'connector' | 'guardrail';

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  icon?: string;
  color?: string;
  tags?: string[];
}

// ─── Agent Plugin ────────────────────────────────────────────

export interface AgentPluginConfig {
  /** System prompt for the agent */
  systemPrompt: string;
  /** Default model to use */
  model: string;
  /** Maximum output tokens */
  maxTokens: number;
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Tools this agent can use */
  tools?: ToolPluginConfig[];
  /** The agent execution function */
  run: (input: string, context: AgentContext) => Promise<AgentResult>;
}

// ─── Tool Plugin ─────────────────────────────────────────────

export interface ToolPluginConfig {
  /** Tool name (used in prompts) */
  name: string;
  /** Description for the LLM to understand when to use this tool */
  description: string;
  /** Zod schema for parameters */
  parameters: z.ZodType;
  /** The tool execution function */
  execute: (params: unknown) => Promise<{ output: string; success: boolean }>;
}

// ─── Connector Plugin ────────────────────────────────────────

export interface ConnectorPluginConfig {
  /** Connector type identifier */
  type: string;
  /** Display name */
  displayName: string;
  /** Configuration fields required */
  configFields: { name: string; type: 'string' | 'password' | 'url'; required: boolean }[];
  /** Send notification/result to this connector */
  send: (config: Record<string, string>, payload: { title: string; content: string; metadata?: Record<string, unknown> }) => Promise<boolean>;
}

// ─── Guardrail Plugin ────────────────────────────────────────

export interface GuardrailPluginConfig {
  /** When this guardrail runs */
  stage: 'input' | 'output' | 'between_agents';
  /** The guardrail check function */
  check: (content: string, context: { agentName?: string; stage?: string }) => Promise<{
    passed: boolean;
    warnings: string[];
    severity: 'info' | 'warning' | 'critical';
  }>;
}

// ─── Combined Plugin Interface ───────────────────────────────

export interface Plugin {
  metadata: PluginMetadata;
  agent?: AgentPluginConfig;
  tool?: ToolPluginConfig;
  connector?: ConnectorPluginConfig;
  guardrail?: GuardrailPluginConfig;
}

// ─── Plugin Registration Event ───────────────────────────────

export interface PluginEvent {
  type: 'registered' | 'unregistered' | 'error';
  pluginName: string;
  pluginType: PluginType;
  timestamp: number;
  error?: string;
}
