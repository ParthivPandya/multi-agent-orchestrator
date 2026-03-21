// ============================================================
// Feature 4 — Compliance Agent
// Checks generated code against GDPR, HIPAA, PCI-DSS, SOC 2,
// OWASP Top 10 (2024), and DPDP Act. Outputs a compliance
// report with violation list and remediation patches.
// Pain Point: #3 — AI Code Security and Compliance Gaps
// ============================================================

import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { AgentResult } from '@/lib/types';

export type ComplianceFramework =
  | 'OWASP_TOP10'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI_DSS'
  | 'SOC2'
  | 'DPDP';

export type ComplianceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ComplianceViolation {
  framework: ComplianceFramework;
  rule: string;             // e.g. "OWASP A01:2021 - Broken Access Control"
  severity: ComplianceSeverity;
  description: string;
  evidence?: string;        // code snippet showing the issue
  remediation: string;      // specific fix instruction
  automatable: boolean;     // can this be auto-patched?
}

export interface FrameworkResult {
  framework: ComplianceFramework;
  passed: boolean;
  score: number;            // 0–100
  violations: ComplianceViolation[];
  passedChecks: string[];
}

export interface ComplianceReport {
  overallScore: number;       // 0–100
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  frameworks: FrameworkResult[];
  criticalViolations: ComplianceViolation[];
  blockedByCompliance: boolean;  // true if critical violations exist
  summary: string;
  remediationPriority: ComplianceViolation[];  // sorted by severity
  estimatedComplianceHours: number;
}

const COMPLIANCE_SYSTEM_PROMPT = `You are a compliance and regulatory expert specializing in software security audits.
Your job is to analyze code for violations of regulatory frameworks and provide actionable remediation guidance.

FRAMEWORKS TO CHECK:
1. **OWASP Top 10 (2024)**: A01-Broken Access Control, A02-Cryptographic Failures, A03-Injection, A04-Insecure Design, A05-Security Misconfiguration, A06-Vulnerable Components, A07-Auth Failures, A08-Integrity Failures, A09-Logging Failures, A10-SSRF
2. **GDPR**: Data minimization, consent handling, right to erasure, data breach notification, cross-border transfer safeguards, DPO processes
3. **HIPAA**: PHI encryption at rest and in transit, access controls, audit logs, minimum necessary standard, BAA requirements
4. **PCI-DSS**: Cardholder data protection, network segmentation, encryption, key management, vulnerability scanning
5. **SOC 2 Type II**: Security (CC6), Availability (A1), Confidentiality (C1), Processing Integrity (PI1), Privacy (P1–P8)
6. **DPDP Act (India)**: Data fiduciary obligations, consent requirements, data principal rights, significant data fiduciary requirements

SCORING:
- overallScore: 0–100 (weighted across frameworks)
- framework score: 0–100 per framework
- overallStatus: FAIL if any critical violations, WARNING if high violations only, PASS if medium/low only

OUTPUT — respond ONLY with valid JSON:
{
  "overallScore": <0-100>,
  "overallStatus": "<PASS|FAIL|WARNING>",
  "blockedByCompliance": <true if any critical violations>,
  "summary": "<executive summary 2-3 sentences>",
  "estimatedComplianceHours": <number of hours to remediate>,
  "frameworks": [
    {
      "framework": "<OWASP_TOP10|GDPR|HIPAA|PCI_DSS|SOC2|DPDP>",
      "passed": <boolean>,
      "score": <0-100>,
      "passedChecks": ["<check name>", ...],
      "violations": [
        {
          "framework": "<same>",
          "rule": "<specific rule violated>",
          "severity": "<critical|high|medium|low|info>",
          "description": "<what is wrong>",
          "evidence": "<relevant code snippet if visible>",
          "remediation": "<specific actionable fix>",
          "automatable": <boolean>
        }
      ]
    }
  ],
  "remediationPriority": [<top 5 violations sorted critical-first>]
}`;

export async function runComplianceAgent(
  generatedCode: string,
  frameworks: ComplianceFramework[] = ['OWASP_TOP10', 'GDPR', 'SOC2'],
  industry?: string,
  apiKey?: string
): Promise<AgentResult & { complianceReport?: ComplianceReport }> {
  const startMs = Date.now();
  const groq = createGroq({ apiKey: apiKey || process.env.GROQ_API_KEY || '' });

  const codeSnippet = generatedCode.slice(0, 10000);
  const frameworkList = frameworks.join(', ');

  // Industry-specific context
  const industryContext = industry
    ? `\nINDUSTRY CONTEXT: ${industry}. Pay extra attention to regulations applicable to this sector.\n`
    : '';

  try {
    const { text, usage } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: COMPLIANCE_SYSTEM_PROMPT,
      prompt: `Analyze for compliance violations against: ${frameworkList}.
${industryContext}
CODE TO ANALYZE:
\`\`\`
${codeSnippet}
\`\`\`

Focus on violations relevant to ${frameworkList}. Output valid JSON only.`,
      maxOutputTokens: 3500,
      temperature: 0.1,
    });

    let complianceReport: ComplianceReport | undefined;
    try {
      const cleaned = text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const jsonStart = cleaned.indexOf('{');
      const parsed = JSON.parse(cleaned.slice(jsonStart));

      const allViolations: ComplianceViolation[] = (parsed.frameworks || [])
        .flatMap((f: FrameworkResult) => f.violations || []);

      complianceReport = {
        overallScore: Number(parsed.overallScore) || 50,
        overallStatus: parsed.overallStatus || 'WARNING',
        blockedByCompliance: parsed.blockedByCompliance || false,
        summary: parsed.summary || 'Compliance analysis complete.',
        frameworks: parsed.frameworks || [],
        criticalViolations: allViolations.filter(v => v.severity === 'critical'),
        remediationPriority: (parsed.remediationPriority || allViolations).slice(0, 5),
        estimatedComplianceHours: Number(parsed.estimatedComplianceHours) || 0,
      };
    } catch {
      complianceReport = {
        overallScore: 50,
        overallStatus: 'WARNING',
        blockedByCompliance: false,
        summary: text.slice(0, 500),
        frameworks: [],
        criticalViolations: [],
        remediationPriority: [],
        estimatedComplianceHours: 0,
      };
    }

    return {
      agentName: 'compliance-agent' as AgentResult['agentName'],
      status: complianceReport.blockedByCompliance ? 'error' : 'complete',
      output: JSON.stringify(complianceReport, null, 2),
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      tokensUsed: usage?.totalTokens,
      latencyMs: Date.now() - startMs,
      complianceReport,
    };
  } catch (err) {
    return {
      agentName: 'compliance-agent' as AgentResult['agentName'],
      status: 'error',
      output: '',
      timestamp: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
      latencyMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
