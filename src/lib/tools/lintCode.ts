// ============================================================
// Agentic Tools — Static Code Linter (Enhancement 2)
// Rule-based linting without exec'ing any external process
// Checks for common anti-patterns that an LLM might produce
// ============================================================

export interface LintIssue {
    line?: number;
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
}

export interface LintResult {
    issues: LintIssue[];
    score: number; // 0–100
    summary: string;
}

// ------------------------------------------------------------------
// Rule Definitions
// ------------------------------------------------------------------

interface LintRule {
    id: string;
    severity: LintIssue['severity'];
    pattern: RegExp;
    message: string;
}

const RULES: LintRule[] = [
    // Security
    { id: 'no-eval', severity: 'error', pattern: /\beval\s*\(/, message: 'Avoid eval() — severe security risk' },
    { id: 'no-inner-html', severity: 'warning', pattern: /\.innerHTML\s*=/, message: 'innerHTML assignment risks XSS — use textContent or DOMPurify' },
    { id: 'no-dangerously-html', severity: 'warning', pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML can expose XSS — sanitize input first' },
    { id: 'no-hardcoded-secret', severity: 'error', pattern: /(?:api_?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}/i, message: 'Hardcoded secret detected — use environment variables' },

    // Code quality
    { id: 'no-console', severity: 'info', pattern: /console\.(log|warn|error|debug)\(/, message: 'Remove console.log before production — use a proper logger' },
    { id: 'no-todo', severity: 'info', pattern: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/i, message: 'Unaddressed TODO/FIXME comment found' },
    { id: 'no-any', severity: 'warning', pattern: /:\s*any\b/, message: 'TypeScript "any" type weakens type safety — use explicit types' },
    { id: 'no-var', severity: 'warning', pattern: /\bvar\s+/, message: 'Use const/let instead of var' },
    { id: 'no-unused-import', severity: 'info', pattern: /^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*$/m, message: 'Verify all imported symbols are used' },
    { id: 'prefer-async-await', severity: 'info', pattern: /\.then\(\s*function/, message: 'Prefer async/await over .then(function())' },
    { id: 'no-empty-catch', severity: 'warning', pattern: /catch\s*\([^)]*\)\s*\{\s*\}/, message: 'Empty catch block silently swallows errors' },

    // React / Next.js
    { id: 'next-no-img', severity: 'warning', pattern: /<img\s/, message: 'Use Next.js <Image> component instead of <img> for optimization' },
    { id: 'react-key-prop', severity: 'warning', pattern: /\.map\([^)]+\)\s*(?:=>)?\s*\(?\s*<(?!.*\bkey=)/, message: 'Mapped JSX elements should have a unique key prop' },
];

// ------------------------------------------------------------------
// Linter
// ------------------------------------------------------------------

export function lintCode(code: string, filename?: string): LintResult {
    const lines = code.split('\n');
    const issues: LintIssue[] = [];

    for (const rule of RULES) {
        lines.forEach((line, idx) => {
            if (rule.pattern.test(line)) {
                issues.push({
                    line: idx + 1,
                    severity: rule.severity,
                    rule: rule.id,
                    message: rule.message,
                });
            }
        });
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    // Simple scoring: start at 100, deduct per issue
    const score = Math.max(0, 100 - errors * 20 - warnings * 5 - (issues.length - errors - warnings) * 1);

    const summary = issues.length === 0
        ? `✅ No issues found${filename ? ` in ${filename}` : ''}. Code quality score: ${score}/100`
        : `Found ${errors} error(s), ${warnings} warning(s), ${issues.length - errors - warnings} info(s) in ${filename || 'code'}. Score: ${score}/100`;

    return { issues, score, summary };
}

export function formatLintResult(result: LintResult): string {
    if (result.issues.length === 0) return result.summary;

    const lines: string[] = [result.summary, ''];
    for (const issue of result.issues) {
        const lineRef = issue.line ? `L${issue.line}: ` : '';
        const prefix = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`${prefix} [${issue.rule}] ${lineRef}${issue.message}`);
    }
    return lines.join('\n');
}
