// ============================================================
// Unit Tests — LLM Provider Registry
// Tests provider configuration, model mapping, and fallbacks.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AGENT_MODELS,
  PROVIDER_MODELS,
  getModelForAgent,
} from '@/lib/providers';

describe('DEFAULT_AGENT_MODELS', () => {
  it('defines models for all 8 agents', () => {
    const expectedAgents = [
      'requirements-analyst',
      'task-planner',
      'developer',
      'code-reviewer',
      'security-reviewer',
      'testing-agent',
      'deployment-agent',
      'router-agent',
    ];
    for (const agent of expectedAgents) {
      expect(DEFAULT_AGENT_MODELS[agent]).toBeDefined();
      expect(DEFAULT_AGENT_MODELS[agent].provider).toBeTruthy();
      expect(DEFAULT_AGENT_MODELS[agent].model).toBeTruthy();
    }
  });

  it('all defaults use Groq provider', () => {
    for (const config of Object.values(DEFAULT_AGENT_MODELS)) {
      expect(config.provider).toBe('groq');
    }
  });

  it('developer agent uses a code-capable model', () => {
    expect(DEFAULT_AGENT_MODELS['developer'].model).toContain('qwen');
  });
});

describe('PROVIDER_MODELS', () => {
  it('defines models for all 7 providers', () => {
    const providers = ['groq', 'openai', 'anthropic', 'ollama', 'google', 'aws-bedrock', 'azure-openai'];
    for (const provider of providers) {
      expect(PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]).toBeDefined();
      expect(PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS].length).toBeGreaterThan(0);
    }
  });

  it('Groq models include the ones used by default agents', () => {
    const groqModels = PROVIDER_MODELS.groq;
    expect(groqModels).toContain('llama-3.1-8b-instant');
    expect(groqModels).toContain('llama-3.3-70b-versatile');
  });
});

describe('getModelForAgent', () => {
  it('returns default config when no overrides provided', () => {
    const config = getModelForAgent('developer');
    expect(config.provider).toBe('groq');
    expect(config.model).toContain('qwen');
  });

  it('applies custom model override', () => {
    const config = getModelForAgent('developer', {
      developer: { provider: 'openai', model: 'gpt-4o' },
    });
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('returns default for agents not in custom config', () => {
    const config = getModelForAgent('code-reviewer', {
      developer: { provider: 'openai', model: 'gpt-4o' },
    });
    expect(config.provider).toBe('groq');
  });

  it('falls back to default for unknown agent names', () => {
    const config = getModelForAgent('nonexistent-agent');
    expect(config.provider).toBe('groq');
    expect(config.model).toBe('llama-3.1-8b-instant');
  });
});
