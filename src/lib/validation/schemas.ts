// ============================================================
// Gap #3 — Structured Output Validation (Zod schemas)
// Defines per-agent output schemas for handoff validation.
// ============================================================

import { z } from 'zod';

export const AnalystOutputSchema = z.object({
  functionalRequirements: z.array(z.string()).optional(),
  nonFunctionalRequirements: z.array(z.string()).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  // Also support the legacy flat format from existing agent
  title: z.string().optional(),
  description: z.string().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  tech_stack: z.union([
    z.array(z.string()),
    z.record(z.string(), z.string()),
  ]).optional(),
  techStack: z.union([
    z.object({
      language: z.string(),
      framework: z.string().optional(),
      database: z.string().optional(),
      testing: z.string().optional(),
    }),
    z.record(z.string(), z.string()),
  ]).optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  constraints: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
});

export const PlannerOutputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'P0', 'P1', 'P2']),
    dependencies: z.array(z.string()),
    estimatedSize: z.enum(['XS', 'S', 'M', 'L', 'XL']).optional(),
    size: z.enum(['S', 'M', 'L', 'XL']).optional(),
    description: z.string(),
  })),
  totalEstimate: z.string().optional(),
  total_complexity: z.string().optional(),
  estimated_effort: z.string().optional(),
});

export const ReviewerOutputSchema = z.object({
  status: z.enum(['APPROVED', 'CHANGES_REQUESTED']).optional(),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']).optional(),
  score: z.number().min(1).max(10).optional(),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'major', 'minor', 'suggestion']),
    description: z.string(),
    suggestion: z.string().optional(),
    location: z.string().optional(),
  })).optional(),
  summary: z.string().optional(),
});

export const SecurityOutputSchema = z.object({
  passed: z.boolean(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'none']),
  vulnerabilities: z.array(z.object({
    type: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    location: z.string().optional(),
    evidence: z.string().optional(),
    recommendation: z.string(),
  })),
  summary: z.string(),
  owasp_categories: z.array(z.string()).optional(),
});

export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>;
export type SecurityOutput = z.infer<typeof SecurityOutputSchema>;
