// ============================================================
// Unit Tests — Evaluation Harness
// Tests golden test pattern matching, scorecard metrics,
// and plugin registry functionality.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateGoldenTest, GOLDEN_TESTS, runGoldenTestSuite } from '@/lib/eval/goldenTests';
import { PluginRegistry } from '@/lib/plugins/registry';
import type { Plugin } from '@/lib/plugins/types';

// ─── Golden Tests ────────────────────────────────────────────

describe('Golden Tests — evaluateGoldenTest()', () => {
  it('passes when all patterns match and length is sufficient', () => {
    const test = GOLDEN_TESTS[0]; // REST API CRUD
    const output = `
      Here's a REST API for a todo app:
      
      app.GET('/todos', getTodos);
      app.POST('/todos', createTodo);
      app.PUT('/todos/:id', updateTodo);
      app.DELETE('/todos/:id', deleteTodo);
      
      Each endpoint handles CRUD operations on the todo route.
      The API follows RESTful conventions with proper HTTP methods.
    `.repeat(3); // Ensure length > 500

    const result = evaluateGoldenTest(test, output);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.missedPatterns).toHaveLength(0);
  });

  it('fails when key patterns are missing', () => {
    const test = GOLDEN_TESTS[0]; // REST API CRUD
    const output = 'Here is a simple function that does nothing useful.';
    const result = evaluateGoldenTest(test, output);
    expect(result.passed).toBe(false);
    expect(result.missedPatterns.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(60);
  });

  it('penalizes forbidden patterns', () => {
    const test = GOLDEN_TESTS[1]; // Authentication System
    const output = `
      JWT token authentication with login and register.
      Use password hashing with bcrypt and auth middleware.
      const token = jwt.sign(payload, 'plain text password');
    `.repeat(5);

    const result = evaluateGoldenTest(test, output);
    expect(result.forbiddenFound.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it('considers output length in scoring', () => {
    const test = GOLDEN_TESTS[0]; // minOutputLength: 500
    const shortOutput = 'GET POST PUT DELETE todo endpoint route';
    const result = evaluateGoldenTest(test, shortOutput);
    // All patterns match but output is too short
    expect(result.score).toBeLessThan(90);
  });

  it('handles empty output gracefully', () => {
    const test = GOLDEN_TESTS[0];
    const result = evaluateGoldenTest(test, '');
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.outputLength).toBe(0);
  });

  it('provides detailed result information', () => {
    const test = GOLDEN_TESTS[0];
    const result = evaluateGoldenTest(test, 'GET POST todo endpoint');
    expect(result.testId).toBe('gt-001');
    expect(result.testName).toBe('REST API CRUD');
    expect(result.details).toBeTruthy();
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });
});

describe('Golden Tests — Dataset', () => {
  it('has at least 20 test cases', () => {
    expect(GOLDEN_TESTS.length).toBeGreaterThanOrEqual(20);
  });

  it('all test cases have required fields', () => {
    for (const test of GOLDEN_TESTS) {
      expect(test.id).toBeTruthy();
      expect(test.name).toBeTruthy();
      expect(test.requirement).toBeTruthy();
      expect(test.expectedPatterns.length).toBeGreaterThan(0);
      expect(test.minOutputLength).toBeGreaterThan(0);
      expect(test.category).toBeTruthy();
    }
  });

  it('all test IDs are unique', () => {
    const ids = GOLDEN_TESTS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers multiple categories', () => {
    const categories = new Set(GOLDEN_TESTS.map(t => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });
});

describe('Golden Tests — runGoldenTestSuite()', () => {
  it('returns aggregated results', () => {
    const outputs = new Map<string, string>();
    outputs.set('gt-001', 'GET POST PUT DELETE todo endpoint route ' + 'x'.repeat(500));
    outputs.set('gt-002', 'JWT token auth password hash middleware ' + 'x'.repeat(800));

    const suiteResult = runGoldenTestSuite(outputs);
    expect(suiteResult.totalTests).toBe(2);
    expect(suiteResult.passRate).toBeGreaterThanOrEqual(0);
    expect(suiteResult.avgScore).toBeGreaterThanOrEqual(0);
    expect(suiteResult.executedAt).toBeTruthy();
  });

  it('handles no matching outputs', () => {
    const outputs = new Map<string, string>();
    const suiteResult = runGoldenTestSuite(outputs);
    expect(suiteResult.totalTests).toBe(0);
    expect(suiteResult.passRate).toBe(0);
  });
});

// ─── Plugin Registry ────────────────────────────────────────

describe('Plugin Registry', () => {
  beforeEach(() => {
    PluginRegistry.clear();
  });

  const mockPlugin: Plugin = {
    metadata: {
      name: 'test-agent',
      version: '1.0.0',
      description: 'A test agent plugin',
      type: 'agent',
      icon: '🧪',
    },
    agent: {
      systemPrompt: 'You are a test agent.',
      model: 'llama-3.1-8b-instant',
      maxTokens: 1024,
      run: async (input) => ({
        agentName: 'reflection-agent' as const,
        status: 'complete' as const,
        output: `Test output for: ${input}`,
        model: 'test',
        timestamp: new Date().toISOString(),
      }),
    },
  };

  it('registers a plugin successfully', () => {
    PluginRegistry.register(mockPlugin);
    expect(PluginRegistry.size).toBe(1);
    expect(PluginRegistry.has('test-agent', 'agent')).toBe(true);
  });

  it('prevents duplicate registration', () => {
    PluginRegistry.register(mockPlugin);
    expect(() => PluginRegistry.register(mockPlugin)).toThrow('already registered');
  });

  it('retrieves a plugin by name and type', () => {
    PluginRegistry.register(mockPlugin);
    const retrieved = PluginRegistry.get('test-agent', 'agent');
    expect(retrieved).toBeDefined();
    expect(retrieved?.metadata.name).toBe('test-agent');
  });

  it('returns undefined for non-existent plugin', () => {
    expect(PluginRegistry.get('nonexistent', 'agent')).toBeUndefined();
  });

  it('lists all registered plugins', () => {
    PluginRegistry.register(mockPlugin);
    const list = PluginRegistry.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('test-agent');
  });

  it('filters plugins by type', () => {
    PluginRegistry.register(mockPlugin);
    const toolPlugin: Plugin = {
      metadata: { name: 'test-tool', version: '1.0.0', description: 'A test tool', type: 'tool' },
      tool: {
        name: 'testTool',
        description: 'Does testing',
        parameters: {} as never,
        execute: async () => ({ output: 'ok', success: true }),
      },
    };
    PluginRegistry.register(toolPlugin);

    expect(PluginRegistry.getByType('agent')).toHaveLength(1);
    expect(PluginRegistry.getByType('tool')).toHaveLength(1);
    expect(PluginRegistry.getByType('connector')).toHaveLength(0);
  });

  it('unregisters a plugin', () => {
    PluginRegistry.register(mockPlugin);
    expect(PluginRegistry.size).toBe(1);
    const removed = PluginRegistry.unregister('test-agent', 'agent');
    expect(removed).toBe(true);
    expect(PluginRegistry.size).toBe(0);
  });

  it('validates plugin structure', () => {
    const invalidPlugin: Plugin = {
      metadata: { name: 'bad-plugin', version: '1.0.0', description: 'Bad', type: 'agent' },
      // Missing agent config!
    };
    expect(() => PluginRegistry.register(invalidPlugin)).toThrow('must include an "agent" configuration');
  });

  it('maintains event log', () => {
    PluginRegistry.register(mockPlugin);
    const events = PluginRegistry.getEventLog();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('registered');
    expect(events[0].pluginName).toBe('test-agent');
  });

  it('gets agent names from plugins', () => {
    PluginRegistry.register(mockPlugin);
    const names = PluginRegistry.getAgentNames();
    expect(names).toContain('test-agent');
  });

  it('clears all plugins', () => {
    PluginRegistry.register(mockPlugin);
    PluginRegistry.clear();
    expect(PluginRegistry.size).toBe(0);
    expect(PluginRegistry.getEventLog()).toHaveLength(0);
  });
});
