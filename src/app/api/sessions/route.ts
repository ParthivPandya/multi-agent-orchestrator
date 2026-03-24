// ============================================================
// GET/POST /api/sessions — Session Memory REST API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  loadSession,
  listSessions,
  deleteSession,
  addTurn,
} from '@/lib/sessions';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');
  const userId = searchParams.get('userId') || 'default';

  if (sessionId) {
    const session = loadSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  }

  const sessions = listSessions(userId);
  return NextResponse.json({
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      turnCount: s.turns.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, sessionId, userId, title, role, content, agentResults, metadata } = body;

  switch (action) {
    case 'create': {
      const session = createSession(userId || 'default', title);
      return NextResponse.json({ session: { sessionId: session.sessionId, title: session.title } });
    }

    case 'addTurn': {
      if (!sessionId || !role || !content) {
        return NextResponse.json({ error: 'sessionId, role, content required' }, { status: 400 });
      }
      const session = loadSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const turn = addTurn(session, role, content, agentResults, metadata);
      return NextResponse.json({ turn });
    }

    case 'delete': {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      }
      const success = deleteSession(sessionId);
      return NextResponse.json({ success });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
