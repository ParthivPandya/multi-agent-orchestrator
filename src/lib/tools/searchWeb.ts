// ============================================================
// Agentic Tools — Web Search (Enhancement 2)
// Uses DuckDuckGo Instant Answer API (free, no key needed)
// ============================================================

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export async function searchWeb(query: string, maxResults = 3): Promise<WebSearchResult[]> {
    try {
        const encoded = encodeURIComponent(query);
        const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'MultiAgentOrchestrator/1.0' },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return [];

        const data = await response.json();
        const results: WebSearchResult[] = [];

        // RelatedTopics give the best short snippets
        if (Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, maxResults)) {
                if (topic.Text && topic.FirstURL) {
                    results.push({
                        title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 60),
                        url: topic.FirstURL,
                        snippet: topic.Text,
                    });
                }
            }
        }

        // Fallback: Abstract answer from DDG
        if (results.length === 0 && data.Abstract) {
            results.push({
                title: data.Heading || query,
                url: data.AbstractURL || '',
                snippet: data.Abstract,
            });
        }

        return results;
    } catch {
        return [];
    }
}

export function formatWebResults(results: WebSearchResult[]): string {
    if (results.length === 0) return 'No web results found.';
    return results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`)
        .join('\n\n');
}
