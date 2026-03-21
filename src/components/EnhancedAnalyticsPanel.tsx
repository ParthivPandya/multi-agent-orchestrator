'use client';

import { useMemo } from 'react';
import { TechnicalDebtReport, DebtHotspot } from '@/lib/agents/debtScanner';
import { ComplianceReport, ComplianceViolation } from '@/lib/agents/complianceAgent';
import { ROIMetrics } from '@/lib/roi';

interface EnhancedAnalyticsPanelProps {
  debtReport?: TechnicalDebtReport | null;
  complianceReport?: ComplianceReport | null;
  roiMetrics?: ROIMetrics | null;
  isAnalyzing?: boolean;
  onRunAnalysis?: () => void;
}

// Color scheme per debt category
const CATEGORY_COLORS: Record<string, string> = {
  architectural: '#6366f1',
  testing: '#ec4899',
  documentation: '#f59e0b',
  security: '#ef4444',
  dependency: '#8b5cf6',
  performance: '#06b6d4',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
  info: '#6b7280',
};

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

function CircleScore({
  score, max = 10, label, color,
}: { score: number; max?: number; label: string; color: string }) {
  const pct = (score / max) * 100;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text
          x="36" y="40"
          textAnchor="middle"
          fill="#fff"
          fontSize="14"
          fontWeight="700"
          style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px' }}
        >
          {score.toFixed(1)}
        </text>
      </svg>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '72px' }}>{label}</span>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '22px', fontWeight: 800, color: color || '#fff' }}>{value}</span>
      {sub && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '20px',
      fontSize: '10px',
      fontWeight: 700,
      background: `${SEVERITY_COLORS[severity] || '#6b7280'}18`,
      color: SEVERITY_COLORS[severity] || '#6b7280',
      border: `1px solid ${SEVERITY_COLORS[severity] || '#6b7280'}33`,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {severity}
    </span>
  );
}

export default function EnhancedAnalyticsPanel({
  debtReport,
  complianceReport,
  roiMetrics,
  isAnalyzing,
  onRunAnalysis,
}: EnhancedAnalyticsPanelProps) {
  const hasAnyData = !!(debtReport || complianceReport || roiMetrics);

  const debtGradeColor = useMemo(() =>
    debtReport ? (GRADE_COLORS[debtReport.grade] || '#6b7280') : '#6b7280',
    [debtReport]
  );

  if (!hasAnyData && !isAnalyzing) {
    return (
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        padding: '28px',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>Enterprise Analytics</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Run Technical Debt Scan, Compliance Check, and ROI Analysis after pipeline completion.
        </div>
        {onRunAnalysis && (
          <button onClick={onRunAnalysis} style={{
            padding: '9px 22px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
            🔍 Run Analysis
          </button>
        )}
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: '14px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Running enterprise analysis...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>

      {/* ROI Dashboard */}
      {roiMetrics && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '14px',
          padding: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '16px', fontSize: '14px', fontWeight: 700, color: '#34d399',
          }}>
            💰 ROI Intelligence Dashboard
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              color: '#34d399', fontWeight: 600,
            }}>
              {roiMetrics.roiMultiple}x ROI
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <MetricCard
              label="Hours Saved"
              value={`${roiMetrics.hoursSaved}h`}
              sub={`${roiMetrics.timeSavedPercent}% time reduction`}
              color="#34d399"
            />
            <MetricCard
              label="Net Savings"
              value={`$${roiMetrics.netSavingsUsd.toLocaleString()}`}
              sub={`$${roiMetrics.llmApiCostUsd} LLM cost`}
              color="#34d399"
            />
            <MetricCard
              label="Sprint Days Saved"
              value={roiMetrics.sprintDaySaved}
              sub="this run"
              color="#60a5fa"
            />
            <MetricCard
              label="Annual Value"
              value={`$${(roiMetrics.annualizedSavingsUsd / 1000).toFixed(0)}k`}
              sub={`${roiMetrics.totalRunsAnalyzed} total runs`}
              color="#a78bfa"
            />
          </div>

          <div style={{
            background: 'rgba(16,185,129,0.04)',
            border: '1px solid rgba(16,185,129,0.1)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            fontSize: '12px',
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>AI Cost per Feature: </span>
              <span style={{ color: '#fff', fontWeight: 600 }}>${roiMetrics.costPerFeatureAi}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Manual Cost: </span>
              <span style={{ color: '#fff', fontWeight: 600 }}>${roiMetrics.costPerFeatureManual.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cumulative Savings: </span>
              <span style={{ color: '#34d399', fontWeight: 600 }}>${roiMetrics.cumulativeSavingsUsd.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Technical Debt Report */}
      {debtReport && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${debtGradeColor}30`,
          borderRadius: '14px',
          padding: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
              🏗️ Technical Debt Report
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '32px', fontWeight: 800, color: debtGradeColor,
                padding: '4px 14px', background: `${debtGradeColor}15`,
                borderRadius: '10px', border: `1px solid ${debtGradeColor}40`,
              }}>
                {debtReport.grade}
              </span>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <div>Score: <strong style={{ color: '#fff' }}>{debtReport.debtScore.toFixed(1)}/10</strong></div>
                <div>~{debtReport.estimatedHoursToRemediate}h to remediate</div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
            {debtReport.summary}
          </p>

          {/* Category Scores */}
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            {Object.entries(debtReport.categories).map(([cat, score]) => (
              <CircleScore
                key={cat}
                score={score}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                color={CATEGORY_COLORS[cat] || '#6b7280'}
              />
            ))}
          </div>

          {/* Top Hotspots */}
          {debtReport.hotspots.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Top Hotspots
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {debtReport.hotspots.slice(0, 6).map((h: DebtHotspot, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <SeverityBadge severity={h.severity} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>{h.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{h.recommendation}</div>
                    </div>
                    <span style={{ fontSize: '10px', color: CATEGORY_COLORS[h.type] || '#6b7280', whiteSpace: 'nowrap' }}>{h.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compliance Report */}
      {complianceReport && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${complianceReport.overallStatus === 'FAIL' ? 'rgba(239,68,68,0.3)' : complianceReport.overallStatus === 'PASS' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
          borderRadius: '14px',
          padding: '20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
              ⚖️ Compliance Report
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                background: complianceReport.overallStatus === 'FAIL'
                  ? 'rgba(239,68,68,0.15)'
                  : complianceReport.overallStatus === 'PASS'
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(245,158,11,0.15)',
                color: complianceReport.overallStatus === 'FAIL' ? '#f87171'
                  : complianceReport.overallStatus === 'PASS' ? '#4ade80' : '#fbbf24',
              }}>
                {complianceReport.overallStatus}
              </span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                {complianceReport.overallScore}/100
              </span>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
            {complianceReport.summary}
          </p>

          {/* Framework scores */}
          {complianceReport.frameworks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {complianceReport.frameworks.map(fw => (
                <div key={fw.framework} style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: fw.passed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${fw.passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: fw.passed ? '#4ade80' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {fw.passed ? '✅' : '❌'} {fw.framework}
                  <span style={{ opacity: 0.7 }}>({fw.score}%)</span>
                </div>
              ))}
            </div>
          )}

          {/* Critical violations */}
          {complianceReport.criticalViolations.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f87171', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔴 Critical Violations ({complianceReport.criticalViolations.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {complianceReport.criticalViolations.slice(0, 5).map((v: ComplianceViolation, i: number) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>{v.rule}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{v.remediation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {complianceReport.estimatedComplianceHours > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Estimated remediation: <strong style={{ color: '#fff' }}>{complianceReport.estimatedComplianceHours} hours</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
