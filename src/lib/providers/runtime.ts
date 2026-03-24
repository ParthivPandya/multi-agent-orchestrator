import { AgentModelConfig, ProviderName } from '@/lib/types';
import { buildProvider, getModelForAgent } from '@/lib/providers';

export interface ProviderRuntimeOptions {
  customModels?: Partial<Record<string, AgentModelConfig>>;
  apiKeys?: Partial<Record<ProviderName, string>>;
  ollamaUrl?: string;
}

export interface RuntimeModelHandle {
  model: unknown;
  resolved: AgentModelConfig;
}

export function getRuntimeModelForAgent(
  agentName: string,
  runtime?: ProviderRuntimeOptions
): RuntimeModelHandle {
  const resolved = getModelForAgent(agentName, runtime?.customModels);
  const provider = buildProvider({
    name: resolved.provider,
    apiKey: runtime?.apiKeys?.[resolved.provider],
    baseUrl: resolved.provider === 'ollama' ? runtime?.ollamaUrl : undefined,
  });

  return {
    model: provider(resolved.model),
    resolved,
  };
}
