// ============================================================
// Evaluation Harness — Agent Scorecard
// Tracks per-agent quality metrics over time.
// Persists to localStorage (same pattern as ROI history).
// ============================================================

const SCORECARD_KEY = 'mao_agent_scorecard';
const MAX_HISTORY_ENTRIES = 100;

export interface AgentMetricEntry {
  runId: string;
  timestamp: number;
  latencyMs: number;
  tokensUsed: number;
  retryCount: number;
  wasApproved: boolean;      // Did this agent's output pass review/validation?
  evalScore?: number;         // LLM-as-judge score (1-10) if evaluated
  errorOccurred: boolean;
}

export interface AgentScorecard {
  agentName: string;
  totalRuns: number;
  avgLatencyMs: number;
  avgTokensUsed: number;
  retryRate: number;          // % of runs that needed retries
  approvalRate: number;       // % of runs that were approved first try
  errorRate: number;          // % of runs that errored
  avgEvalScore: number;       // avg LLM-as-judge score (0 if never evaluated)
  trend: 'improving' | 'stable' | 'declining'; // based on last 10 vs previous 10
  history: AgentMetricEntry[];
}

export interface ScorecardStore {
  agents: Record<string, AgentScorecard>;
  lastUpdated: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Load the full scorecard store from localStorage.
 */
export function loadScorecardStore(): ScorecardStore {
  if (!isBrowser()) return { agents: {}, lastUpdated: 0 };
  try {
    const raw = localStorage.getItem(SCORECARD_KEY);
    return raw ? JSON.parse(raw) : { agents: {}, lastUpdated: 0 };
  } catch {
    return { agents: {}, lastUpdated: 0 };
  }
}

/**
 * Save the scorecard store to localStorage.
 */
function saveScorecardStore(store: ScorecardStore): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SCORECARD_KEY, JSON.stringify(store));
  } catch { /* quota exceeded */ }
}

/**
 * Record a new metric entry for an agent.
 */
export function recordAgentMetric(
  agentName: string,
  entry: Omit<AgentMetricEntry, 'timestamp'>
): void {
  const store = loadScorecardStore();

  if (!store.agents[agentName]) {
    store.agents[agentName] = createEmptyScorecard(agentName);
  }

  const scorecard = store.agents[agentName];
  const fullEntry: AgentMetricEntry = {
    ...entry,
    timestamp: Date.now(),
  };

  // Add to history (keep last N)
  scorecard.history.push(fullEntry);
  if (scorecard.history.length > MAX_HISTORY_ENTRIES) {
    scorecard.history = scorecard.history.slice(-MAX_HISTORY_ENTRIES);
  }

  // Recalculate aggregates
  recalculateAggregates(scorecard);

  store.lastUpdated = Date.now();
  saveScorecardStore(store);
}

/**
 * Get the scorecard for a specific agent.
 */
export function getAgentScorecard(agentName: string): AgentScorecard {
  const store = loadScorecardStore();
  return store.agents[agentName] || createEmptyScorecard(agentName);
}

/**
 * Get scorecards for all agents.
 */
export function getAllScorecards(): Record<string, AgentScorecard> {
  return loadScorecardStore().agents;
}

/**
 * Clear all scorecard data.
 */
export function clearScorecards(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(SCORECARD_KEY);
  } catch { /* ignore */ }
}

// ─── Internal Helpers ────────────────────────────────────────

function createEmptyScorecard(agentName: string): AgentScorecard {
  return {
    agentName,
    totalRuns: 0,
    avgLatencyMs: 0,
    avgTokensUsed: 0,
    retryRate: 0,
    approvalRate: 0,
    errorRate: 0,
    avgEvalScore: 0,
    trend: 'stable',
    history: [],
  };
}

function recalculateAggregates(scorecard: AgentScorecard): void {
  const h = scorecard.history;
  const n = h.length;
  if (n === 0) return;

  scorecard.totalRuns = n;
  scorecard.avgLatencyMs = Math.round(h.reduce((s, e) => s + e.latencyMs, 0) / n);
  scorecard.avgTokensUsed = Math.round(h.reduce((s, e) => s + e.tokensUsed, 0) / n);
  scorecard.retryRate = Math.round((h.filter(e => e.retryCount > 0).length / n) * 100);
  scorecard.approvalRate = Math.round((h.filter(e => e.wasApproved).length / n) * 100);
  scorecard.errorRate = Math.round((h.filter(e => e.errorOccurred).length / n) * 100);

  const scoredEntries = h.filter(e => e.evalScore !== undefined && e.evalScore > 0);
  scorecard.avgEvalScore = scoredEntries.length > 0
    ? Math.round((scoredEntries.reduce((s, e) => s + (e.evalScore || 0), 0) / scoredEntries.length) * 10) / 10
    : 0;

  // Calculate trend (last 10 vs previous 10)
  if (n >= 20) {
    const recent = h.slice(-10);
    const previous = h.slice(-20, -10);
    const recentAvg = recent.reduce((s, e) => s + (e.evalScore || 0), 0) / recent.length;
    const previousAvg = previous.reduce((s, e) => s + (e.evalScore || 0), 0) / previous.length;
    const diff = recentAvg - previousAvg;
    scorecard.trend = diff > 0.5 ? 'improving' : diff < -0.5 ? 'declining' : 'stable';
  }
}
