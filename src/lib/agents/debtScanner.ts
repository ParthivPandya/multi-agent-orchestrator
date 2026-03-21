// ============================================================
// Feature 2 — Technical Debt Scanner Agent
// Analyzes generated code for architectural, security, testing,
// documentation, and dependency debt. Produces a scored report
// and prioritized backlog items tagged to business outcomes.
// Pain Points: #1 (Gartner 2500% AI defect forecast), #2 (legacy)
// ============================================================

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { AgentResult } from '@/lib/types';

export interface DebtHotspot {
  file?: string;
  type: 'architectural' | 'testing' | 'documentation' | 'security' | 'dependency' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
}

export interface DebtBacklogItem {
  title: string;
  description: string;
  businessOutcome: string;
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  priority: 'critical' | 'high' | 'medium' | 'low';
  storyPoints: number;
  category: DebtHotspot['type'];
}

export interface TechnicalDebtReport {
  debtScore: number;          // 0–10 (10 = zero debt)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  hotspots: DebtHotspot[];
  backlogItems: DebtBacklogItem[];
  categories: {
    architectural: number;   // 0–10
    testing: number;
    documentation: number;
    security: number;
    dependency: number;
    performance: number;
  };
  estimatedHoursToRemediate: number;
  language?: string;
}

const DEBT_SCANNER_PROMPT = `You are an expert Technical Debt Analyst and software architect.
Your role is to identify technical debt, architectural anti-patterns, missing abstractions, and maintainability risks in AI-generated code.

DEBT CATEGORIES TO EVALUATE:
1. **Architectural Debt** — shallow patterns, missing abstractions, god objects, tight coupling, missing dependency injection, poor separation of concerns
2. **Testing Debt** — missing tests, brittle tests, no edge case coverage, missing integration tests, hardcoded test data
3. **Documentation Debt** — missing JSDoc/docstrings, no README, undocumented APIs, no inline comments on complex logic
4. **Security Debt** — hardcoded values, missing input validation, no rate limiting, exposed secrets, SQL injection risks, missing auth checks
5. **Dependency Debt** — outdated packages, known CVE risks, excessive dependencies, missing peer dependency declarations
6. **Performance Debt** — N+1 queries, missing caching, unindexed DB queries, blocking async operations, memory leaks

SCORING:
- debtScore: 0–10 (10 = technically excellent, 0 = severe debt)
- grade: A (8-10), B (6-8), C (4-6), D (2-4), F (0-2)
- categories: score 0–10 for each of the 6 categories

OUTPUT FORMAT — respond ONLY with valid JSON:
{
  "debtScore": <number 0-10>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2-3 sentence executive summary of technical health>",
  "categories": {
    "architectural": <0-10>,
    "testing": <0-10>,
    "documentation": <0-10>,
    "security": <0-10>,
    "dependency": <0-10>,
    "performance": <0-10>
  },
  "hotspots": [
    {
      "type": "<architectural|testing|documentation|security|dependency|performance>",
      "severity": "<critical|high|medium|low>",
      "description": "<specific issue>",
      "recommendation": "<actionable fix>",
      "effort": "<XS|S|M|L|XL>"
    }
  ],
  "backlogItems": [
    {
      "title": "<backlog ticket title>",
      "description": "<detailed description>",
      "businessOutcome": "<what business value this delivers when fixed>",
      "effort": "<XS|S|M|L|XL>",
      "priority": "<critical|high|medium|low>",
      "storyPoints": <1|2|3|5|8>,
      "category": "<debt category>"
    }
  ],
  "estimatedHoursToRemediate": <number>
}`;

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 8) return 'A';
  if (score >= 6) return 'B';
  if (score >= 4) return 'C';
  if (score >= 2) return 'D';
  return 'F';
}

export async function runTechnicalDebtScanner(
  generatedCode: string,
  language?: string,
  apiKey?: string
): Promise<AgentResult & { debtReport?: TechnicalDebtReport }> {
  const startMs = Date.now();
  const groq = createGroq({ apiKey: apiKey || process.env.GROQ_API_KEY || '' });

  const codeSnippet = generatedCode.slice(0, 12000); // token budget

  try {
    const { text, usage } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: DEBT_SCANNER_PROMPT,
      prompt: `Analyze the following ${language ? `${language} ` : ''}generated code for technical debt:\n\n\`\`\`\n${codeSnippet}\n\`\`\`\n\nProvide a comprehensive technical debt analysis in the JSON format specified.`,
      maxOutputTokens: 3000,
      temperature: 0.2,
    });

    // Parse the debt report
    let debtReport: TechnicalDebtReport | undefined;
    try {
      const cleaned = text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const jsonStart = cleaned.indexOf('{');
      const parsed = JSON.parse(cleaned.slice(jsonStart));

      debtReport = {
        debtScore: Number(parsed.debtScore) || 5,
        grade: scoreToGrade(Number(parsed.debtScore) || 5),
        summary: parsed.summary || 'Analysis complete.',
        hotspots: (parsed.hotspots || []).slice(0, 10),
        backlogItems: (parsed.backlogItems || []).slice(0, 10),
        categories: parsed.categories || {
          architectural: 5, testing: 5, documentation: 5,
          security: 5, dependency: 5, performance: 5,
        },
        estimatedHoursToRemediate: Number(parsed.estimatedHoursToRemediate) || 0,
        language,
      };
    } catch {
      // If JSON fails, return text as summary
      debtReport = {
        debtScore: 5,
        grade: 'C',
        summary: text.slice(0, 500),
        hotspots: [],
        backlogItems: [],
        categories: { architectural: 5, testing: 5, documentation: 5, security: 5, dependency: 5, performance: 5 },
        estimatedHoursToRemediate: 0,
        language,
      };
    }

    return {
      agentName: 'debt-scanner' as AgentResult['agentName'],
      status: 'complete',
      output: JSON.stringify(debtReport, null, 2),
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      tokensUsed: usage?.totalTokens,
      latencyMs: Date.now() - startMs,
      debtReport,
    };
  } catch (err) {
    return {
      agentName: 'debt-scanner' as AgentResult['agentName'],
      status: 'error',
      output: '',
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      latencyMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
