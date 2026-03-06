// ============================================================
// File Parser — Extract code files from Developer Agent output
// Parses markdown code blocks with file paths into actual files
// ============================================================

export interface ParsedFile {
    path: string;
    content: string;
    language: string;
}

/**
 * Extracts file paths and their code content from the developer agent's
 * markdown-formatted output.
 * 
 * Supports formats like:
 *   ### File: `path/to/file.ts`
 *   ```typescript
 *   // code here
 *   ```
 * 
 * Also supports:
 *   **File: path/to/file.ts**
 *   // File: path/to/file.ts
 */
export function parseGeneratedFiles(output: string): ParsedFile[] {
    const files: ParsedFile[] = [];
    const lines = output.split('\n');

    let currentFilePath: string | null = null;
    let currentLang = '';
    let currentContent: string[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect file path headers
        // Pattern 1: ### File: `path/to/file.ext`
        // Pattern 2: **File: path/to/file.ext**
        // Pattern 3: ## File: path/to/file.ext
        // Pattern 4: // File: path/to/file.ext
        // Pattern 5: File: `path/to/file.ext`
        const fileMatch = trimmed.match(
            /(?:#{1,4}\s+)?(?:\*\*)?(?:File:\s*|Filename:\s*)(?:`)?([^\s`*]+\.[a-zA-Z0-9]+)(?:`)?(?:\*\*)?/i
        );

        if (fileMatch && !inCodeBlock) {
            currentFilePath = fileMatch[1].replace(/^[`'"]+|[`'"]+$/g, '').trim();
            continue;
        }

        // Detect code block start
        if (trimmed.startsWith('```') && !inCodeBlock) {
            inCodeBlock = true;
            currentLang = trimmed.replace('```', '').trim().toLowerCase();
            currentContent = [];

            // If we don't have a file path yet, try to infer from language
            if (!currentFilePath && currentLang) {
                // Look back a few lines for a file path we might have missed
                for (let j = Math.max(0, i - 3); j < i; j++) {
                    const prevLine = lines[j].trim();
                    const prevMatch = prevLine.match(/([a-zA-Z0-9_\-/.]+\.[a-zA-Z0-9]+)/);
                    if (prevMatch && prevMatch[1].includes('.')) {
                        currentFilePath = prevMatch[1];
                        break;
                    }
                }
            }
            continue;
        }

        // Detect code block end
        if (trimmed === '```' && inCodeBlock) {
            inCodeBlock = false;

            if (currentFilePath && currentContent.length > 0) {
                // Clean the path (remove leading slashes, etc.)
                const cleanPath = currentFilePath
                    .replace(/^[./\\]+/, '')
                    .replace(/\\/g, '/');

                files.push({
                    path: cleanPath,
                    content: currentContent.join('\n'),
                    language: currentLang || inferLanguage(cleanPath),
                });
            }

            currentFilePath = null;
            currentContent = [];
            currentLang = '';
            continue;
        }

        // Accumulate code content
        if (inCodeBlock) {
            currentContent.push(line);
        }
    }

    return files;
}

/**
 * Infer programming language from file extension
 */
function inferLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        rb: 'ruby',
        go: 'go',
        rs: 'rust',
        java: 'java',
        cs: 'csharp',
        cpp: 'cpp',
        c: 'c',
        html: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        xml: 'xml',
        md: 'markdown',
        sql: 'sql',
        sh: 'bash',
        bash: 'bash',
        dockerfile: 'dockerfile',
        env: 'bash',
    };
    return langMap[ext] || ext;
}

/**
 * Generate a simple file tree string visualization
 */
export function generateFileTree(files: ParsedFile[]): string {
    if (files.length === 0) return 'No files generated.';

    const paths = files.map(f => f.path).sort();
    const tree: string[] = [];

    for (const path of paths) {
        const parts = path.split('/');
        const depth = parts.length - 1;
        const fileName = parts[parts.length - 1];
        const prefix = depth > 0 ? '│   '.repeat(depth - 1) + '├── ' : '';
        tree.push(`${prefix}${fileName}`);
    }

    return tree.join('\n');
}
