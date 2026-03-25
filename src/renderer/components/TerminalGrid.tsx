import React, { useState, useRef, useEffect, useCallback, createRef } from 'react';
import { TerminalView, TerminalViewHandle } from './TerminalView';
import { ActiveTerminal, ViewMode } from '../types';
import { t } from '../i18n';

interface TerminalGridProps {
  terminals: ActiveTerminal[];
  viewMode: ViewMode;
  focusedTerminal: string | null;
  gridColumns: number;
  onFocusTerminal: (ptyId: string) => void;
  onKillTerminal: (ptyId: string) => void;
  onTerminalExit: (ptyId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNewSession: () => void;
}

export function TerminalGrid({
  terminals,
  viewMode,
  focusedTerminal,
  onFocusTerminal,
  onKillTerminal,
  onReorder,
  onViewModeChange,
  onNewSession,
  gridColumns,
}: TerminalGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Map<string, React.RefObject<TerminalViewHandle>>>(new Map());

  // Ensure refs exist for all terminals
  for (const t of terminals) {
    if (!terminalRefs.current.has(t.ptyId)) {
      terminalRefs.current.set(t.ptyId, createRef<TerminalViewHandle>());
    }
  }

  // Scroll all visible terminals to bottom on view/column change
  const scrollAllToBottom = useCallback(() => {
    setTimeout(() => {
      for (const t of terminals) {
        const ref = terminalRefs.current.get(t.ptyId);
        ref?.current?.scrollToBottom();
        ref?.current?.fit();
      }
    }, 100);
  }, [terminals]);

  useEffect(() => {
    scrollAllToBottom();
  }, [viewMode, gridColumns]);

  // Compute grid style — always calculate rows for full height
  const getGridStyle = useCallback((): React.CSSProperties => {
    const count = terminals.length;
    if (count === 0) return {};

    let cols: number;
    if (gridColumns > 0) {
      cols = gridColumns;
    } else {
      // Auto: calculate based on container width
      const containerWidth = containerRef.current?.clientWidth || 800;
      const minColWidth = 400;
      cols = Math.max(1, Math.floor(containerWidth / minColWidth));
      // Don't use more columns than terminals
      cols = Math.min(cols, count);
    }

    const rows = Math.max(1, Math.ceil(count / cols));
    return {
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
    };
  }, [terminals.length, gridColumns]);

  if (terminals.length === 0) {
    return (
      <div className="terminal-area">
        <div className="empty-state">
          <div className="icon">⬛</div>
          <p>{t('terminal.empty')}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('terminal.emptyHint')}</p>
          <button className="btn btn-primary" onClick={onNewSession}>{t('sidebar.newSession')}</button>
        </div>
      </div>
    );
  }

  const activeFocus = focusedTerminal || terminals[0]?.ptyId;

  const handleDragStart = (index: number) => { dragRef.current = index; setDragIndex(index); };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDropIndex(index); };
  const handleDrop = (index: number) => {
    if (dragRef.current !== null && dragRef.current !== index) onReorder(dragRef.current, index);
    dragRef.current = null; setDragIndex(null); setDropIndex(null);
  };
  const handleDragEnd = () => { dragRef.current = null; setDragIndex(null); setDropIndex(null); };

  return (
    <div className="terminal-area">
      {/* Thumbnail strip */}
      {viewMode === 'thumbnail' && (
        <div className="thumbnail-strip">
          {terminals.map((term, i) => (
            <div
              key={`thumb-${term.ptyId}`}
              className={`thumbnail-item ${term.ptyId === activeFocus ? 'active' : ''}`}
              onClick={() => { onFocusTerminal(term.ptyId); scrollAllToBottom(); }}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            >
              <div className="thumbnail-label">
                <span className={`status-dot ${term.status === 'exited' ? 'exited' : ''}`} />
                <span>{term.name}</span>
                <button
                  className="thumbnail-close"
                  onClick={(e) => { e.stopPropagation(); onKillTerminal(term.ptyId); }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Focus tabs */}
      {viewMode === 'focus' && terminals.length > 1 && (
        <div className="focus-tabs">
          {terminals.map(term => (
            <button
              key={`tab-${term.ptyId}`}
              className={`btn btn-sm ${term.ptyId === activeFocus ? 'btn-primary' : ''}`}
              onClick={() => { onFocusTerminal(term.ptyId); scrollAllToBottom(); }}
            >
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: term.status === 'running' ? 'var(--success)' : 'var(--text-muted)',
                marginRight: 4,
              }} />
              {term.name}
            </button>
          ))}
        </div>
      )}

      {/* Terminal cards */}
      <div
        ref={containerRef}
        className={`terminal-container ${viewMode === 'grid' ? 'layout-grid' : 'layout-single'}`}
        style={viewMode === 'grid' ? getGridStyle() : undefined}
      >
        {terminals.map((terminal, index) => {
          const isVisible = viewMode === 'grid' || terminal.ptyId === activeFocus;
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index && dragIndex !== index;
          const termRef = terminalRefs.current.get(terminal.ptyId)!;

          return (
            <div
              key={terminal.ptyId}
              className={`terminal-card ${terminal.ptyId === activeFocus ? 'focused' : ''} ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
              style={!isVisible ? { visibility: 'hidden' as const, height: 0, overflow: 'hidden', position: 'absolute' as const } : undefined}
              draggable={viewMode === 'grid'}
              onDragStart={viewMode === 'grid' ? () => handleDragStart(index) : undefined}
              onDragOver={viewMode === 'grid' ? (e) => handleDragOver(e, index) : undefined}
              onDrop={viewMode === 'grid' ? () => handleDrop(index) : undefined}
              onDragEnd={viewMode === 'grid' ? handleDragEnd : undefined}
            >
              <div className="terminal-card-header">
                <div className="terminal-card-title">
                  {viewMode === 'grid' && <span className="drag-handle">⠿</span>}
                  <span className={`status-dot ${terminal.status === 'exited' ? 'exited' : ''}`} />
                  <span>{terminal.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {terminal.cwd.split('\\').slice(-2).join('/')}
                  </span>
                </div>
                <div className="terminal-card-actions">
                  {viewMode === 'grid' && (
                    <button className="btn btn-sm" onClick={() => { onFocusTerminal(terminal.ptyId); onViewModeChange('focus'); }} title="Focus">⛶</button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => onKillTerminal(terminal.ptyId)} title={t('terminal.close')}>✕</button>
                </div>
              </div>
              <div className="terminal-card-body">
                <TerminalView
                  ref={termRef}
                  ptyId={terminal.ptyId}
                  isVisible={isVisible}
                  isFocused={terminal.ptyId === activeFocus}
                  onFocus={() => onFocusTerminal(terminal.ptyId)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
