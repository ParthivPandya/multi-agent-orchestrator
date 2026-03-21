'use client';

import { useState } from 'react';
import { HITLDecision } from '@/lib/types';

interface HITLModalProps {
  requestId: string;
  stage: string;
  agentOutput: string;
  reviewScore?: number;
  onDecision: (requestId: string, decision: HITLDecision, feedback: string) => void;
}

export default function HITLModal({
  requestId,
  stage,
  agentOutput,
  reviewScore,
  onDecision,
}: HITLModalProps) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeDecision, setActiveDecision] = useState<HITLDecision | null>(null);

  const handleDecision = async (decision: HITLDecision) => {
    setSubmitting(true);
    setActiveDecision(decision);
    try {
      await fetch('/api/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          decision,
          feedback,
          decidedAt: Date.now(),
        }),
      });
      onDecision(requestId, decision, feedback);
    } catch (err) {
      console.error('[HITL] Failed to submit decision:', err);
    } finally {
      setSubmitting(false);
      setActiveDecision(null);
    }
  };

  const stageLabels: Record<string, string> = {
    post_review: 'Post Code Review',
    pre_deployment: 'Pre Deployment',
    post_security: 'Post Security Review',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      padding: '24px',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,15,25,0.98) 0%, rgba(20,20,35,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
          }}>
            ⏸️
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
            }}>
              Human Review Required
            </h2>
            <p style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}>
              Pipeline paused — your approval needed to continue
            </p>
          </div>
        </div>

        {/* Stage & Score badges */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(99,102,241,0.12)',
            color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.25)',
          }}>
            📍 Stage: {stageLabels[stage] || stage}
          </span>
          {reviewScore !== undefined && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              background: reviewScore >= 7 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
              color: reviewScore >= 7 ? '#34d399' : '#fbbf24',
              border: `1px solid ${reviewScore >= 7 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}>
              ⭐ Review Score: {reviewScore}/10
            </span>
          )}
        </div>

        {/* Output Preview */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '8px',
          }}>
            Generated Code Preview
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '16px',
            maxHeight: '240px',
            overflowY: 'auto',
          }}>
            <pre style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {agentOutput.slice(0, 2000)}
              {agentOutput.length > 2000 && '\n\n… (truncated — full code in OutputPanel)'}
            </pre>
          </div>
        </div>

        {/* Feedback textarea */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Feedback / Change Requests (optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add specific feedback for the developer, or describe what changes you want..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleDecision('approved')}
            disabled={submitting}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: submitting && activeDecision === 'approved'
                ? 'rgba(16,185,129,0.4)'
                : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.25))',
              color: '#34d399',
              fontSize: '13px',
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.3)',
            }}
          >
            {submitting && activeDecision === 'approved' ? '⏳' : '✅'} Approve & Continue
          </button>

          <button
            onClick={() => handleDecision('changes_requested')}
            disabled={submitting}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: submitting && activeDecision === 'changes_requested'
                ? 'rgba(245,158,11,0.4)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.25))',
              color: '#fbbf24',
              fontSize: '13px',
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.3)',
            }}
          >
            {submitting && activeDecision === 'changes_requested' ? '⏳' : '✏️'} Request Changes
          </button>

          <button
            onClick={() => handleDecision('rejected')}
            disabled={submitting}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: submitting && activeDecision === 'rejected'
                ? 'rgba(239,68,68,0.4)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.2))',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.25)',
            }}
          >
            {submitting && activeDecision === 'rejected' ? '⏳' : '❌'} Reject Pipeline
          </button>
        </div>

        <p style={{
          margin: '16px 0 0',
          fontSize: '11px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          Pipeline will auto-approve after 10 minutes to prevent deadlock.
        </p>
      </div>
    </div>
  );
}
