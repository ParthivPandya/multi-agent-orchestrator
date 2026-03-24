// ============================================================
// Product Manager Agent (Competitor Feature: MetaGPT-style)
// Generates user stories, acceptance criteria, PRD documents.
// ============================================================

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { AgentResult, AgentName, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';

const SYSTEM_PROMPT = `You are a Senior Product Manager AI agent. Your role is to analyze user requirements and produce professional product documentation.

You MUST output ALL of the following sections:

## 1. Product Requirements Document (PRD)
- Product vision and goals
- Target audience and user personas
- Problem statement
- Success metrics / KPIs

## 2. User Stories
Format each story as:
**As a** [user type] **I want to** [action] **so that** [benefit]
**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

Generate at least 5 user stories covering the core functionality.

## 3. Feature Prioritization (MoSCoW)
- **Must Have:** [list]
- **Should Have:** [list]  
- **Could Have:** [list]
- **Won't Have (this release):** [list]

## 4. Risk Assessment
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|

## 5. Timeline Estimate
Provide a high-level timeline with milestones.

Be thorough, professional, and actionable. Write as if presenting to stakeholders.`;

export async function runProductManager(
  requirement: string,
  context: AgentContext
): Promise<AgentResult> {
  const agentName: AgentName = 'requirements-analyst'; // uses similar config
  const config = AGENT_CONFIGS[agentName];
  const startTime = Date.now();

  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
    const previousResults = context.getHistory().map(r => `[${r.agentName}]: ${r.output?.slice(0, 200) || ''}`).join('\n');

    const { text, usage } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      prompt: `Requirement:\n${requirement}\n\n${previousResults ? `Context from other agents:\n${previousResults}` : ''}`,
      maxOutputTokens: config.maxTokens,
      temperature: 0.4,
    });

    const result: AgentResult = {
      agentName,
      status: 'complete',
      output: text,
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      tokensUsed: usage?.totalTokens,
      latencyMs: Date.now() - startTime,
    };
    context.add(result);
    return result;
  } catch (error) {
    return {
      agentName,
      status: 'error',
      output: '',
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Product Manager failed',
    };
  }
}
