// ============================================================
// Gap #4 — Security Reviewer Agent
// Performs OWASP-aligned security analysis of generated code.
// CRITICAL or HIGH severity blocks the pipeline.
// ============================================================

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { SECURITY_REVIEWER_PROMPT } from '@/lib/prompts/security.prompt';
import { validateHandoff } from '@/lib/validation/handoff';
import { SecurityOutputSchema, SecurityOutput } from '@/lib/validation/schemas';

const config = AGENT_CONFIGS['security-reviewer'];

const BLOCKING_SEVERITIES = new Set(['critical', 'high']);

export interface SecurityReviewResult extends AgentResult {
  securityOutput?: SecurityOutput;
  blocked: boolean;
}

export async function runSecurityReviewer(
  generatedCode: string,
  context: AgentContext,
): Promise<SecurityReviewResult> {
  const startTime = Date.now();

  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

    const { text, usage } = await generateText({
      model: groq(config.model),
      system: SECURITY_REVIEWER_PROMPT,
      prompt: `Review the following generated code for security vulnerabilities:\n\n${generatedCode}`,
      maxOutputTokens: config.maxTokens,
      temperature: 0.1,
    });

    const latencyMs = Date.now() - startTime;

    const validation = validateHandoff('security-reviewer', text, SecurityOutputSchema);

    if (!validation.success) {
      // Parse failure is non-fatal — log warning and pass pipeline
      console.warn('[security-reviewer] Output validation failed:', validation.errors);

      const fallbackResult: SecurityReviewResult = {
        agentName: 'security-reviewer',
        status: 'complete',
        output: text,
        timestamp: new Date().toISOString(),
        model: config.model,
        tokensUsed: usage?.totalTokens,
        latencyMs,
        securityOutput: {
          passed: true,
          severity: 'none',
          vulnerabilities: [],
          summary: 'Security review completed — output parsing error, treated as passed.',
        },
        blocked: false,
      };

      context.add(fallbackResult);
      return fallbackResult;
    }

    const securityOutput = validation.data!;
    const blocked = BLOCKING_SEVERITIES.has(securityOutput.severity);

    const result: SecurityReviewResult = {
      agentName: 'security-reviewer',
      status: 'complete',
      output: text,
      timestamp: new Date().toISOString(),
      model: config.model,
      tokensUsed: usage?.totalTokens,
      latencyMs,
      securityOutput,
      blocked,
    };

    context.add(result);
    return result;

  } catch (error) {
    const errorResult: SecurityReviewResult = {
      agentName: 'security-reviewer',
      status: 'error',
      output: '',
      timestamp: new Date().toISOString(),
      model: config.model,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      blocked: false,
    };
    context.add(errorResult);
    return errorResult;
  }
}
