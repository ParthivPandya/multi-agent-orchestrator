// ============================================================
// RAG — TF-IDF Vector Store & Retriever (Enhancement 3)
// Pure in-memory cosine similarity — zero dependencies
// ============================================================

import { RAGChunk } from '@/lib/types';
import { KNOWLEDGE_BASE } from './knowledgeBase';

// ------------------------------------------------------------------
// TF-IDF Scoring (lightweight, no external embeddings API needed)
// ------------------------------------------------------------------

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s.]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
}

function termFrequency(tokens: string[], term: string): number {
    const count = tokens.filter(t => t === term).length;
    return count / tokens.length;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0, magA = 0, magB = 0;

    for (const k of keys) {
        const av = a[k] ?? 0;
        const bv = b[k] ?? 0;
        dot += av * bv;
        magA += av * av;
        magB += bv * bv;
    }

    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag === 0 ? 0 : dot / mag;
}

function buildVector(text: string, vocabulary: string[]): Record<string, number> {
    const tokens = tokenize(text);
    const vec: Record<string, number> = {};
    for (const term of vocabulary) {
        vec[term] = termFrequency(tokens, term);
    }
    return vec;
}

// Build vocabulary from entire knowledge base at module load time
const VOCABULARY: string[] = (() => {
    const all = KNOWLEDGE_BASE.flatMap(chunk =>
        [...tokenize(chunk.content), ...chunk.keywords.map(k => k.toLowerCase())]
    );
    return [...new Set(all)];
})();

// Pre-build chunk vectors (done once at startup)
const CHUNK_VECTORS: Array<{ chunk: RAGChunk; vector: Record<string, number> }> = KNOWLEDGE_BASE.map(chunk => ({
    chunk,
    vector: buildVector(chunk.content + ' ' + chunk.keywords.join(' '), VOCABULARY),
}));

// ------------------------------------------------------------------
// Public Retriever API
// ------------------------------------------------------------------

/**
 * Retrieves the top-K most relevant knowledge chunks for a query.
 * Uses keyword boosting + TF-IDF cosine similarity.
 */
export function retrieveRelevantChunks(query: string, topK = 3): RAGChunk[] {
    const queryTokens = tokenize(query);
    const queryVector = buildVector(query, VOCABULARY);

    const scored = CHUNK_VECTORS.map(({ chunk, vector }) => {
        let score = cosineSimilarity(queryVector, vector);

        // Boost by explicit keyword matches (strong signal)
        const keywordMatches = chunk.keywords.filter(kw =>
            queryTokens.some(qt => qt.includes(kw.toLowerCase()) || kw.toLowerCase().includes(qt))
        ).length;
        score += keywordMatches * 0.15;

        return { chunk: { ...chunk, score }, score };
    });

    return scored
        .filter(s => s.score > 0.01) // Filter noise
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(s => s.chunk);
}

/**
 * Formats retrieved chunks as a concise context block for LLM injection.
 */
export function formatRAGContext(chunks: RAGChunk[]): string {
    if (chunks.length === 0) return '';

    const lines = [
        '---',
        '📚 RETRIEVED DOCUMENTATION CONTEXT (prioritize this over training data):',
        '',
    ];

    for (const chunk of chunks) {
        lines.push(`### ${chunk.source}`);
        lines.push(chunk.content.trim());
        lines.push('');
    }

    lines.push('---');
    return lines.join('\n');
}
