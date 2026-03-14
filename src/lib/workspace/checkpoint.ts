// ============================================================
// Checkpoint — Stateful Pipeline Persistence (Enhancement 5)
// Saves/loads pipeline state as JSON to /.workspace/checkpoints/
// Enables "Resume on Failure" capability
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import { PipelineCheckpoint, AgentResult } from '@/lib/types';

const CHECKPOINTS_DIR = path.join(process.cwd(), '.workspace', 'checkpoints');

async function ensureDir(): Promise<void> {
    await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
}

function generateId(): string {
    // Timestamp + 4 random hex chars for human-readable IDs
    const ts = Date.now().toString(36);
    const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `${ts}-${rand}`;
}

// ------------------------------------------------------------------
// Save
// ------------------------------------------------------------------

export async function saveCheckpoint(
    requirement: string,
    completedStages: string[],
    results: Record<string, AgentResult>,
    isComplete: boolean,
    existingId?: string
): Promise<string> {
    await ensureDir();

    const id = existingId || generateId();
    const now = new Date().toISOString();

    const checkpoint: PipelineCheckpoint = {
        id,
        requirement,
        createdAt: existingId ? (await loadCheckpoint(id))?.createdAt ?? now : now,
        lastUpdatedAt: now,
        completedStages,
        results,
        isComplete,
    };

    const filePath = path.join(CHECKPOINTS_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    return id;
}

// ------------------------------------------------------------------
// Load
// ------------------------------------------------------------------

export async function loadCheckpoint(id: string): Promise<PipelineCheckpoint | null> {
    try {
        const filePath = path.join(CHECKPOINTS_DIR, `${id}.json`);
        // Validate ID to prevent path traversal
        const resolved = path.resolve(CHECKPOINTS_DIR, `${id}.json`);
        if (!resolved.startsWith(CHECKPOINTS_DIR)) return null;

        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw) as PipelineCheckpoint;
    } catch {
        return null;
    }
}

// ------------------------------------------------------------------
// List (for the history panel)
// ------------------------------------------------------------------

export async function listCheckpoints(): Promise<PipelineCheckpoint[]> {
    try {
        await ensureDir();
        const files = await fs.readdir(CHECKPOINTS_DIR);
        const checkpoints = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async f => {
                    try {
                        const raw = await fs.readFile(path.join(CHECKPOINTS_DIR, f), 'utf-8');
                        return JSON.parse(raw) as PipelineCheckpoint;
                    } catch {
                        return null;
                    }
                })
        );
        return checkpoints
            .filter(Boolean)
            .sort((a, b) => new Date(b!.lastUpdatedAt).getTime() - new Date(a!.lastUpdatedAt).getTime()) as PipelineCheckpoint[];
    } catch {
        return [];
    }
}

// ------------------------------------------------------------------
// Delete (cleanup after successful completion)
// ------------------------------------------------------------------

export async function deleteCheckpoint(id: string): Promise<void> {
    try {
        const filePath = path.join(CHECKPOINTS_DIR, `${id}.json`);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(CHECKPOINTS_DIR)) return;
        await fs.unlink(resolved);
    } catch { /* ignore */ }
}
