// ============================================================
// UX Designer Agent (Competitor Feature: MetaGPT-style)
// Generates UI/UX wireframe specs, design tokens, and component hierarchy.
// ============================================================

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { AgentResult, AgentName, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';

const SYSTEM_PROMPT = `You are a Senior UX/UI Designer AI agent. Your role is to create comprehensive visual design specifications from requirements.

You MUST output ALL of the following:

## 1. Design System
- Color palette (primary, secondary, accent, neutrals — with hex values)
- Typography scale (font families, sizes, weights)
- Spacing system (4px grid)
- Border radii, shadows, transitions

## 2. Component Library
For each component, specify:
- **Component Name**
- **Purpose**: Why it exists
- **Props/States**: Variants (default, hover, active, disabled, error)
- **Layout**: Flexbox/Grid specifications
- **Responsive behavior**: Mobile, tablet, desktop

## 3. Page Layouts (Wireframes)
Describe each page layout in detail:
- Header, navigation, main content, sidebar, footer
- Grid structure with column counts
- Key interactions and micro-animations

## 4. User Flow Diagram
Describe the primary user flows as step-by-step journeys.

## 5. Accessibility (a11y) Notes
- Color contrast requirements (WCAG AA minimum)
- Focus management
- Screen reader considerations
- Keyboard navigation

## 6. CSS Variables / Design Tokens
Output a complete set of CSS custom properties.

Be thorough and specify exact values. The developer agent will use your specs to build the UI.`;

export async function runUXDesigner(
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
      temperature: 0.5,
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
      error: error instanceof Error ? error.message : 'UX Designer failed',
    };
  }
}
