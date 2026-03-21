// ============================================================
// Gap #8 — Agent Memory: Cross-Session Learning
// Stores user preferences in localStorage for personalized runs.
// All data stays client-side — never sent to the server.
// ============================================================

const MEMORY_KEY = 'mao_user_preferences';
const MAX_PROJECT_HISTORY = 20;

export interface UserPreferences {
  preferredLanguage?: string;       // 'TypeScript' | 'Python' | 'Go' etc.
  preferredFramework?: string;      // 'Next.js' | 'FastAPI' | 'Express' etc.
  preferredDatabase?: string;       // 'PostgreSQL' | 'MongoDB' etc.
  preferredTestFramework?: string;  // 'Jest' | 'Pytest' | 'Vitest' etc.
  codingStyle?: string;             // 'functional' | 'OOP' | 'modular'
  namingConventions?: string;       // 'camelCase' | 'snake_case'
  runCount: number;
  lastRunAt?: number;
  projectHistory: Array<{
    requirement: string;
    techStack: string;
    runAt: number;
  }>;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function loadMemory(): UserPreferences {
  if (!isBrowser()) return { runCount: 0, projectHistory: [] };
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : { runCount: 0, projectHistory: [] };
  } catch {
    return { runCount: 0, projectHistory: [] };
  }
}

export function updateMemory(updates: Partial<UserPreferences>): void {
  if (!isBrowser()) return;
  const current = loadMemory();
  const updated: UserPreferences = {
    ...current,
    ...updates,
    runCount: (current.runCount ?? 0) + 1,
    lastRunAt: Date.now(),
    projectHistory: [
      ...(updates.projectHistory ?? []),
      ...(current.projectHistory ?? []),
    ].slice(0, MAX_PROJECT_HISTORY),
  };
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(updated));
  } catch { /* quota exceeded */ }
}

export function clearMemory(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch { /* ignore */ }
}

/**
 * Builds a memory context string to append to agent system prompts.
 * Returns empty string if no previous sessions exist.
 */
export function buildMemoryContext(prefs: UserPreferences): string {
  if (prefs.runCount === 0) return '';

  const lines: string[] = [
    `\n\n--- USER PREFERENCES (from ${prefs.runCount} previous session${prefs.runCount !== 1 ? 's' : ''}) ---`,
  ];

  if (prefs.preferredLanguage) lines.push(`Preferred Language: ${prefs.preferredLanguage}`);
  if (prefs.preferredFramework) lines.push(`Preferred Framework: ${prefs.preferredFramework}`);
  if (prefs.preferredDatabase) lines.push(`Preferred Database: ${prefs.preferredDatabase}`);
  if (prefs.preferredTestFramework) lines.push(`Preferred Testing Framework: ${prefs.preferredTestFramework}`);
  if (prefs.codingStyle) lines.push(`Coding Style: ${prefs.codingStyle}`);
  if (prefs.namingConventions) lines.push(`Naming Conventions: ${prefs.namingConventions}`);

  if (prefs.projectHistory.length > 0) {
    lines.push(`\nRecent Projects (for context):`);
    prefs.projectHistory.slice(0, 3).forEach(p => {
      lines.push(`  - ${p.requirement.slice(0, 80)} (Stack: ${p.techStack})`);
    });
  }

  lines.push('--- Apply these preferences unless the requirement explicitly states otherwise ---');
  return lines.join('\n');
}

/**
 * Extracts tech stack preferences from analyst output text for memory update.
 */
export function extractPreferencesFromAnalystOutput(
  analystOutput: string,
  requirement: string
): Partial<UserPreferences> {
  const techStackMatch = analystOutput.match(/"language"\s*:\s*"([^"]+)"/i);
  const frameworkMatch = analystOutput.match(/"framework"\s*:\s*"([^"]+)"/i);
  const databaseMatch = analystOutput.match(/"database"\s*:\s*"([^"]+)"/i);
  const testingMatch = analystOutput.match(/"testing"\s*:\s*"([^"]+)"/i);

  const techStack = [
    techStackMatch?.[1],
    frameworkMatch?.[1],
    databaseMatch?.[1],
  ].filter(Boolean).join(', ') || 'Not specified';

  return {
    preferredLanguage: techStackMatch?.[1],
    preferredFramework: frameworkMatch?.[1],
    preferredDatabase: databaseMatch?.[1],
    preferredTestFramework: testingMatch?.[1],
    projectHistory: [{
      requirement: requirement.slice(0, 120),
      techStack,
      runAt: Date.now(),
    }],
  };
}
