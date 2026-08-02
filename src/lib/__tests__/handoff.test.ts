// ============================================================
// Unit Tests — Handoff Validation
// Tests JSON parsing, Zod schema validation, and edge cases.
// ============================================================

import { describe, it, expect } from 'vitest';
import { validateHandoff } from '@/lib/validation/handoff';
import { AnalystOutputSchema, PlannerOutputSchema, ReviewerOutputSchema, SecurityOutputSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

describe('validateHandoff — JSON parsing', () => {
  const SimpleSchema = z.object({ name: z.string(), value: z.number() });

  it('parses valid JSON', () => {
    const result = validateHandoff('test', '{"name": "foo", "value": 42}', SimpleSchema);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'foo', value: 42 });
  });

  it('strips markdown code fences (```json)', () => {
    const result = validateHandoff('test', '```json\n{"name": "bar", "value": 7}\n```', SimpleSchema);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'bar', value: 7 });
  });

  it('strips markdown code fences (```typescript)', () => {
    const result = validateHandoff('test', '```typescript\n{"name": "baz", "value": 99}\n```', SimpleSchema);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'baz', value: 99 });
  });

  it('extracts JSON from text with leading content', () => {
    const rawOutput = 'Here is the analysis result:\n\n{"name": "extracted", "value": 1}';
    const result = validateHandoff('test', rawOutput, SimpleSchema);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('extracted');
  });

  it('fails on non-JSON input', () => {
    const result = validateHandoff('test', 'This is just plain text without JSON', SimpleSchema);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('not valid JSON');
  });

  it('preserves raw output in all cases', () => {
    const raw = '{"name": "test", "value": 1}';
    const result = validateHandoff('test', raw, SimpleSchema);
    expect(result.raw).toBe(raw);
  });
});

describe('validateHandoff — Zod schema validation', () => {
  const StrictSchema = z.object({
    status: z.enum(['ok', 'error']),
    count: z.number().min(0),
  });

  it('fails on invalid enum value', () => {
    const result = validateHandoff('agent', '{"status": "unknown", "count": 5}', StrictSchema);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some(e => e.includes('status'))).toBe(true);
  });

  it('fails on number constraint violation', () => {
    const result = validateHandoff('agent', '{"status": "ok", "count": -1}', StrictSchema);
    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('count'))).toBe(true);
  });

  it('includes agent name in error messages', () => {
    const result = validateHandoff('MyAgent', '{"status": "bad"}', StrictSchema);
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('[MyAgent]');
  });
});

describe('validateHandoff — Real Schemas', () => {
  it('validates a valid analyst output', () => {
    const output = JSON.stringify({
      title: 'Todo API',
      description: 'REST API for todos',
      functionalRequirements: ['CRUD operations', 'Auth'],
      complexity: 'medium',
    });
    const result = validateHandoff('Analyst', output, AnalystOutputSchema);
    expect(result.success).toBe(true);
  });

  it('validates a valid planner output', () => {
    const output = JSON.stringify({
      tasks: [
        {
          id: 'T1',
          title: 'Setup project',
          priority: 'high',
          dependencies: [],
          description: 'Initialize the project',
        },
      ],
    });
    const result = validateHandoff('Planner', output, PlannerOutputSchema);
    expect(result.success).toBe(true);
  });

  it('validates a valid reviewer output', () => {
    const output = JSON.stringify({
      decision: 'APPROVED',
      score: 8,
      issues: [],
      summary: 'Good code quality',
    });
    const result = validateHandoff('Reviewer', output, ReviewerOutputSchema);
    expect(result.success).toBe(true);
  });

  it('validates a valid security output', () => {
    const output = JSON.stringify({
      passed: true,
      severity: 'none',
      vulnerabilities: [],
      summary: 'No security issues found',
    });
    const result = validateHandoff('Security', output, SecurityOutputSchema);
    expect(result.success).toBe(true);
  });

  it('rejects reviewer score out of range', () => {
    const output = JSON.stringify({
      decision: 'APPROVED',
      score: 15,
      issues: [],
      summary: 'Score too high',
    });
    const result = validateHandoff('Reviewer', output, ReviewerOutputSchema);
    expect(result.success).toBe(false);
  });
});
