// ============================================================
// Unit Tests — Audit Log Module
// Tests event logging, export, and run ID generation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLog, generateRunId } from '@/lib/audit';

describe('AuditLog', () => {
  let auditLog: AuditLog;

  beforeEach(() => {
    auditLog = new AuditLog('run_test_123');
  });

  it('initializes with a run ID and empty events', () => {
    expect(auditLog.getRunId()).toBe('run_test_123');
    expect(auditLog.getEvents()).toHaveLength(0);
  });

  it('logs events with auto-generated fields', () => {
    auditLog.log({
      eventType: 'stage_start',
      stage: 'analyst',
      agentName: 'Requirements Analyst',
    });

    const events = auditLog.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('stage_start');
    expect(events[0].pipelineRunId).toBe('run_test_123');
    expect(events[0].eventId).toMatch(/^evt_/);
    expect(events[0].timestamp).toBeTypeOf('number');
  });

  it('truncates long input to 500 characters', () => {
    const longInput = 'A'.repeat(1000);
    auditLog.log({
      eventType: 'stage_complete',
      stage: 'developer',
      agentName: 'Developer Agent',
      input: longInput,
    });

    const events = auditLog.getEvents();
    expect(events[0].input!.length).toBe(500);
  });

  it('truncates long output to 1000 characters', () => {
    const longOutput = 'B'.repeat(2000);
    auditLog.log({
      eventType: 'stage_complete',
      stage: 'developer',
      agentName: 'Developer Agent',
      output: longOutput,
    });

    const events = auditLog.getEvents();
    expect(events[0].output!.length).toBe(1000);
  });

  it('returns a copy of events (not a reference)', () => {
    auditLog.log({ eventType: 'stage_start', stage: 'test', agentName: 'Test' });
    const events1 = auditLog.getEvents();
    const events2 = auditLog.getEvents();
    expect(events1).not.toBe(events2);
    expect(events1).toEqual(events2);
  });

  it('exports a valid JSON string', () => {
    auditLog.log({ eventType: 'stage_start', stage: 'analyst', agentName: 'Analyst' });
    auditLog.log({ eventType: 'stage_complete', stage: 'analyst', agentName: 'Analyst' });

    const exported = auditLog.export();
    const parsed = JSON.parse(exported);

    expect(parsed.pipelineRunId).toBe('run_test_123');
    expect(parsed.totalEvents).toBe(2);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.durationMs).toBeTypeOf('number');
    expect(parsed.events).toHaveLength(2);
  });

  it('export handles empty event log', () => {
    const exported = auditLog.export();
    const parsed = JSON.parse(exported);
    expect(parsed.totalEvents).toBe(0);
    expect(parsed.events).toHaveLength(0);
  });
});

describe('generateRunId', () => {
  it('returns a string matching run_ prefix', () => {
    const id = generateRunId();
    expect(id).toMatch(/^run_\d+_[a-z0-9]+$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRunId()));
    expect(ids.size).toBe(100);
  });
});
