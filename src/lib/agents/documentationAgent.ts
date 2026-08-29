// ============================================================
// Loop Engineering — Documentation Agent
// Generates README, API docs, and JSDoc from generated code.
// Runs in parallel with the Testing Agent (non-blocking).
// ============================================================

import { generateText } from 'ai';
import { AgentResult, AGENT_CONFIGS } from '@/lib/types';
import { AgentContext } from '@/lib/context';
import { ProviderRuntimeOptions, getRuntimeModelForAgent } from '@/lib/providers/runtime';

const config = AGENT_CONFIGS['documentation-agent'];

const DOCUMENTATION_SYSTEM_PROMPT = `You are a Documentation Agent. Your role is to generate comprehensive, professional documentation from generated code.

You MUST produce ALL of the following sections:

1. **README.md** — Project overview, features, installation, usage, API reference
2. **API Documentation** — Every endpoint, function, or class with parameters, return types, and examples
3. **JSDoc/Docstring Comments** — Inline documentation for key functions and classes
4. **Architecture Notes** — Brief explanation of the code structure and design decisions

Rules:
- Write in clear, concise English
- Include code examples for every API endpoint or public function
- Use proper Markdown formatting
- Add a "Quick Start" section
- Include environment variables and configuration requirements
- Be comprehensive but not verbose

Output format: Return the documentation as a single Markdown document with clear section headers.`;

/**
 * Generates documentation from code and requirements.
 */
export async function runDocumentationAgent(
  code: string,
  requirements: string,
  context: AgentContext,
  runtime?: ProviderRuntimeOptions
): Promise<AgentResult> {
  const startTime = Date.now();
  let modelLabel = config.model;

  try {
    const runtimeModel = getRuntimeModelForAgent('documentation-agent', runtime);
    modelLabel = `${runtimeModel.resolved.provider}:${runtimeModel.resolved.model}`;

    const prompt = buildDocPrompt(code, requirements, context);

    const response = await generateText({
      model: runtimeModel.model,
      system: DOCUMENTATION_SYSTEM_PROMPT,
      prompt,
      maxTokens: config.maxTokens,
      temperature: 0.3,
    });

    return {
      agentName: 'documentation-agent',
      status: 'complete',
      output: response.text,
      model: modelLabel,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      tokensUsed: response.usage?.totalTokens,
    };
  } catch (error) {
    return {
      agentName: 'documentation-agent',
      status: 'error',
      output: '',
      model: modelLabel,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Documentation agent failed',
    };
  }
}

/**
 * Builds the documentation generation prompt.
 */
function buildDocPrompt(code: string, requirements: string, context: AgentContext): string {
  const sections: string[] = [];

  sections.push(`## Original Requirements\n${requirements}`);
  sections.push(`\n## Generated Code\n\`\`\`\n${code.slice(0, 8000)}\n\`\`\``);

  // Include reviewer feedback if available
  const reviewerOutput = context.getLastOutput('code-reviewer');
  if (reviewerOutput) {
    sections.push(`\n## Code Review Summary\n${reviewerOutput.slice(0, 1000)}`);
  }

  // Include test output if available
  const testOutput = context.getLastOutput('testing-agent');
  if (testOutput) {
    sections.push(`\n## Test Coverage\n${testOutput.slice(0, 1000)}`);
  }

  sections.push(`\nGenerate comprehensive documentation for the above code. Include a README, API docs, and inline documentation suggestions.`);

  return sections.join('\n');
}
