// ============================================================
// Gap #3 — Handoff Validator Utility
// Validates raw agent output against a Zod schema.
// Strips markdown code fences before parsing.
// ============================================================

import { ZodSchema } from 'zod';

export interface HandoffValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  raw: string;
}

/**
 * Attempts to parse and validate raw agent output against a Zod schema.
 * Strips markdown code fences (```json ... ```) before attempting JSON parse.
 */
export function validateHandoff<T>(
  agentName: string,
  rawOutput: string,
  schema: ZodSchema<T>
): HandoffValidationResult<T> {
  // Strip all common markdown code fence variations
  const cleaned = rawOutput
    .replace(/```(?:json|typescript|ts|js|javascript)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to extract a JSON object or array substring
  let jsonCandidate = cleaned;
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');

  if (objectStart !== -1 || arrayStart !== -1) {
    const start = objectStart === -1 ? arrayStart
      : arrayStart === -1 ? objectStart
        : Math.min(objectStart, arrayStart);
    jsonCandidate = cleaned.slice(start);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return {
      success: false,
      errors: [
        `[${agentName}] Output is not valid JSON. ` +
        `First 300 chars: ${rawOutput.slice(0, 300)}`,
      ],
      raw: rawOutput,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Zod v4 uses .issues (v3 used .errors)
    const issues = result.error.issues as Array<{ path: Array<string | number>; message: string }>;
    const errors = issues.map(
      e => `[${agentName}] Field "${e.path.join('.')}" — ${e.message}`
    );
    return { success: false, errors, raw: rawOutput };
  }

  return { success: true, data: result.data, raw: rawOutput };
}
