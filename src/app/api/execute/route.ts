// ============================================================
// POST /api/execute — Sandboxed Code Execution API
// Competitor Feature: OpenDevin-style live code runner
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { executeCode, detectCodeLanguage, CodeExecutionRequest } from '@/lib/tools/codeRunner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language, filePath, stdin } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const detectedLanguage = language || detectCodeLanguage(code, filePath);
    const validLanguages = ['javascript', 'typescript', 'python', 'bash'];
    if (!validLanguages.includes(detectedLanguage)) {
      return NextResponse.json({ error: `Unsupported language: ${detectedLanguage}` }, { status: 400 });
    }

    const execRequest: CodeExecutionRequest = {
      code,
      language: detectedLanguage,
      stdin,
    };

    const result = executeCode(execRequest);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    }, { status: 500 });
  }
}
