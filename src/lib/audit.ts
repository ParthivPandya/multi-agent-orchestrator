// ============================================================
// Gap #7 — Full Audit Log & Observability Export
// Records every pipeline event with timestamp, tokens, and latency.
// ============================================================

import { AuditEvent } from './types';

const MAX_INPUT_CHARS = 500;
const MAX_OUTPUT_CHARS = 1000;

export class AuditLog {
  private events: AuditEvent[] = [];
  private runId: string;

  constructor(runId: string) {
    this.runId = runId;
  }

  log(event: Omit<AuditEvent, 'eventId' | 'pipelineRunId' | 'timestamp'>): void {
    this.events.push({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      pipelineRunId: this.runId,
      timestamp: Date.now(),
      ...event,
      // Truncate large strings to keep log file size manageable
      input: event.input ? event.input.slice(0, MAX_INPUT_CHARS) : undefined,
      output: event.output ? event.output.slice(0, MAX_OUTPUT_CHARS) : undefined,
    });
  }

  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  getRunId(): string {
    return this.runId;
  }

  /** Export the full audit log as a formatted JSON string. */
  export(): string {
    const firstTs = this.events[0]?.timestamp ?? Date.now();
    const lastTs = this.events[this.events.length - 1]?.timestamp ?? Date.now();

    const report = {
      exportedAt: new Date().toISOString(),
      pipelineRunId: this.runId,
      totalEvents: this.events.length,
      durationMs: lastTs - firstTs,
      events: this.events,
    };

    return JSON.stringify(report, null, 2);
  }
}

/**
 * Generates a unique pipeline run ID for correlation.
 */
export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
