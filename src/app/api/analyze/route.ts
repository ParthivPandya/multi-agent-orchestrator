// ============================================================
// API Route — /api/analyze
// Runs Technical Debt Scanner + Compliance Agent on demand.
// Accepts: generated code, language, compliance frameworks.
// Returns: combined analysis report.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runTechnicalDebtScanner } from '@/lib/agents/debtScanner';
import { runComplianceAgent, ComplianceFramework } from '@/lib/agents/complianceAgent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      code: string;
      language?: string;
      runDebt?: boolean;
      runCompliance?: boolean;
      complianceFrameworks?: ComplianceFramework[];
      industry?: string;
      groqApiKey?: string;
    };

    const {
      code,
      language,
      runDebt = true,
      runCompliance = false,
      complianceFrameworks = ['OWASP_TOP10', 'GDPR', 'SOC2'],
      industry,
      groqApiKey,
    } = body;

    if (!code || code.trim().length < 50) {
      return NextResponse.json(
        { error: 'Code is required and must be at least 50 characters.' },
        { status: 400 }
      );
    }

    const apiKey = groqApiKey || process.env.GROQ_API_KEY || '';

    // Run debt scanner and compliance agent in parallel
    const [debtResult, complianceResult] = await Promise.allSettled([
      runDebt ? runTechnicalDebtScanner(code, language, apiKey) : Promise.resolve(null),
      runCompliance ? runComplianceAgent(code, complianceFrameworks, industry, apiKey) : Promise.resolve(null),
    ]);

    const debt = debtResult.status === 'fulfilled' ? debtResult.value : null;
    const compliance = complianceResult.status === 'fulfilled' ? complianceResult.value : null;

    return NextResponse.json({
      success: true,
      debtScan: debt ? {
        status: debt.status,
        report: (debt as { debtReport?: object }).debtReport,
        tokensUsed: debt.tokensUsed,
        latencyMs: debt.latencyMs,
      } : null,
      complianceScan: compliance ? {
        status: compliance.status,
        report: (compliance as { complianceReport?: object }).complianceReport,
        tokensUsed: compliance.tokensUsed,
        latencyMs: compliance.latencyMs,
      } : null,
    });
  } catch (err) {
    console.error('[analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
