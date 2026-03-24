import React, { useMemo, useRef, useState } from 'react';
import { DAGNodeType, DAGWorkflow, BUILT_IN_DAG_WORKFLOWS } from '@/lib/flows/dagExecutor';
import { AGENT_CONFIGS, AgentName } from '@/lib/types';

interface VisualEditorProps {
  onRunWorkflow: (workflowId: string) => void;
}

const NODE_WIDTH = 230;
const NODE_HEIGHT = 96;

export default function VisualEditor({ onRunWorkflow }: VisualEditorProps) {
  const [workflows, setWorkflows] = useState<DAGWorkflow[]>(Object.values(BUILT_IN_DAG_WORKFLOWS));
  const [activeWorkflowId, setActiveWorkflowId] = useState('standard-pipeline');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeWorkflow = useMemo(
    () => workflows.find((w) => w.id === activeWorkflowId),
    [workflows, activeWorkflowId]
  );
  const selectedNode = activeWorkflow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const getNodeColor = (type: DAGNodeType, agentName?: AgentName) => {
    if (type === 'agent' && agentName) return AGENT_CONFIGS[agentName]?.color ?? '#6366f1';
    if (type === 'condition') return '#f59e0b';
    if (type === 'parallel') return '#06b6d4';
    if (type === 'human_checkpoint') return '#ec4899';
    if (type === 'merge') return '#10b981';
    return '#6366f1';
  };

  const getNodeIcon = (type: DAGNodeType, agentName?: AgentName) => {
    if (type === 'agent' && agentName) return AGENT_CONFIGS[agentName]?.icon ?? '⚙️';
    if (type === 'condition') return '🔀';
    if (type === 'parallel') return '⚡';
    if (type === 'human_checkpoint') return '👤';
    if (type === 'merge') return '✅';
    return '⚙️';
  };

  const handleNodeMouseDown = (e: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    if (!activeWorkflow) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !selectedNodeId || !activeWorkflow || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - dragOffset.x) / zoom;
    const y = (e.clientY - rect.top - dragOffset.y) / zoom;
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id !== activeWorkflowId
          ? wf
          : { ...wf, nodes: wf.nodes.map((n) => (n.id === selectedNodeId ? { ...n, x, y } : n)) }
      )
    );
  };

  const stopDragging = () => setIsDragging(false);

  const renderEdges = () => {
    if (!activeWorkflow) return null;
    return (
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <defs>
          <marker id="ve-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.35)" />
          </marker>
        </defs>
        {activeWorkflow.edges.map((edge) => {
          const fromNode = activeWorkflow.nodes.find((n) => n.id === edge.from);
          const toNode = activeWorkflow.nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const startX = fromNode.x * zoom + NODE_WIDTH * zoom * 0.5;
          const startY = fromNode.y * zoom + NODE_HEIGHT * zoom;
          const endX = toNode.x * zoom + NODE_WIDTH * zoom * 0.5;
          const endY = toNode.y * zoom;
          const midY = startY + (endY - startY) * 0.5;
          const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

          return (
            <g key={edge.id}>
              <path d={path} fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth={2} markerEnd="url(#ve-arrow)" />
              {edge.label && (
                <text x={(startX + endX) / 2} y={midY - 6} fill="#a5b4fc" fontSize="10" textAnchor="middle">
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', height: '100%' }}>
      <aside style={{ borderRight: '1px solid var(--border-primary)', background: 'rgba(10,14,24,0.9)', padding: '14px', overflowY: 'auto' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Workflow Catalog
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {workflows.map((wf) => {
            const active = wf.id === activeWorkflowId;
            return (
              <button
                key={wf.id}
                onClick={() => {
                  setActiveWorkflowId(wf.id);
                  setSelectedNodeId(null);
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-primary)',
                  background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#c7d2fe' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: active ? '#e0e7ff' : '#d1d5db' }}>{wf.name}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>{wf.description}</div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Quick Legend
          </div>
          {['agent', 'condition', 'parallel', 'human_checkpoint', 'merge'].map((type) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: getNodeColor(type as DAGNodeType) }} />
              <span>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', background: 'rgba(9,12,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>Drag-and-Drop Workflow Canvas</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Move nodes to design orchestration like LangFlow/Flowise.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.04)', color: '#d1d5db', cursor: 'pointer' }}>-</button>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#94a3b8', minWidth: '52px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </div>
            <button onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.04)', color: '#d1d5db', cursor: 'pointer' }}>+</button>
            <button
              onClick={() => onRunWorkflow(activeWorkflowId)}
              style={{
                marginLeft: '6px',
                padding: '8px 14px',
                borderRadius: '9px',
                border: '1px solid rgba(16,185,129,0.4)',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.35), rgba(5,150,105,0.22))',
                color: '#ecfdf5',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Run Workflow
            </button>
          </div>
        </div>

        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#070b14',
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          }}
        >
          <div style={{ position: 'relative', minWidth: '1400px', minHeight: '1100px' }}>
            {renderEdges()}
            {activeWorkflow?.nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const nodeColor = getNodeColor(node.type, node.agentName);
              const nodeIcon = getNodeIcon(node.type, node.agentName);
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{
                    position: 'absolute',
                    left: node.x * zoom,
                    top: node.y * zoom,
                    width: NODE_WIDTH * zoom,
                    minHeight: NODE_HEIGHT * zoom,
                    borderRadius: 12 * zoom,
                    border: `1px solid ${isSelected ? nodeColor : 'rgba(148,163,184,0.28)'}`,
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(9,14,28,0.98))',
                    boxShadow: isSelected ? `0 0 0 1px ${nodeColor}, 0 18px 38px rgba(2,6,23,0.65)` : '0 10px 24px rgba(2,6,23,0.45)',
                    zIndex: isSelected ? 20 : 10,
                    cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: '4px', background: nodeColor, opacity: 0.9 }} />
                  <div style={{ padding: `${10 * zoom}px ${12 * zoom}px`, display: 'flex', alignItems: 'center', gap: `${10 * zoom}px` }}>
                    <div
                      style={{
                        width: `${30 * zoom}px`,
                        height: `${30 * zoom}px`,
                        borderRadius: `${8 * zoom}px`,
                        background: `${nodeColor}24`,
                        color: nodeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${16 * zoom}px`,
                      }}
                    >
                      {nodeIcon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: `${12 * zoom}px`, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.label}
                      </div>
                      <div style={{ fontSize: `${10 * zoom}px`, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {node.type}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: `0 ${12 * zoom}px ${10 * zoom}px`, fontSize: `${10 * zoom}px`, color: '#a5b4fc', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {node.agentName || node.id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside style={{ borderLeft: '1px solid var(--border-primary)', background: 'rgba(10,14,24,0.9)', padding: '14px', overflowY: 'auto' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Node Inspector
        </div>
        {!selectedNode && (
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
            Select a node to inspect configuration, branch logic, or human-checkpoint policy.
          </div>
        )}
        {selectedNode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)' }}>
              <div style={{ color: '#e0e7ff', fontWeight: 700, fontSize: '13px' }}>{selectedNode.label}</div>
              <div style={{ color: '#a5b4fc', fontSize: '11px', marginTop: '4px' }}>{selectedNode.type}</div>
            </div>
            <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.03)', fontSize: '12px' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>Node ID</div>
              <div style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>{selectedNode.id}</div>
            </div>
            {selectedNode.agentName && (
              <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.03)', fontSize: '12px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>Bound Agent</div>
                <div style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>{selectedNode.agentName}</div>
              </div>
            )}
            {selectedNode.condition && (
              <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', fontSize: '12px', lineHeight: 1.6 }}>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>Branch Condition</div>
                <div style={{ color: '#fde68a', fontFamily: 'var(--font-mono)' }}>
                  IF {selectedNode.condition.field} {selectedNode.condition.operator} {selectedNode.condition.value}
                </div>
                <div style={{ color: '#86efac', marginTop: '6px' }}>TRUE → {selectedNode.condition.trueBranch}</div>
                <div style={{ color: '#fda4af' }}>FALSE → {selectedNode.condition.falseBranch}</div>
              </div>
            )}
            {selectedNode.checkpointConfig && (
              <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid rgba(236,72,153,0.35)', background: 'rgba(236,72,153,0.08)', fontSize: '12px', lineHeight: 1.6 }}>
                <div style={{ color: '#f9a8d4', fontWeight: 700, marginBottom: '6px' }}>Human Checkpoint</div>
                <div style={{ color: '#fbcfe8' }}>Timeout: {Math.round(selectedNode.checkpointConfig.timeoutMs / 60000)} min</div>
                <div style={{ color: '#fbcfe8' }}>Auto-approve: {selectedNode.checkpointConfig.autoApprove ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
