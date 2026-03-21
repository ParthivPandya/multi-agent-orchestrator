// ============================================================
// Feature 7 — ROI & Cost Intelligence Calculator
// Calculates the business value of every pipeline run.
// Metrics: developer hours saved, sprint acceleration,
// cost per feature, cumulative ROI, annualized value.
// Pain Point: #6 — No Visibility Into AI Pipeline ROI
// ============================================================

import { AgentResult } from '@/lib/types';

export interface ROIMetrics {
  // Time savings
  estimatedManualHours: number;      // hours a human team would take for this
  aiPipelineMinutes: number;         // actual wall-clock time of pipeline run
  hoursSaved: number;                // estimatedManualHours - (aiPipelineMinutes/60)
  timeSavedPercent: number;          // percentage time reduction

  // Cost savings (USD)
  averageDevHourlyRate: number;      // USD — configurable, default $125
  estimatedManualCostUsd: number;    // hoursSaved * hourlyRate
  llmApiCostUsd: number;             // actual Groq/OpenAI API cost for this run
  netSavingsUsd: number;             // manualCost - llmCost
  roiMultiple: number;               // netSavings / llmCost (e.g. 24x)

  // Sprint impact
  sprintDaySaved: number;            // estimated sprint days saved
  featuresPerSprint: number;         // approximate throughput increase

  // Quality metrics
  agentsRun: number;
  totalTokens: number;
  reviewIterations: number;
  securityChecked: boolean;
  testsGenerated: boolean;

  // Cumulative (from history)
  cumulativeHoursSaved: number;
  cumulativeSavingsUsd: number;
  totalRunsAnalyzed: number;
  annualizedSavingsUsd: number;

  // Per-feature breakdown
  costPerFeatureAi: number;          // llmCost / features
  costPerFeatureManual: number;      // manualCost / features
}

export interface ROIHistoryEntry {
  runId: string;
  timestamp: number;
  hoursSaved: number;
  savingsUsd: number;
  llmCostUsd: number;
  tokensUsed: number;
  pipelineMinutes: number;
}

const ROI_HISTORY_KEY = 'mao_roi_history';
const GROQ_COST_PER_1M_TOKENS = 0.10;  // $0.10 per 1M tokens (Groq free tier)
const OPENAI_COST_PER_1M_TOKENS = 2.50;
const DEFAULT_DEV_HOURLY_RATE = 125;   // USD — typical senior dev rate

// Task complexity → estimated manual dev hours mapping
const COMPLEXITY_HOURS: Record<string, number> = {
  simple:   4,    // < 200 tokens output
  small:    8,    // 200-500 tokens
  medium:   16,   // 500-1500 tokens
  large:    32,   // 1500-3000 tokens
  complex:  48,   // 3000+ tokens
};

function estimateManualHours(agentResults: Record<string, AgentResult | null>): number {
  const devResult = agentResults['developer'];
  if (!devResult?.output) return 8; // default

  const codeLength = devResult.output.length;
  const tokensEstimate = codeLength / 4; // rough chars-to-tokens

  if (tokensEstimate < 500) return COMPLEXITY_HOURS.simple;
  if (tokensEstimate < 1200) return COMPLEXITY_HOURS.small;
  if (tokensEstimate < 3000) return COMPLEXITY_HOURS.medium;
  if (tokensEstimate < 6000) return COMPLEXITY_HOURS.large;
  return COMPLEXITY_HOURS.complex;
}

function computeLLMCost(
  totalTokens: number,
  provider: 'groq' | 'openai' | 'anthropic' = 'groq'
): number {
  const costPer1M = provider === 'groq'
    ? GROQ_COST_PER_1M_TOKENS
    : provider === 'openai'
      ? OPENAI_COST_PER_1M_TOKENS
      : 3.00; // anthropic
  return (totalTokens / 1_000_000) * costPer1M;
}

/**
 * Compute ROI metrics for a completed pipeline run.
 */
export function computeROI(
  agentResults: Record<string, AgentResult | null>,
  totalTokens: number,
  totalLatencyMs: number,
  options: {
    hourlyRate?: number;
    provider?: 'groq' | 'openai' | 'anthropic';
    reviewIterations?: number;
  } = {}
): ROIMetrics {
  const hourlyRate = options.hourlyRate || DEFAULT_DEV_HOURLY_RATE;
  const provider = options.provider || 'groq';
  const reviewIterations = options.reviewIterations || 1;

  const pipelineMinutes = totalLatencyMs / 1000 / 60;
  const estimatedManualHours = estimateManualHours(agentResults);
  const hoursSaved = Math.max(0, estimatedManualHours - pipelineMinutes / 60);
  const timeSavedPercent = Math.round((hoursSaved / estimatedManualHours) * 100);

  const estimatedManualCostUsd = hoursSaved * hourlyRate;
  const llmApiCostUsd = computeLLMCost(totalTokens, provider);
  const netSavingsUsd = estimatedManualCostUsd - llmApiCostUsd;
  const roiMultiple = llmApiCostUsd > 0
    ? Math.round(netSavingsUsd / llmApiCostUsd)
    : 999;

  const sprintDaySaved = parseFloat((hoursSaved / 8).toFixed(1));
  const featuresPerSprint = parseFloat((hoursSaved / estimatedManualHours * 2).toFixed(1));

  const agentsRun = Object.values(agentResults).filter(r => r && r.status === 'complete').length;
  const securityChecked = !!agentResults['security-reviewer'];
  const testsGenerated = !!agentResults['testing-agent'] && agentResults['testing-agent']?.status === 'complete';

  // Load cumulative history
  const history = loadROIHistory();
  const cumulativeHoursSaved = history.reduce((s, e) => s + e.hoursSaved, 0) + hoursSaved;
  const cumulativeSavingsUsd = history.reduce((s, e) => s + e.savingsUsd, 0) + netSavingsUsd;
  const totalRunsAnalyzed = history.length + 1;

  // Annualize based on current run frequency
  const runsPerYear = totalRunsAnalyzed > 1
    ? (totalRunsAnalyzed / Math.max(1, (Date.now() - (history[0]?.timestamp || Date.now())) / 1000 / 60 / 60 / 24 / 365))
    : 52; // assume weekly if first run
  const annualizedSavingsUsd = Math.round(netSavingsUsd * Math.max(runsPerYear, 1));

  const costPerFeatureAi = llmApiCostUsd;
  const costPerFeatureManual = estimatedManualCostUsd;

  return {
    estimatedManualHours,
    aiPipelineMinutes: Math.round(pipelineMinutes * 10) / 10,
    hoursSaved: Math.round(hoursSaved * 10) / 10,
    timeSavedPercent,
    averageDevHourlyRate: hourlyRate,
    estimatedManualCostUsd: Math.round(estimatedManualCostUsd),
    llmApiCostUsd: Math.round(llmApiCostUsd * 100) / 100,
    netSavingsUsd: Math.round(netSavingsUsd),
    roiMultiple,
    sprintDaySaved,
    featuresPerSprint,
    agentsRun,
    totalTokens,
    reviewIterations,
    securityChecked,
    testsGenerated,
    cumulativeHoursSaved: Math.round(cumulativeHoursSaved * 10) / 10,
    cumulativeSavingsUsd: Math.round(cumulativeSavingsUsd),
    totalRunsAnalyzed,
    annualizedSavingsUsd,
    costPerFeatureAi: Math.round(costPerFeatureAi * 100) / 100,
    costPerFeatureManual: Math.round(costPerFeatureManual),
  };
}

/**
 * Persist ROI entry to localStorage (client-side only).
 */
export function saveROIEntry(
  runId: string,
  metrics: ROIMetrics
): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadROIHistory();
    const entry: ROIHistoryEntry = {
      runId,
      timestamp: Date.now(),
      hoursSaved: metrics.hoursSaved,
      savingsUsd: metrics.netSavingsUsd,
      llmCostUsd: metrics.llmApiCostUsd,
      tokensUsed: metrics.totalTokens,
      pipelineMinutes: metrics.aiPipelineMinutes,
    };
    history.unshift(entry);
    // Keep last 100 runs
    localStorage.setItem(ROI_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  } catch { /* ignore */ }
}

/**
 * Load ROI history from localStorage.
 */
export function loadROIHistory(): ROIHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROI_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clear ROI history.
 */
export function clearROIHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ROI_HISTORY_KEY);
}

/**
 * Generate a plain-text executive summary suitable for a CIO report.
 */
export function generateROISummary(metrics: ROIMetrics): string {
  return `
EXECUTIVE SUMMARY — AI Pipeline ROI Report
==========================================
Pipeline Run Analytics:
  • Estimated manual effort saved:   ${metrics.hoursSaved} hours ($${metrics.estimatedManualCostUsd.toLocaleString()})
  • LLM API cost:                    $${metrics.llmApiCostUsd}
  • Net savings this run:            $${metrics.netSavingsUsd.toLocaleString()}
  • ROI multiple:                    ${metrics.roiMultiple}x
  • Time reduction:                  ${metrics.timeSavedPercent}%
  • Pipeline execution time:         ${metrics.aiPipelineMinutes} minutes

Sprint Impact:
  • Sprint days saved:               ${metrics.sprintDaySaved} days
  • Agents executed:                 ${metrics.agentsRun}
  • Security scan included:          ${metrics.securityChecked ? 'Yes' : 'No'}
  • Tests auto-generated:            ${metrics.testsGenerated ? 'Yes' : 'No'}

Cumulative Value:
  • Total runs analyzed:             ${metrics.totalRunsAnalyzed}
  • Cumulative hours saved:          ${metrics.cumulativeHoursSaved} hours
  • Cumulative savings:              $${metrics.cumulativeSavingsUsd.toLocaleString()}
  • Projected annual value:          $${metrics.annualizedSavingsUsd.toLocaleString()}

Cost Comparison (this feature):
  • AI-assisted cost:                $${metrics.costPerFeatureAi}
  • Traditional development:         $${metrics.costPerFeatureManual.toLocaleString()}
`.trim();
}
