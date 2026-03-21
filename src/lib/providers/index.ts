// ============================================================
// Gap #2 — Multi-Provider LLM Registry
// Supports Groq, OpenAI, Anthropic, and Ollama.
// Each agent can independently use a different provider + model.
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { ProviderName, AgentModelConfig } from '@/lib/types';

// Default model mapping per agent — all using Groq until overridden via Settings
export const DEFAULT_AGENT_MODELS: Record<string, AgentModelConfig> = {
  'requirements-analyst': { provider: 'groq', model: 'llama-3.1-8b-instant' },
  'task-planner':         { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  'developer':            { provider: 'groq', model: 'qwen/qwen3-32b' },
  'code-reviewer':        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  'security-reviewer':    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  'testing-agent':        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  'deployment-agent':     { provider: 'groq', model: 'llama-3.1-8b-instant' },
  'router-agent':         { provider: 'groq', model: 'llama-3.1-8b-instant' },
};

export const PROVIDER_MODELS: Record<ProviderName, string[]> = {
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3-32b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama3-70b-8192',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
  ollama: ['llama3', 'mistral', 'codellama', 'deepseek-coder', 'phi3'],
};

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Builds a provider instance from a config.
 * Falls back to Groq if the requested provider packages are not installed.
 */
export function buildProvider(config: ProviderConfig) {
  switch (config.name) {
    case 'groq':
      return createGroq({ apiKey: config.apiKey ?? process.env.GROQ_API_KEY! });

    case 'openai': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createOpenAI } = require('@ai-sdk/openai');
        return createOpenAI({ apiKey: config.apiKey ?? process.env.OPENAI_API_KEY });
      } catch {
        console.warn('[providers] @ai-sdk/openai not installed, falling back to Groq');
        return createGroq({ apiKey: process.env.GROQ_API_KEY! });
      }
    }

    case 'anthropic': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createAnthropic } = require('@ai-sdk/anthropic');
        return createAnthropic({ apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY });
      } catch {
        console.warn('[providers] @ai-sdk/anthropic not installed, falling back to Groq');
        return createGroq({ apiKey: process.env.GROQ_API_KEY! });
      }
    }

    case 'ollama': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createOllama } = require('ollama-ai-provider');
        return createOllama({ baseURL: config.baseUrl ?? 'http://localhost:11434/api' });
      } catch {
        console.warn('[providers] ollama-ai-provider not installed, falling back to Groq');
        return createGroq({ apiKey: process.env.GROQ_API_KEY! });
      }
    }

    default:
      return createGroq({ apiKey: process.env.GROQ_API_KEY! });
  }
}

/**
 * Returns the model config for a specific agent, applying custom overrides if provided.
 */
export function getModelForAgent(
  agentName: string,
  customModels?: Partial<Record<string, AgentModelConfig>>
): AgentModelConfig {
  return customModels?.[agentName] ?? DEFAULT_AGENT_MODELS[agentName] ?? { provider: 'groq', model: 'llama-3.1-8b-instant' };
}
