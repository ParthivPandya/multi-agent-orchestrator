// ============================================================
// GET /api/workspace/[project]/file?path=... — Read a file
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ project: string }> }
) {
    try {
        const { project } = await params;
        const filePath = request.nextUrl.searchParams.get('path');

        if (!filePath) {
            return NextResponse.json(
                { error: 'path query parameter is required' },
                { status: 400 }
            );
        }

        const fullPath = path.join(WORKSPACE_ROOT, project, path.normalize(filePath));

        // Ensure the file is within the project directory
        if (!fullPath.startsWith(path.join(WORKSPACE_ROOT, project))) {
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 403 }
            );
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        const ext = path.extname(fullPath).replace('.', '');

        return NextResponse.json({
            path: filePath,
            content,
            extension: ext,
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to read file' },
            { status: 500 }
        );
    }
}
