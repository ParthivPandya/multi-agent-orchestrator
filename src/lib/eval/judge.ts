// ============================================================
// Evaluation Harness — LLM-as-Judge
// Uses a separate LLM call to score agent outputs on multiple
// quality dimensions. Provides structured evaluation scores.
// ============================================================

import { generateText } from 'ai';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

export interface EvalDimension {
  name: string;
  score: number;  // 1-10
  reasoning: string;
}

export interface EvalScore {
  overall: number;  // 1-10 weighted average
  dimensions: Record<string, number>;
  dimensionDetails: EvalDimension[];
  reasoning: string;
  judgeModel: string;
  evaluatedAt: string;
}

const JUDGE_SYSTEM_PROMPT = `You are a strict, unbiased Code Quality Judge. You evaluate AI-generated code outputs against the original requirements.

You MUST score the output on exactly these 5 dimensions (1-10 scale):

1. **relevance** — Does the output address what was asked? (1=completely off-topic, 10=perfectly targeted)
2. **completeness** — Are all requirements covered? (1=major gaps, 10=everything included)
3. **code_quality** — Is the code clean, idiomatic, and well-structured? (1=spaghetti, 10=production-ready)
4. **security** — Are there obvious security issues? (1=critical vulns, 10=security-conscious)
5. **documentation** — Is the code well-documented with comments? (1=no comments, 10=comprehensive docs)

You MUST respond with ONLY a JSON object in this exact format:
{
  "dimensions": [
    { "name": "relevance", "score": 8, "reasoning": "brief explanation" },
    { "name": "completeness", "score": 7, "reasoning": "brief explanation" },
    { "name": "code_quality", "score": 9, "reasoning": "brief explanation" },
    { "name": "security", "score": 6, "reasoning": "brief explanation" },
    { "name": "documentation", "score": 5, "reasoning": "brief explanation" }
  ],
  "overallReasoning": "1-2 sentence overall assessment"
}

Be honest and critical. Do not inflate scores. A score of 7+ means genuinely good.`;

/**
 * Evaluates agent output using an LLM-as-judge approach.
 */
export async function evaluateWithJudge(
  agentOutput: string,
  requirement: string,
  runtime?: ProviderRuntimeOptions
): Promise<EvalScore> {
  try {
    const runtimeModel = getRuntimeModelForAgent('code-reviewer', runtime); // reuse reviewer model
    const judgeModel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

    const prompt = `## Original Requirement
${requirement.slice(0, 2000)}

## Agent Output to Evaluate
${agentOutput.slice(0, 6000)}

Evaluate this output. Return ONLY the JSON score object.`;

    const response = await generateText({
      model: runtimeModel.model,
      system: JUDGE_SYSTEM_PROMPT,
      prompt,
      maxTokens: 1024,
      temperature: 0.1, // Low temperature for consistent scoring
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createDefaultScore(judgeModel, 'Failed to parse judge response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const dimensionDetails: EvalDimension[] = parsed.dimensions || [];
    const dimensions: Record<string, number> = {};

    for (const dim of dimensionDetails) {
      dimensions[dim.name] = dim.score;
    }

    // Weighted average (code_quality weighted higher)
    const weights: Record<string, number> = {
      relevance: 0.25,
      completeness: 0.25,
      code_quality: 0.25,
      security: 0.15,
      documentation: 0.10,
    };

    let overall = 0;
    let totalWeight = 0;
    for (const [name, weight] of Object.entries(weights)) {
      if (dimensions[name] !== undefined) {
        overall += dimensions[name] * weight;
        totalWeight += weight;
      }
    }
    overall = totalWeight > 0 ? overall / totalWeight : 5;

    return {
      overall: Math.round(overall * 10) / 10,
      dimensions,
      dimensionDetails,
      reasoning: parsed.overallReasoning || '',
      judgeModel,
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return createDefaultScore('unknown', error instanceof Error ? error.message : 'Evaluation failed');
  }
}

function createDefaultScore(model: string, reasoning: string): EvalScore {
  return {
    overall: 0,
    dimensions: {},
    dimensionDetails: [],
    reasoning,
    judgeModel: model,
    evaluatedAt: new Date().toISOString(),
  };
}
