// ============================================================
// Session Memory — Multi-Turn Conversation Context
// Competitor Feature: AWS Agent Squad / LangGraph-style
// Sessions scoped by userId + sessionId with full turn history.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), '.workspace', 'sessions');

export interface ConversationTurn {
  turnId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentResults?: Record<string, unknown>;
  metadata?: {
    pipelineMode?: string;
    tokensUsed?: number;
    latencyMs?: number;
    detectedLanguage?: string;
  };
}

export interface Session {
  sessionId: string;
  userId: string;
  title: string;
  turns: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
  context: SessionContext;
}

export interface SessionContext {
  // Accumulated preferences from the session
  preferredLanguage?: string;
  preferredFramework?: string;
  preferredDatabase?: string;
  codeContext?: string;        // Summary of code generated so far
  requirements?: string;       // Latest requirements
  techStack?: string[];
  previousOutputSummaries: string[];
}

// ─── File system helpers ─────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(sessionId: string): string {
  const safeName = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(SESSIONS_DIR, `${safeName}.json`);
}

// ─── Session CRUD ────────────────────────────────────────────

export function createSession(userId: string, title?: string): Session {
  ensureDir();
  const session: Session = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title: title || `Session ${new Date().toLocaleDateString()}`,
    turns: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    context: {
      previousOutputSummaries: [],
    },
  };
  fs.writeFileSync(sessionPath(session.sessionId), JSON.stringify(session, null, 2));
  return session;
}

export function loadSession(sessionId: string): Session | null {
  const filePath = sessionPath(sessionId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  ensureDir();
  session.updatedAt = Date.now();
  fs.writeFileSync(sessionPath(session.sessionId), JSON.stringify(session, null, 2));
}

export function listSessions(userId?: string): Session[] {
  ensureDir();
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const sessions: Session[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8'));
      if (!userId || data.userId === userId) sessions.push(data);
    } catch { /* skip corrupted files */ }
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteSession(sessionId: string): boolean {
  const filePath = sessionPath(sessionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// ─── Turn Management ─────────────────────────────────────────

export function addTurn(
  session: Session,
  role: 'user' | 'assistant',
  content: string,
  agentResults?: Record<string, unknown>,
  metadata?: ConversationTurn['metadata']
): ConversationTurn {
  const turn: ConversationTurn = {
    turnId: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: Date.now(),
    agentResults,
    metadata,
  };
  session.turns.push(turn);
  saveSession(session);
  return turn;
}

// ─── Context Building ────────────────────────────────────────

/**
 * Builds a context string from session history that can be prepended
 * to agent system prompts for multi-turn awareness.
 */
export function buildSessionContext(session: Session, maxTurns = 5): string {
  if (session.turns.length === 0) return '';

  const recentTurns = session.turns.slice(-maxTurns);
  const lines: string[] = [
    `\n\n--- CONVERSATION CONTEXT (Session: ${session.sessionId}, ${session.turns.length} total turns) ---`,
  ];

  // Add accumulated context
  if (session.context.preferredLanguage) {
    lines.push(`User prefers: ${session.context.preferredLanguage}`);
  }
  if (session.context.preferredFramework) {
    lines.push(`Framework: ${session.context.preferredFramework}`);
  }
  if (session.context.techStack?.length) {
    lines.push(`Tech stack: ${session.context.techStack.join(', ')}`);
  }
  if (session.context.codeContext) {
    lines.push(`\nPrevious code context:\n${session.context.codeContext}`);
  }

  lines.push('\nRecent conversation:');
  for (const turn of recentTurns) {
    const role = turn.role === 'user' ? 'USER' : 'ASSISTANT';
    const summary = turn.content.length > 300
      ? turn.content.slice(0, 300) + '...'
      : turn.content;
    lines.push(`[${role}] ${summary}`);
  }

  lines.push('--- Use this context to maintain continuity. Build on previous work. ---');
  return lines.join('\n');
}

/**
 * Updates the session context with information extracted from agent outputs.
 */
export function updateSessionContext(
  session: Session,
  analystOutput?: string,
  codeOutput?: string,
  detectedLanguage?: string
): void {
  if (detectedLanguage) {
    session.context.preferredLanguage = detectedLanguage;
  }

  if (analystOutput) {
    // Extract tech stack from analyst output
    const techMatch = analystOutput.match(/"tech_stack"\s*:\s*\[([\s\S]*?)\]/);
    if (techMatch) {
      try {
        session.context.techStack = JSON.parse(`[${techMatch[1]}]`);
      } catch { /* ignore parse errors */ }
    }

    // Extract framework
    const fwMatch = analystOutput.match(/"framework"\s*:\s*"([^"]+)"/i);
    if (fwMatch) session.context.preferredFramework = fwMatch[1];

    session.context.requirements = analystOutput.slice(0, 500);
  }

  if (codeOutput) {
    // Summarize code context (file paths only for brevity)
    const fileMatches = codeOutput.match(/### File: `([^`]+)`/g);
    if (fileMatches) {
      session.context.codeContext = `Generated files:\n${fileMatches.map(m => m.replace('### File: ', '  - ')).join('\n')}`;
    }

    session.context.previousOutputSummaries.push(
      `[Turn ${session.turns.length}] Generated ${fileMatches?.length || 0} files`
    );
    // Keep only last 10 summaries
    if (session.context.previousOutputSummaries.length > 10) {
      session.context.previousOutputSummaries = session.context.previousOutputSummaries.slice(-10);
    }
  }

  saveSession(session);
}
