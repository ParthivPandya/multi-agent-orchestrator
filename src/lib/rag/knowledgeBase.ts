// ============================================================
// RAG — In-Memory Knowledge Base (Enhancement 3)
// Seeded with up-to-date docs for popular frameworks.
// No external DB required — pure in-memory cosine search.
// ============================================================

import { RAGChunk } from '@/lib/types';

export const KNOWLEDGE_BASE: RAGChunk[] = [
    // ─── Next.js 15 / App Router ───────────────────────────────────────────────
    {
        id: 'nextjs-app-router-basics',
        source: 'Next.js 15 App Router Docs',
        keywords: ['nextjs', 'next.js', 'app router', 'layout', 'page', 'server component'],
        content: `Next.js 15 App Router — Core Conventions:
- Every folder under /app is a route segment. A page.tsx exports the default page component.
- layout.tsx wraps all segments beneath it and persists between navigations — do NOT use useState here.
- Server Components are the default. Add "use client" directive only for interactivity (useState, useEffect, onClick, browser APIs).
- Route Handlers: app/api/*/route.ts exports GET, POST, PUT, DELETE, PATCH functions.
- Metadata: export const metadata = { title: '...', description: '...' } from any layout or page.
- Server Actions: mark async functions with "use server". Call them directly from client components.
- Dynamic segments: [slug], catch-all [...slug], optional catch-all [[...slug]].
- generateStaticParams() replaces getStaticPaths for static rendering of dynamic routes.`,
    },
    {
        id: 'nextjs-data-fetching',
        source: 'Next.js 15 — Data Fetching',
        keywords: ['nextjs', 'fetch', 'data fetching', 'cache', 'revalidate', 'server side', 'ssr', 'ssg'],
        content: `Next.js 15 Data Fetching:
- fetch() in Server Components supports caching: fetch(url, { cache: 'force-cache' | 'no-store' })
- Incremental revalidation: fetch(url, { next: { revalidate: 60 } }) — seconds
- unstable_cache() wraps any async function with caching.
- Parallel data fetching: use Promise.all([fetch1, fetch2]) to avoid waterfall.
- Do NOT use useEffect to fetch data in server components — they are async by default.
- For client-side fetching: use SWR or React Query. Avoid useEffect + fetch directly.
- Loading UI: create loading.tsx in the same folder as page.tsx for Suspense boundaries.`,
    },
    {
        id: 'nextjs-image-font',
        source: 'Next.js 15 — Image & Font Optimization',
        keywords: ['nextjs', 'image', 'next/image', 'font', 'next/font', 'optimization'],
        content: `Next.js Image & Font:
- Always use next/image <Image> instead of <img>. It auto-optimizes, lazy loads, and prevents CLS.
- Required props: src, alt, width/height (or fill for responsive). 
- For external images, add the domain to next.config.ts images.remotePatterns.
- next/font/google: import { Inter } from 'next/font/google'; const inter = Inter({ subsets: ['latin'] });
- Apply font via className={inter.className} on <body> or use CSS variable: inter({ variable: '--font-inter' }).
- Never import Google Fonts via <link> tag in Next.js — always use next/font.`,
    },

    // ─── React 19 ──────────────────────────────────────────────────────────────
    {
        id: 'react19-hooks',
        source: 'React 19 — Hooks Reference',
        keywords: ['react', 'hooks', 'usestate', 'useeffect', 'usecallback', 'usememo', 'useref', 'usecontext'],
        content: `React 19 Hooks — Key Rules:
- Only call Hooks at the top level. Never inside loops, conditions, or nested functions.
- useState: local UI state. useReducer: complex state logic with multiple sub-values.
- useEffect cleanup: return a function to avoid memory leaks (clear timers, abort fetches).
- useCallback: memoize a callback to prevent child re-renders. Wrap with dependency array.
- useMemo: memoize an expensive computation. Don't overuse — has its own overhead.
- useRef: mutable container that does NOT cause re-render. Use for DOM refs and timers.
- React 19 NEW: use() hook reads a Promise or Context directly. Replaces useContext in many cases.
- React 19 NEW: Server Actions with useTransition / useFormStatus for form state.
- Key prop must be stable and unique — never use array index as key when list order can change.`,
    },

    // ─── TypeScript ────────────────────────────────────────────────────────────
    {
        id: 'typescript-best-practices',
        source: 'TypeScript 5.x — Best Practices',
        keywords: ['typescript', 'types', 'interface', 'type', 'generic', 'enum', 'as const', 'satisfies'],
        content: `TypeScript Best Practices:
- Prefer interface for object shapes (extensible); type alias for unions, intersections, primitives.
- Avoid "any" — use "unknown" for truly unknown types and narrow with type guards.
- Use "as const" for literal type inference: const STATUS = { OK: 200 } as const;
- "satisfies" operator (TS 4.9+): validates a value against a type without widening.
- Generic constraints: <T extends Record<string, unknown>> instead of <T extends object>.
- Discriminated unions: { type: 'a'; data: AData } | { type: 'b'; data: BData }
- Avoid enum — use const object + typeof lookup: const Dir = { Left:'left', Right:'right' } as const; type Dir = (typeof Dir)[keyof typeof Dir];
- strictNullChecks: always enable. Optional chaining ?. and nullish coalescing ?? are your friends.
- Utility types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, Record<K, V>, ReturnType<F>.`,
    },

    // ─── Vercel AI SDK ─────────────────────────────────────────────────────────
    {
        id: 'vercel-ai-sdk',
        source: 'Vercel AI SDK 4.x Docs',
        keywords: ['ai sdk', 'vercel', 'generatetext', 'streamtext', 'usecompletion', 'usechat', 'tools', 'groq'],
        content: `Vercel AI SDK 4.x Key APIs:
- generateText(): server-side, returns { text, usage, finishReason }.
- streamText(): server-side streaming, returns a ReadableStream. Use .toDataStreamResponse() for SSE.
- useChat(): client hook for chat UIs. Props: api, messages, input, handleSubmit, isLoading.
- useCompletion(): client hook for single-turn completion.
- Tools: pass tools object to generateText/streamText. Each tool: { description, parameters: z.object({...}), execute: async (args) => result }
- Model providers: createGroq(), createOpenAI(), createAnthropic(). Pass apiKey.
- maxOutputTokens (not maxTokens) controls response length in AI SDK 4+.
- Multi-step tool calls: maxSteps option on generateText — agent will call tools until done.
- CoreMessage format: { role: 'user'|'assistant'|'system', content: string | ContentPart[] }`,
    },

    // ─── Tailwind CSS 4 ────────────────────────────────────────────────────────
    {
        id: 'tailwind-v4',
        source: 'Tailwind CSS v4 — Migration Guide',
        keywords: ['tailwind', 'css', 'tailwindcss', 'styling', 'classname'],
        content: `Tailwind CSS v4 Key Changes:
- Config is now in CSS, not tailwind.config.js. Use @import "tailwindcss" in your CSS entry.
- @theme directive: @theme { --color-brand: #6366f1; } — replaces theme.extend in config.
- Arbitrary values still work: w-[42px], bg-[#1a1a2e].
- No more purge config — v4 uses CSS module analysis automatically.
- New: @layer utilities { .my-util { ... } } for custom utilities.
- Removed: JIT mode (now always jit), require('tailwindcss/colors') — import from CSS instead.
- Dark mode: still class or media strategy, configured via @variant dark { ... } in CSS.`,
    },

    // ─── Node.js / Express ────────────────────────────────────────────────────
    {
        id: 'nodejs-best-practices',
        source: 'Node.js — Production Best Practices',
        keywords: ['node', 'nodejs', 'express', 'api', 'middleware', 'error handling', 'env'],
        content: `Node.js Production Best Practices:
- Always handle unhandled rejections: process.on('unhandledRejection', (err) => { ... })
- Environment config: use dotenv. Never commit .env. Validate with zod or env-var.
- Error middleware in Express: 4-arg function (err, req, res, next) must come last.
- Async route handlers: wrap in try/catch or use express-async-errors.
- Rate limiting: express-rate-limit on public routes. Set trust proxy if behind nginx.
- Input validation: zod.parse() before using request body.
- CORS: configure cors() with explicit origin allowlist, not wildcard "*" in production.
- Graceful shutdown: listen for SIGTERM, stop accepting connections, finish in-flight requests.
- Use crypto.randomUUID() for IDs (Node 14.17+). Never Math.random() for security purposes.`,
    },

    // ─── PostgreSQL / Prisma ──────────────────────────────────────────────────
    {
        id: 'prisma-patterns',
        source: 'Prisma ORM — Common Patterns',
        keywords: ['prisma', 'database', 'postgresql', 'sql', 'orm', 'schema', 'migration'],
        content: `Prisma ORM Best Practices:
- singleton pattern for PrismaClient in Next.js to avoid "too many connections" in dev:
  const globalForPrisma = global as typeof global & { prisma?: PrismaClient };
  export const db = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
- Use select/include to avoid over-fetching. Never fetch entire relations when you need 1 field.
- Transactions: await db.$transaction([op1, op2]) or the interactive callback form.
- For pagination: use cursor-based (faster) not offset for large tables.
  { take: 20, skip: 1, cursor: { id: lastId } }
- Soft delete: add a deletedAt DateTime? field; filter with where: { deletedAt: null }.
- schema.prisma: always set referentialIntegrity = "prisma" for PlanetScale.`,
    },
];
