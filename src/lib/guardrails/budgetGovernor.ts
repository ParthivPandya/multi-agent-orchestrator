// ============================================================
// Guardrails — Budget Governor (Token & Cost Limits)
// Tracks token usage per agent and per pipeline run.
// Prevents runaway costs by enforcing configurable budgets.
// ============================================================

export interface BudgetConfig {
  /** Maximum tokens for the entire pipeline run */
  maxPipelineTokens: number;
  /** Maximum tokens per individual agent call */
  maxAgentTokens: number;
  /** Maximum estimated USD cost for the pipeline */
  maxPipelineCostUsd: number;
  /** Warning threshold (0-1, e.g. 0.8 = warn at 80%) */
  warningThreshold: number;
}

export interface BudgetStatus {
  allowed: boolean;
  totalTokensUsed: number;
  totalTokensRemaining: number;
  agentTokensUsed: Record<string, number>;
  estimatedCostUsd: number;
  warnings: string[];
  percentUsed: number;
}

const DEFAULT_BUDGET: BudgetConfig = {
  maxPipelineTokens: 100_000,   // ~100K tokens per pipeline
  maxAgentTokens: 20_000,       // ~20K tokens per agent call
  maxPipelineCostUsd: 5.00,     // $5 max per pipeline (generous for free tiers)
  warningThreshold: 0.8,        // warn at 80%
};

// Cost per 1M tokens for supported providers
const COST_PER_1M_TOKENS: Record<string, number> = {
  groq: 0.10,         // Groq free tier
  openai: 2.50,       // GPT-4o average
  anthropic: 3.00,    // Claude Sonnet average
  ollama: 0.00,       // Local, free
  google: 1.25,       // Gemini Pro
  'aws-bedrock': 2.00,
  'azure-openai': 2.50,
};

/**
 * Budget Governor — tracks and enforces token/cost budgets per pipeline run.
 */
export class BudgetGovernor {
  private config: BudgetConfig;
  private totalTokens = 0;
  private agentTokens: Record<string, number> = {};
  private provider: string;

  constructor(config?: Partial<BudgetConfig>, provider = 'groq') {
    this.config = { ...DEFAULT_BUDGET, ...config };
    this.provider = provider;
  }

  /**
   * Check if a new agent call is within budget BEFORE executing it.
   */
  checkBudget(agentName: string, estimatedTokens: number): BudgetStatus {
    const warnings: string[] = [];
    const agentUsed = this.agentTokens[agentName] || 0;
    const projectedTotal = this.totalTokens + estimatedTokens;
    const projectedAgentTotal = agentUsed + estimatedTokens;
    const estimatedCost = this.estimateCost(projectedTotal);
    const percentUsed = projectedTotal / this.config.maxPipelineTokens;

    // Check pipeline-level budget
    if (projectedTotal > this.config.maxPipelineTokens) {
      warnings.push(`💰 Pipeline token budget exceeded: ${projectedTotal.toLocaleString()} / ${this.config.maxPipelineTokens.toLocaleString()}`);
    }

    // Check agent-level budget
    if (projectedAgentTotal > this.config.maxAgentTokens) {
      warnings.push(`💰 Agent "${agentName}" token budget exceeded: ${projectedAgentTotal.toLocaleString()} / ${this.config.maxAgentTokens.toLocaleString()}`);
    }

    // Check cost budget
    if (estimatedCost > this.config.maxPipelineCostUsd) {
      warnings.push(`💰 Pipeline cost budget exceeded: $${estimatedCost.toFixed(2)} / $${this.config.maxPipelineCostUsd.toFixed(2)}`);
    }

    // Warning threshold
    if (percentUsed >= this.config.warningThreshold && percentUsed < 1.0) {
      warnings.push(`⚠️ Token usage at ${Math.round(percentUsed * 100)}% of pipeline budget`);
    }

    const allowed = projectedTotal <= this.config.maxPipelineTokens &&
                    estimatedCost <= this.config.maxPipelineCostUsd;

    return {
      allowed,
      totalTokensUsed: this.totalTokens,
      totalTokensRemaining: Math.max(0, this.config.maxPipelineTokens - this.totalTokens),
      agentTokensUsed: { ...this.agentTokens },
      estimatedCostUsd: estimatedCost,
      warnings,
      percentUsed: Math.min(1, percentUsed),
    };
  }

  /**
   * Record actual token usage after an agent call completes.
   */
  recordUsage(agentName: string, tokensUsed: number): void {
    this.totalTokens += tokensUsed;
    this.agentTokens[agentName] = (this.agentTokens[agentName] || 0) + tokensUsed;
  }

  /**
   * Get current budget status without checking a projected call.
   */
  getStatus(): BudgetStatus {
    const estimatedCost = this.estimateCost(this.totalTokens);
    const percentUsed = this.totalTokens / this.config.maxPipelineTokens;

    return {
      allowed: true,
      totalTokensUsed: this.totalTokens,
      totalTokensRemaining: Math.max(0, this.config.maxPipelineTokens - this.totalTokens),
      agentTokensUsed: { ...this.agentTokens },
      estimatedCostUsd: estimatedCost,
      warnings: [],
      percentUsed: Math.min(1, percentUsed),
    };
  }

  /**
   * Estimate USD cost based on provider rates.
   */
  private estimateCost(tokens: number): number {
    const rate = COST_PER_1M_TOKENS[this.provider] ?? COST_PER_1M_TOKENS.groq;
    return (tokens / 1_000_000) * rate;
  }

  /**
   * Reset for a new pipeline run.
   */
  reset(): void {
    this.totalTokens = 0;
    this.agentTokens = {};
  }
}
