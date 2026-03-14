// ============================================================
// Agentic Tools — Read Workspace File (Enhancement 2)
// Safe file-reading restricted to the workspace directory
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

/**
 * Safely reads a file from the workspace directory.
 * Path traversal attacks are blocked by resolving against WORKSPACE_ROOT.
 */
export async function readWorkspaceFile(filePath: string): Promise<string> {
    try {
        const resolved = path.resolve(WORKSPACE_ROOT, filePath);

        // Security: ensure the resolved path stays within workspace
        if (!resolved.startsWith(WORKSPACE_ROOT)) {
            throw new Error('Path traversal attempt blocked');
        }

        const content = await fs.readFile(resolved, 'utf-8');
        // Cap at 4000 chars to avoid blowing up LLM context
        return content.length > 4000 ? content.substring(0, 4000) + '\n... [truncated]' : content;
    } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

/**
 * Lists files in a workspace directory (non-recursive, safe)
 */
export async function listWorkspaceFiles(dirPath = '.'): Promise<string[]> {
    try {
        const resolved = path.resolve(WORKSPACE_ROOT, dirPath);
        if (!resolved.startsWith(WORKSPACE_ROOT)) {
            throw new Error('Path traversal attempt blocked');
        }
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
    } catch {
        return [];
    }
}
