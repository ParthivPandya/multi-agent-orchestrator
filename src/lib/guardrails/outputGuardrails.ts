// ============================================================
// Guardrails — Output Scanning (Post-Agent)
// Scans agent outputs for leaked secrets, dangerous code patterns,
// and runaway output before passing downstream.
// ============================================================

export interface OutputScanResult {
  safe: boolean;
  warnings: string[];
  detectedIssues: {
    type: 'secret_leak' | 'dangerous_code' | 'runaway_output' | 'hardcoded_credential';
    pattern: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    location?: string;
  }[];
}

// ─── Secret Leak Patterns ────────────────────────────────────

const SECRET_PATTERNS: { name: string; regex: RegExp; severity: 'critical' | 'high' }[] = [
  { name: 'AWS Access Key', regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g, severity: 'critical' },
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{20,}/g, severity: 'critical' },
  { name: 'Groq API Key', regex: /gsk_[a-zA-Z0-9]{20,}/g, severity: 'critical' },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/g, severity: 'critical' },
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g, severity: 'critical' },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, severity: 'critical' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'high' },
  { name: 'Generic Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: 'high' },
  { name: 'Connection String', regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, severity: 'critical' },
];

// ─── Dangerous Code Patterns ─────────────────────────────────

const DANGEROUS_CODE_PATTERNS: { name: string; regex: RegExp; severity: 'high' | 'medium' }[] = [
  { name: 'eval() usage', regex: /\beval\s*\(/g, severity: 'high' },
  { name: 'exec() usage', regex: /\bexec\s*\(/g, severity: 'medium' },
  { name: 'rm -rf', regex: /rm\s+-rf?\s+\//g, severity: 'high' },
  { name: 'Shell injection', regex: /child_process|subprocess\.(?:call|run|Popen)|os\.system/g, severity: 'medium' },
  { name: 'innerHTML assignment', regex: /\.innerHTML\s*=/g, severity: 'medium' },
  { name: 'document.write', regex: /document\.write\s*\(/g, severity: 'medium' },
  { name: 'Disable SSL verification', regex: /(?:VERIFY_NONE|verify\s*=\s*False|rejectUnauthorized\s*:\s*false)/g, severity: 'high' },
  { name: 'Hardcoded secret in code', regex: /(?:const|let|var)\s+(?:secret|password|apiKey|api_key|token)\s*=\s*['"][^'"]{8,}['"]/gi, severity: 'high' },
];

// ─── Hardcoded Credential Patterns ───────────────────────────

const HARDCODED_CREDS: { name: string; regex: RegExp }[] = [
  { name: 'Hardcoded IP:Port', regex: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d{4,5}/g },
  { name: 'Hardcoded admin credentials', regex: /(?:admin|root|user)\s*[:=]\s*['"](?:admin|root|password|12345)/gi },
];

// ─── Output Length Limits ────────────────────────────────────

const MAX_OUTPUT_LENGTH = 100_000; // ~100KB — prevents runaway generation

// ─── Main Scanner ────────────────────────────────────────────

/**
 * Scans agent output for leaked secrets, dangerous code, and runaway output.
 */
export function scanOutput(agentName: string, output: string): OutputScanResult {
  const warnings: string[] = [];
  const detectedIssues: OutputScanResult['detectedIssues'] = [];

  // 1. Length check — runaway output
  if (output.length > MAX_OUTPUT_LENGTH) {
    detectedIssues.push({
      type: 'runaway_output',
      pattern: 'output_too_long',
      severity: 'medium',
      location: `${agentName} output (${Math.round(output.length / 1024)}KB)`,
    });
    warnings.push(`⚠️ ${agentName} output exceeds ${MAX_OUTPUT_LENGTH / 1000}KB limit`);
  }

  // 2. Secret leak scan
  for (const pattern of SECRET_PATTERNS) {
    const matches = output.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        // Ignore if it's clearly a placeholder/example
        if (isPlaceholder(match)) continue;

        detectedIssues.push({
          type: 'secret_leak',
          pattern: pattern.name,
          severity: pattern.severity,
          location: `${agentName} output`,
        });
        warnings.push(`🔐 ${pattern.severity.toUpperCase()}: Possible ${pattern.name} leaked in ${agentName} output`);
      }
    }
  }

  // 3. Dangerous code scan
  for (const pattern of DANGEROUS_CODE_PATTERNS) {
    const matches = output.match(pattern.regex);
    if (matches) {
      detectedIssues.push({
        type: 'dangerous_code',
        pattern: pattern.name,
        severity: pattern.severity,
        location: `${agentName} output`,
      });
      warnings.push(`⚠️ ${pattern.name} detected in ${agentName} output`);
    }
  }

  // 4. Hardcoded credentials
  for (const pattern of HARDCODED_CREDS) {
    const matches = output.match(pattern.regex);
    if (matches) {
      detectedIssues.push({
        type: 'hardcoded_credential',
        pattern: pattern.name,
        severity: 'medium',
        location: `${agentName} output`,
      });
      warnings.push(`🔑 ${pattern.name} found in ${agentName} output`);
    }
  }

  const criticalCount = detectedIssues.filter(i => i.severity === 'critical').length;

  return {
    safe: criticalCount === 0,
    warnings: [...new Set(warnings)],
    detectedIssues,
  };
}

/**
 * Check if a matched string is clearly a placeholder/example.
 */
function isPlaceholder(value: string): boolean {
  const placeholders = [
    'sk-your', 'sk-...', 'gsk_your', 'gsk_placeholder', 'ghp_your',
    'your_api_key', 'your-api-key', 'example', 'placeholder',
    'xxx', 'test', 'demo', 'sample',
  ];
  const lower = value.toLowerCase();
  return placeholders.some(p => lower.includes(p));
}
