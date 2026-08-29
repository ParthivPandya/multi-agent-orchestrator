// ============================================================
// Guardrails — Input Scanning (Pre-Pipeline)
// Scans user requirements for PII, prompt injection, and toxicity
// before they reach any agent. Zero external dependencies.
// ============================================================

export interface InputScanResult {
  safe: boolean;
  warnings: string[];
  sanitized: string;
  detectedPatterns: {
    type: 'pii' | 'injection' | 'toxicity' | 'secret';
    pattern: string;
    match: string;
    action: 'warn' | 'redact' | 'block';
  }[];
}

// ─── PII Patterns ────────────────────────────────────────────

const PII_PATTERNS: { name: string; regex: RegExp; action: 'warn' | 'redact' }[] = [
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, action: 'redact' },
  { name: 'Credit Card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, action: 'redact' },
  { name: 'Email Address', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, action: 'warn' },
  { name: 'Phone Number', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, action: 'warn' },
  { name: 'IP Address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, action: 'warn' },
  { name: 'AWS Access Key', regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, action: 'redact' },
  { name: 'Generic API Key', regex: /\b(?:sk-|gsk_|ghp_|glpat-|xoxb-|xoxp-)[a-zA-Z0-9_-]{20,}\b/g, action: 'redact' },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, action: 'redact' },
];

// ─── Prompt Injection Patterns ───────────────────────────────

const INJECTION_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'Ignore instructions', regex: /\bignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)\b/gi },
  { name: 'System prompt override', regex: /\byou\s+are\s+now\b.*\b(?:different|new)\s+(?:ai|assistant|bot)\b/gi },
  { name: 'Jailbreak attempt', regex: /\b(?:DAN|do anything now|developer mode|jailbreak)\b/gi },
  { name: 'Role play attack', regex: /\bpretend\s+(?:you\s+are|to\s+be)\s+(?:a|an)\b/gi },
  { name: 'Instruction injection', regex: /\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>system/gi },
  { name: 'Prompt leak request', regex: /\b(?:show|reveal|print|output|repeat)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)\b/gi },
];

// ─── Toxicity Keywords (basic — not a replacement for a real classifier) ──

const TOXICITY_KEYWORDS: RegExp[] = [
  /\b(?:how\s+to\s+(?:hack|exploit|attack|breach|crack))\b/gi,
  /\b(?:create\s+(?:malware|virus|ransomware|trojan|worm|exploit))\b/gi,
  /\b(?:sql\s+injection\s+(?:attack|payload|exploit))\b/gi,
  /\b(?:generate\s+(?:phishing|scam|fraud))\b/gi,
];

// ─── Main Scanner ────────────────────────────────────────────

/**
 * Scans user input for PII, prompt injections, and harmful patterns.
 * Returns scan result with warnings and optionally redacted input.
 */
export function scanInput(input: string): InputScanResult {
  const warnings: string[] = [];
  const detectedPatterns: InputScanResult['detectedPatterns'] = [];
  let sanitized = input;

  // 1. PII Scan
  for (const pattern of PII_PATTERNS) {
    const matches = input.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        detectedPatterns.push({
          type: pattern.name.includes('Key') || pattern.name.includes('Private') ? 'secret' : 'pii',
          pattern: pattern.name,
          match: match.slice(0, 4) + '***',
          action: pattern.action,
        });
        warnings.push(`🔒 ${pattern.name} detected in input`);
        if (pattern.action === 'redact') {
          sanitized = sanitized.replace(match, `[REDACTED_${pattern.name.toUpperCase().replace(/\s+/g, '_')}]`);
        }
      }
    }
  }

  // 2. Prompt Injection Scan
  for (const pattern of INJECTION_PATTERNS) {
    const matches = input.match(pattern.regex);
    if (matches) {
      for (const match of matches) {
        detectedPatterns.push({
          type: 'injection',
          pattern: pattern.name,
          match: match.slice(0, 30),
          action: 'warn',
        });
        warnings.push(`⚠️ Possible prompt injection: ${pattern.name}`);
      }
    }
  }

  // 3. Toxicity Scan
  for (const pattern of TOXICITY_KEYWORDS) {
    const matches = input.match(pattern);
    if (matches) {
      for (const match of matches) {
        detectedPatterns.push({
          type: 'toxicity',
          pattern: 'harmful_content',
          match: match.slice(0, 30),
          action: 'warn',
        });
        warnings.push(`🚫 Potentially harmful content detected`);
      }
    }
  }

  return {
    safe: detectedPatterns.filter(p => p.action === 'block').length === 0,
    warnings: [...new Set(warnings)], // deduplicate
    sanitized,
    detectedPatterns,
  };
}
