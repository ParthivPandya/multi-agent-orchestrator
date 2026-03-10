'use client';

import React, { useState, useCallback } from 'react';
import { ParsedFile } from '@/lib/fileParser';

interface WorkspaceViewerProps {
    files: ParsedFile[];
    projectName: string;
    onSaveToWorkspace: () => void;
    isSaving: boolean;
    savedPath: string | null;
}

export default function WorkspaceViewer({
    files,
    projectName,
    onSaveToWorkspace,
    isSaving,
    savedPath,
}: WorkspaceViewerProps) {
    const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(
        files.length > 0 ? files[0] : null
    );
    const [copiedFile, setCopiedFile] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadDone, setDownloadDone] = useState(false);

    const handleCopyFile = useCallback((file: ParsedFile) => {
        navigator.clipboard.writeText(file.content);
        setCopiedFile(file.path);
        setTimeout(() => setCopiedFile(null), 2000);
    }, []);

    const handleCopyAll = useCallback(() => {
        const allContent = files
            .map(f => `// ═══ File: ${f.path} ═══\n${f.content}`)
            .join('\n\n');
        navigator.clipboard.writeText(allContent);
    }, [files]);

    /**
     * ZIP Export — bundles all files client-side using a simple approach
     * without external libraries (uses the File System API / data URLs).
     * Creates a zip-like tar using a simple concatenation approach,
     * or creates individual text files if only browser download is needed.
     * For full ZIP support the jszip package can be installed separately.
     */
    const handleDownloadZip = useCallback(async () => {
        if (files.length === 0) return;
        setIsDownloading(true);

        try {
            // Dynamically import jszip if available, otherwise download as combined txt
            let zip: {
                file: (path: string, content: string) => void;
                generateAsync: (opts: Record<string, string>) => Promise<Blob>;
            } | null = null;

            try {
                // @ts-expect-error optional peer dep
                const JSZip = (await import('jszip')).default;
                zip = new JSZip();
            } catch {
                zip = null;
            }

            if (zip) {
                files.forEach(f => zip!.file(f.path, f.content));
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${projectName}.zip`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                // Fallback: download all files concatenated
                const content = files
                    .map(f => `${'='.repeat(60)}\n// File: ${f.path}\n${'='.repeat(60)}\n${f.content}`)
                    .join('\n\n');
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${projectName}-files.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }

            setDownloadDone(true);
            setTimeout(() => setDownloadDone(false), 3000);
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setIsDownloading(false);
        }
    }, [files, projectName]);

    if (files.length === 0) {
        return (
            <div className="workspace-viewer" style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-muted)',
            }}>
                <div style={{ fontSize: '40px', opacity: 0.3, marginBottom: '12px' }}>📁</div>
                <p>No files were extracted from the developer output.</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    The developer agent may have used a different format. Check &quot;Raw&quot; view in the output panel.
                </p>
            </div>
        );
    }

    // Build a tree structure
    const buildTree = (files: ParsedFile[]) => {
        const tree: Record<string, ParsedFile[]> = {};
        files.forEach(file => {
            const dir = file.path.includes('/')
                ? file.path.substring(0, file.path.lastIndexOf('/'))
                : '.';
            if (!tree[dir]) tree[dir] = [];
            tree[dir].push(file);
        });
        return tree;
    };

    const fileTree = buildTree(files);
    const sortedDirs = Object.keys(fileTree).sort();

    return (
        <div className="workspace-viewer animate-fade-in" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-primary)',
                background: 'var(--bg-glass)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📁</span>
                    <div>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                        }}>
                            Generated Project: {projectName}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {files.length} files generated
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Copy All */}
                    <button className="btn-secondary" onClick={handleCopyAll} style={{ padding: '6px 14px', fontSize: '12px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy All
                    </button>

                    {/* Download ZIP */}
                    <button
                        className="btn-secondary"
                        onClick={handleDownloadZip}
                        disabled={isDownloading}
                        style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            color: downloadDone ? 'var(--accent-emerald)' : undefined,
                        }}
                        title="Download all files as ZIP"
                    >
                        {isDownloading ? (
                            <div className="spinner" style={{ width: '12px', height: '12px' }} />
                        ) : downloadDone ? (
                            <>✓ Downloaded</>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Download ZIP
                            </>
                        )}
                    </button>

                    {/* Save to Workspace */}
                    <button
                        className="btn-primary"
                        onClick={onSaveToWorkspace}
                        disabled={isSaving || !!savedPath}
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                        {isSaving ? (
                            <>
                                <div className="spinner" style={{ width: '12px', height: '12px' }} />
                                Saving...
                            </>
                        ) : savedPath ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Saved to Workspace
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Save to Workspace
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Saved path indicator */}
            {savedPath && (
                <div style={{
                    padding: '10px 20px',
                    background: 'rgba(16, 185, 129, 0.06)',
                    borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--accent-emerald)',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Files saved to: <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{savedPath}</code>
                </div>
            )}

            {/* Split view: File tree + File content */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '240px 1fr',
                minHeight: '400px',
                maxHeight: '600px',
            }}>
                {/* File tree sidebar */}
                <div style={{
                    borderRight: '1px solid var(--border-primary)',
                    overflowY: 'auto',
                    padding: '8px 0',
                }}>
                    {sortedDirs.map(dir => (
                        <div key={dir}>
                            {dir !== '.' && (
                                <div style={{
                                    padding: '6px 14px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}>
                                    <span style={{ fontSize: '12px' }}>📂</span>
                                    {dir}
                                </div>
                            )}
                            {fileTree[dir].map(file => {
                                const fileName = file.path.split('/').pop() || file.path;
                                const isSelected = selectedFile?.path === file.path;
                                return (
                                    <button
                                        key={file.path}
                                        onClick={() => setSelectedFile(file)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            width: '100%',
                                            padding: '7px 14px 7px 24px',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                            border: 'none',
                                            borderLeft: isSelected ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                                            color: isSelected ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                                            fontSize: '13px',
                                            fontFamily: 'var(--font-mono)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <span style={{ fontSize: '12px' }}>{getFileIcon(fileName)}</span>
                                        {fileName}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* File content viewer */}
                <div style={{ overflowY: 'auto', position: 'relative' }}>
                    {selectedFile ? (
                        <>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 16px',
                                borderBottom: '1px solid var(--border-primary)',
                                background: 'rgba(0, 0, 0, 0.2)',
                                position: 'sticky',
                                top: 0,
                                zIndex: 2,
                            }}>
                                <span style={{
                                    fontSize: '12px',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-secondary)',
                                }}>
                                    {selectedFile.path}
                                </span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-glass)',
                                        color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-mono)',
                                        textTransform: 'uppercase',
                                    }}>
                                        {selectedFile.language}
                                    </span>
                                    <button
                                        onClick={() => handleCopyFile(selectedFile)}
                                        style={{
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: copiedFile === selectedFile.path ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                            background: 'var(--bg-glass)',
                                            border: '1px solid var(--border-primary)',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {copiedFile === selectedFile.path ? '✓ Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                            <pre style={{
                                padding: '16px',
                                margin: 0,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '13px',
                                lineHeight: '1.6',
                                color: 'var(--text-primary)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}>
                                {selectedFile.content}
                            </pre>
                        </>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                        }}>
                            Select a file to view its content
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
        ts: '🟦',
        tsx: '⚛️',
        js: '🟨',
        jsx: '⚛️',
        py: '🐍',
        json: '📋',
        md: '📝',
        html: '🌐',
        css: '🎨',
        scss: '🎨',
        yaml: '⚙️',
        yml: '⚙️',
        dockerfile: '🐳',
        env: '🔑',
        sql: '🗄️',
        sh: '🖥️',
        bash: '🖥️',
        go: '🔵',
        rs: '🦀',
        java: '☕',
        test: '🧪',
        spec: '🧪',
    };
    // Also check for test files by name pattern
    if (fileName.includes('.test.') || fileName.includes('.spec.')) return '🧪';
    return iconMap[ext] || '📄';
}
