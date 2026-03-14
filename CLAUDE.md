# CLAUDE.md — Multi-Agent AI Orchestrator (v2)

> This file provides project context for AI coding assistants (Claude, Cursor, Copilot, etc.).
> Read this first before exploring the codebase. It will save you a lot of tokens.

---

## 🏗️ What This Project Is

A **Next.js 16 + TypeScript** web application that converts natural language requirements into production-ready code using a **7-agent AI pipeline** powered by the **Groq API** (free tier) via the **Vercel AI SDK**.

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **LLM Provider:** Groq Cloud (free tier) via `@ai-sdk/groq`
- **Styling:** Vanilla CSS (glassmorphism dark theme, no Tailwind)
- **State:** React `useState`/`useCallback`/`useMemo` only (no Redux, no Zustand)
- **Persistence:** localStorage (history), file system (workspace + checkpoints)
- **Dev server:** `npm run dev` → `http://localhost:3000`

---

## ⚡ Most Important Commands

```bash
npm run dev          # Start dev server (Turbopack, port 3000)
npm run build        # Production build
npx tsc --noEmit     # Type-check without compiling
npm run lint         # ESLint
```

---

## 📁 Critical File Map

Only read files you actually need. Here's what each directory is for:

```
src/lib/
├── types/index.ts          ← ALL shared types (start here when adding features)
├── orchestrator.ts         ← Pipeline controller — the main execution engine
├── context.ts              ← AgentContext class (shared state between agents)
├── fileParser.ts           ← Extracts ### File: `path` code blocks from LLM output
├── history.ts              ← localStorage save/restore + analytics computation
│
├── agents/                 ← One file per agent. All follow the same pattern.
│   ├── routerAgent.ts      ← Intent classifier (runs BEFORE pipeline starts)
│   ├── requirementsAnalyst.ts
│   ├── taskPlanner.ts
│   ├── developer.ts
│   ├── codeReviewer.ts
│   ├── testingAgent.ts
│   └── deploymentAgent.ts
│
├── prompts/                ← System prompts + user prompt builders for each agent
│   ├── analyst.prompt.ts
│   ├── planner.prompt.ts
│   ├── developer.prompt.ts ← Accepts ragAndSearchContext param
│   ├── reviewer.prompt.ts  ← Accepts ragContext + lintContext params
│   ├── testing.prompt.ts
│   └── deployer.prompt.ts
│
├── tools/                  ← Agentic tools (Enhancement 2)
│   ├── index.ts            ← Barrel export
│   ├── searchWeb.ts        ← DuckDuckGo Instant Answer API
│   ├── readFile.ts         ← Sandboxed .workspace/ file reader
│   └── lintCode.ts         ← 13-rule static linter, returns 0-100 score
│
├── rag/                    ← RAG Knowledge Base (Enhancement 3)
│   ├── knowledgeBase.ts    ← Static array of RAGChunk objects (doc snippets)
│   └── retriever.ts        ← TF-IDF cosine similarity search + keyword boosting
│
├── flows/                  ← Flows DSL (Enhancement 4)
│   └── types.ts            ← FlowDefinition, FlowAgentNode, BUILT_IN_FLOWS map
│
└── workspace/              ← Stateful orchestration (Enhancement 5)
    └── checkpoint.ts       ← JSON checkpoint save/load/list/delete

src/components/
├── AgentCard.tsx           ← Single agent status card (idle/running/complete/error/skipped)
├── PipelineView.tsx        ← Full pipeline column (includes router node, skipped styling)
├── OutputPanel.tsx         ← Formatted/Raw/JSON tabs for agent output
├── WorkspaceViewer.tsx     ← File tree + code viewer + save + ZIP download
├── AnalyticsPanel.tsx      ← Token/latency bar charts
├── HistoryPanel.tsx        ← Slide-in past runs panel
└── RequirementInput.tsx    ← Text area + examples + submit/stop buttons

src/app/
├── page.tsx                ← Main UI (all state lives here)
├── layout.tsx              ← Root layout + SEO metadata
├── globals.css             ← Design system (CSS variables, animations)
└── api/
    ├── orchestrate/route.ts   ← POST: runs pipeline, SSE stream
    ├── agent/route.ts         ← POST: test single agent
    └── workspace/route.ts     ← GET/POST: list + save files
```

---

## 🔑 Key Design Patterns

### 1. Adding a New Agent

Every agent follows the **exact same pattern**. Copy `src/lib/agents/requirementsAnalyst.ts` and change:

```typescript
// 1. Import your prompt
import { MY_SYSTEM_PROMPT, getMyPrompt } from '@/lib/prompts/my.prompt';

// 2. Use the right AGENT_CONFIGS entry
const config = AGENT_CONFIGS['my-agent-name'];

// 3. generateText call (always the same shape)
const { text, usage } = await generateText({
    model: groq(config.model),
    system: MY_SYSTEM_PROMPT,
    prompt: getMyPrompt(input),
    maxOutputTokens: config.maxTokens,  // ← Note: maxOutputTokens, NOT maxTokens
    temperature: 0.3,
});

// 4. Return AgentResult
const result: AgentResult = {
    agentName: 'my-agent-name',
    status: 'complete',
    output: text,
    timestamp: new Date().toISOString(),
    model: config.model,
    tokensUsed: usage?.totalTokens,
    latencyMs: Date.now() - startTime,
};
context.add(result);
return result;
```

Then:
- Add the agent to `AgentName` union in `src/lib/types/index.ts`
- Add a config entry to `AGENT_CONFIGS` in `src/lib/types/index.ts`
- Add it to `INITIAL_STATUSES` and `STAGE_TO_AGENT` in `src/app/page.tsx`
- Wire it into `orchestrator.ts`

### 2. Adding a New Tool

Copy `src/lib/tools/searchWeb.ts`. Export the function from `src/lib/tools/index.ts`. Call it inside `orchestrator.ts` within the relevant stage and emit a `tool_call` / `tool_result` event to the SSE stream.

### 3. Expanding the RAG Knowledge Base

Open `src/lib/rag/knowledgeBase.ts` and add a new `RAGChunk` object to the `KNOWLEDGE_BASE` array:

```typescript
{
    id: 'unique-id',
    source: 'Framework Name — Topic',
    keywords: ['keyword1', 'keyword2', 'framework'],  // critical for boosting
    content: `Multi-line doc content here...`,
},
```

The TF-IDF vocabulary and chunk vectors are rebuilt at module load time, so no other changes needed.

### 4. Adding a New Pipeline Mode / Flow

Open `src/lib/flows/types.ts` and add to `BUILT_IN_FLOWS`:

```typescript
'my-mode': {
    name: 'My Custom Mode',
    description: 'What this flow does',
    version: '1.0',
    agents: [
        { id: 'a1', agentName: 'developer', label: 'Developer', enabled: true },
    ],
},
```

Then update `routerAgent.ts` to return this mode in `SKIPPED_AGENTS`.

---

## 🌊 How SSE Streaming Works

**Server side** (`api/orchestrate/route.ts`):
```typescript
const stream = new ReadableStream({
    async start(controller) {
        const onEvent = (event: PipelineEvent) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        await runPipeline(requirement, onEvent);
        controller.close();
    }
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

**Client side** (`page.tsx`):
```typescript
const reader = response.body?.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // parse `data: {...}\n\n` lines, switch on event.type
}
```

All `PipelineEvent` types are defined in `src/lib/types/index.ts`. When adding a new event type, add it to both the union and the switch statement in `page.tsx`.

---

## 📋 All PipelineEvent Types

```typescript
type:
| 'stage_start'       // agent began
| 'stage_complete'    // agent finished (carries output, model, latencyMs)
| 'stage_error'       // fatal error after all retries
| 'pipeline_complete' // all stages done
| 'iteration_info'    // dev/reviewer loop state
| 'final_result'      // full results payload
| 'retry_attempt'     // agent failed, retrying
| 'pipeline_paused'   // (reserved)
| 'route_decision'    // router classified intent (carries RouteDecision)
| 'tool_call'         // agent calling a tool (carries ToolCall)
| 'tool_result'       // tool returned (carries ToolResult)
| 'rag_retrieval'     // RAG found relevant chunks (carries RAGChunk[])
| 'checkpoint_saved'  // state written to disk (carries checkpointId)
```

---

## 🧠 Agent Models (don't change without testing)

| Agent | Model | Why |
|-------|-------|-----|
| Router | `llama-3.1-8b-instant` | Ultra-fast, minimal tokens for classification |
| Analyst | `llama-3.1-8b-instant` | Fast structured extraction |
| Planner | `meta-llama/llama-4-scout-17b-16e-instruct` | Good at hierarchical task decomposition |
| Developer | `qwen/qwen3-32b` | Best code generation on Groq free tier |
| Reviewer | `llama-3.3-70b-versatile` | Strongest reasoning for code analysis |
| Tester | `llama-3.3-70b-versatile` | Strongest reasoning for test generation |
| Deployer | `llama-3.1-8b-instant` | Simple template generation, fast |

---

## 💎 Type System Quick Reference

Key types (all in `src/lib/types/index.ts`):

```typescript
// Core
type AgentStatus = 'idle' | 'running' | 'complete' | 'error' | 'skipped';
type AgentName = 'router-agent' | 'requirements-analyst' | 'task-planner' | 
                 'developer' | 'code-reviewer' | 'testing-agent' | 'deployment-agent';

// v2 Routing
type PipelineMode = 'FULL_PIPELINE' | 'QUICK_FIX' | 'PLAN_ONLY' | 'CODE_REVIEW_ONLY';
interface RouteDecision { mode, reasoning, skippedAgents, confidence }

// v2 Tools
interface ToolCall   { toolName, input, timestamp }
interface ToolResult { toolName, output, success, durationMs }

// v2 RAG
interface RAGChunk   { id, source, content, keywords, score? }

// v2 Flows
interface FlowDefinition  { name, description, version, agents }
interface FlowAgentNode   { id, agentName, label, enabled, parallelGroup? }

// v2 Checkpoints
interface PipelineCheckpoint { id, requirement, createdAt, lastUpdatedAt, 
                               completedStages, results, isComplete }
```

---

## ⚠️ Common Gotchas

1. **`maxOutputTokens` not `maxTokens`** — The Vercel AI SDK v6 uses `maxOutputTokens`. Using `maxTokens` will compile but silently do nothing.

2. **No `s` regex flag** — The TypeScript target is ES2017. Avoid `/pattern/s` (dotAll). Use `/[\s\S]/` instead.

3. **`AgentStatus` must include `'skipped'`** — Any `Record<AgentStatus, ...>` object (like in `AgentCard.tsx`) must have a `skipped` key or TypeScript will error.

4. **Server-only imports** — `src/lib/tools/readFile.ts`, `src/lib/workspace/checkpoint.ts` use Node.js `fs`. Never import them in client components (`'use client'`). They are only safe in API routes and the orchestrator (which runs server-side).

5. **Checkpoint directory** — `.workspace/checkpoints/` is created automatically. It's gitignored. Don't reference it with a hardcoded absolute path — always use `path.join(process.cwd(), '.workspace', 'checkpoints')`.

6. **RAG vocabulary is built once** — `VOCABULARY` and `CHUNK_VECTORS` in `retriever.ts` are computed at module load time (top-level). Adding chunks to `knowledgeBase.ts` automatically re-indexes them on next server start.

7. **Router always falls back to `FULL_PIPELINE`** — Any error in `classifyIntent()` silently catches and returns `FULL_PIPELINE`. This is intentional — the router must never block users.

8. **`'use client'` boundary** — `page.tsx`, all components are client components. `orchestrator.ts` and all of `lib/` (except `history.ts` and `fileParser.ts`) run server-side only via the API route.

9. **INTER_AGENT_DELAY_MS** — There is a 1500ms delay between every agent call in `orchestrator.ts`. This is intentional rate-limit protection for Groq's free tier. Don't remove it.

10. **Checkpoint ID format** — IDs are `${Date.now().toString(36)}-${rand4hex}` (e.g., `lk3x2a-f4c1`). Always validate with `path.resolve()` before any file I/O to prevent path traversal.

---

## 🗂️ State Management in `page.tsx`

All pipeline state lives in `page.tsx`. Here are the key state vars:

```typescript
agentStatuses   // Record<AgentName, AgentStatus> — drives pipeline view colours
agentResults    // Record<string, AgentResult | null> — all LLM outputs
selectedAgent   // AgentName | null — which card is focused
routeDecision   // RouteDecision | null — shown in route banner (v2)
activityFeed    // string[] — tool calls, RAG, checkpoints (v2), max 20 items
checkpointId    // string | null — last saved checkpoint (v2)
isRunning       // bool
pipelineComplete // bool
totalTokens     // number
```

---

## 🔧 Environment Variables

```env
GROQ_API_KEY=gsk_...    # Required. Get at https://console.groq.com (free)
```

No other env vars are needed. The DuckDuckGo search and all RAG/linting are keyless.

---

## 📐 CSS Design System

All design tokens are CSS variables in `src/app/globals.css`. Key ones:

```css
--bg-primary       /* main dark background */
--bg-glass         /* glassmorphism card bg */
--border-primary   /* subtle borders */
--text-primary     /* main text */
--text-muted       /* secondary text */
--accent-indigo    /* #6366f1 — primary brand */
--accent-emerald   /* #10b981 — success */
--accent-amber     /* #f59e0b — warning/retry */
--font-sans        /* Inter, system-ui */
--font-mono        /* JetBrains Mono, monospace */
```

Agent-specific colour comes from `AGENT_CONFIGS[name].color` in `types/index.ts`, applied as `--agent-color` CSS variable on `.agent-card`.

---

## 📦 Dependencies (what's actually used)

```json
"@ai-sdk/groq": "^3.0.29",  // Groq provider for Vercel AI SDK
"ai": "^6.0.116",           // generateText, streamText
"lucide-react": "^0.577.0", // Icons
"next": "16.1.6",
"react": "19.2.3",
"zod": "^4.3.6"             // (available, not yet heavily used in v2)
```

**No** vector DB dependency. **No** LangChain. **No** external embedding API. RAG is pure TypeScript TF-IDF.
