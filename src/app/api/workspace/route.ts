// ============================================================
// POST /api/workspace — Save generated files to disk
// GET  /api/workspace — List files in the workspace
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Workspace directory where generated projects are saved
const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

/**
 * POST — Save generated files to a project workspace
 * Body: { projectName: string, files: { path: string, content: string }[] }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectName, files } = body as {
            projectName: string;
            files: { path: string; content: string }[];
        };

        if (!projectName || !files || files.length === 0) {
            return NextResponse.json(
                { error: 'projectName and files[] are required' },
                { status: 400 }
            );
        }

        // Sanitize project name
        const safeName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);

        const projectDir = path.join(WORKSPACE_ROOT, safeName);

        // Create project directory
        await fs.mkdir(projectDir, { recursive: true });

        const savedFiles: string[] = [];

        // Save each file
        for (const file of files) {
            // Prevent path traversal attacks
            const normalizedPath = path.normalize(file.path).replace(/^(\.\.[/\\])+/, '');
            const filePath = path.join(projectDir, normalizedPath);

            // Ensure the file is within the project directory
            if (!filePath.startsWith(projectDir)) {
                continue; // Skip files that try to escape the project dir
            }

            // Create subdirectories as needed
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });

            // Write the file
            await fs.writeFile(filePath, file.content, 'utf-8');
            savedFiles.push(normalizedPath);
        }

        return NextResponse.json({
            success: true,
            projectName: safeName,
            projectPath: projectDir,
            filesCreated: savedFiles.length,
            files: savedFiles,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save files' },
            { status: 500 }
        );
    }
}

/**
 * GET — List all projects and their files in the workspace
 */
export async function GET() {
    try {
        // Create workspace directory if it doesn't exist
        await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

        const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
        const projects: {
            name: string;
            path: string;
            files: string[];
            createdAt: string;
        }[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const projectPath = path.join(WORKSPACE_ROOT, entry.name);
                const files = await getFilesRecursive(projectPath, projectPath);
                const stat = await fs.stat(projectPath);

                projects.push({
                    name: entry.name,
                    path: projectPath,
                    files,
                    createdAt: stat.birthtime.toISOString(),
                });
            }
        }

        return NextResponse.json({
            workspacePath: WORKSPACE_ROOT,
            projects,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list workspace' },
            { status: 500 }
        );
    }
}

/**
 * Recursively get all files in a directory
 */
async function getFilesRecursive(dir: string, rootDir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const subFiles = await getFilesRecursive(fullPath, rootDir);
            files.push(...subFiles);
        } else {
            files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
        }
    }

    return files;
}
