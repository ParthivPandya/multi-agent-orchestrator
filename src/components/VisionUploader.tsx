'use client';

import { useState, useRef, useCallback } from 'react';
import { getAllLanguages, SupportedLanguage } from '@/lib/skills/languages';

interface VisionUploaderProps {
  onCodeGenerated: (code: string, tokensUsed: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

const FRAMEWORKS = [
  { value: 'react', label: 'React', icon: '⚛️' },
  { value: 'nextjs', label: 'Next.js', icon: '▲' },
  { value: 'vue', label: 'Vue.js', icon: '💚' },
  { value: 'svelte', label: 'Svelte', icon: '🔥' },
  { value: 'angular', label: 'Angular', icon: '🅰️' },
  { value: 'vanilla', label: 'Vanilla HTML/CSS', icon: '🌐' },
];

const STYLE_LIBRARIES = [
  { value: 'tailwind', label: 'Tailwind CSS' },
  { value: 'css-modules', label: 'CSS Modules' },
  { value: 'styled-components', label: 'Styled Components' },
  { value: 'shadcn', label: 'shadcn/ui' },
  { value: 'mui', label: 'Material UI' },
  { value: 'chakra', label: 'Chakra UI' },
];

export default function VisionUploader({ onCodeGenerated, isOpen, onClose }: VisionUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [framework, setFramework] = useState('nextjs');
  const [language, setLanguage] = useState<SupportedLanguage>('typescript');
  const [styleLib, setStyleLib] = useState('tailwind');
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allLanguages = getAllLanguages();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    } else {
      setError('Please drop an image file (PNG, JPG, WEBP).');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) return;
    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('framework', framework);
      formData.append('language', language);
      formData.append('styleLibrary', styleLib);
      if (context) formData.append('context', context);

      const res = await fetch('/api/vision', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Vision-to-code failed');
      }

      onCodeGenerated(data.generatedCode, data.tokensUsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFile, framework, language, styleLib, context, onCodeGenerated, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '20px',
        padding: '28px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
              🖼️ Vision-to-Code
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Upload a Figma screenshot, wireframe, or UI mockup → get production code
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            fontSize: '20px', cursor: 'pointer', padding: '4px',
          }}>✕</button>
        </div>

        {/* Image Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#6366f1' : previewUrl ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '14px',
            padding: previewUrl ? '12px' : '40px 20px',
            textAlign: 'center',
            cursor: selectedFile ? 'default' : 'pointer',
            background: isDragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s',
            marginBottom: '20px',
            position: 'relative',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {previewUrl ? (
            <div>
              <img
                src={previewUrl}
                alt="Design preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '280px',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null); }}
                style={{
                  marginTop: '12px',
                  padding: '5px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  color: '#f87171',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Remove image
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📸</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                Drop your design here
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Figma screenshots · Wireframes · UI mockups · PNG / JPG / WEBP
              </div>
              <div style={{
                marginTop: '14px',
                padding: '7px 18px',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '8px',
                display: 'inline-block',
                fontSize: '13px',
                color: '#818cf8',
                cursor: 'pointer',
              }}>
                Browse files
              </div>
            </>
          )}
        </div>

        {/* Options Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Framework */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Framework
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {FRAMEWORKS.map(fw => (
                <button
                  key={fw.value}
                  onClick={() => setFramework(fw.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${framework === fw.value ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    background: framework === fw.value ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: framework === fw.value ? '#818cf8' : 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fw.icon} {fw.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Language
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as SupportedLanguage)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {allLanguages.map(l => (
                <option key={l.language} value={l.language}>{l.icon} {l.displayName}</option>
              ))}
            </select>
          </div>

          {/* Style Library */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Style Library
            </label>
            <select
              value={styleLib}
              onChange={e => setStyleLib(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {STYLE_LIBRARIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Additional Context */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Context (optional)
            </label>
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. Dark mode, mobile-first, e-commerce checkout"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#f87171',
            marginBottom: '16px',
          }}>
            ❌ {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedFile || isGenerating}
          style={{
            width: '100%',
            padding: '13px',
            background: !selectedFile || isGenerating
              ? 'rgba(99,102,241,0.3)'
              : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: !selectedFile || isGenerating ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s',
          }}
        >
          {isGenerating ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              Generating code from your design...
            </>
          ) : (
            '✨ Generate Code from Design'
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0 }}>
          Powered by Llama 4 Maverick vision model · Output appears in the workspace file viewer
        </p>
      </div>
    </div>
  );
}
