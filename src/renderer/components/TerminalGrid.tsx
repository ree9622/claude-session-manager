import React, { useState, useRef } from 'react';
import { TerminalView } from './TerminalView';
import { ActiveTerminal, ViewMode } from '../types';

interface TerminalGridProps {
  terminals: ActiveTerminal[];
  viewMode: ViewMode;
  focusedTerminal: string | null;
  onFocusTerminal: (ptyId: string) => void;
  onKillTerminal: (ptyId: string) => void;
  onTerminalExit: (ptyId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function TerminalCard({
  terminal,
  isFocused,
  isDragging,
  isDropTarget,
  showDragHandle,
  showExpandBtn,
  onFocus,
  onKill,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  terminal: ActiveTerminal;
  isFocused: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  showDragHandle: boolean;
  showExpandBtn: boolean;
  onFocus: () => void;
  onKill: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <div
      className={`terminal-card ${isFocused ? 'focused' : ''} ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="terminal-card-header">
        <div className="terminal-card-title">
          {showDragHandle && <span className="drag-handle">⠿</span>}
          <span className={`status-dot ${terminal.status === 'exited' ? 'exited' : ''}`} />
          <span>{terminal.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {terminal.cwd.split('\\').slice(-2).join('/')}
          </span>
        </div>
        <div className="terminal-card-actions">
          {showExpandBtn && (
            <button className="btn btn-sm" onClick={onFocus} title="Focus">⛶</button>
          )}
          <button className="btn btn-sm btn-danger" onClick={onKill} title="Close">✕</button>
        </div>
      </div>
      <div className="terminal-card-body">
        <TerminalView
          ptyId={terminal.ptyId}
          isVisible={true}
          isFocused={isFocused}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}

export function TerminalGrid({
  terminals,
  viewMode,
  focusedTerminal,
  onFocusTerminal,
  onKillTerminal,
  onReorder,
}: TerminalGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  if (terminals.length === 0) {
    return (
      <div className="terminal-area">
        <div className="empty-state">
          <div className="icon">⬛</div>
          <p>No active terminals</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Click ▶ on a session or press "+ New Session" to start
          </p>
        </div>
      </div>
    );
  }

  const handleDragStart = (index: number) => {
    dragRef.current = index;
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragRef.current !== null && dragRef.current !== index) {
      onReorder(dragRef.current, index);
    }
    dragRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
  };
  const handleDragEnd = () => {
    dragRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
  };

  const activeFocus = focusedTerminal || terminals[0]?.ptyId;

  // Thumbnail view: top thumbnails strip + large focused terminal below
  if (viewMode === 'thumbnail') {
    const focusedTerm = terminals.find(t => t.ptyId === activeFocus) || terminals[0];

    return (
      <div className="terminal-area thumbnail-layout">
        <div className="thumbnail-strip">
          {terminals.map((t, i) => (
            <div
              key={t.ptyId}
              className={`thumbnail-item ${t.ptyId === activeFocus ? 'active' : ''}`}
              onClick={() => onFocusTerminal(t.ptyId)}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            >
              <div className="thumbnail-preview">
                <TerminalView
                  ptyId={t.ptyId}
                  isVisible={true}
                  isFocused={false}
                  onFocus={() => onFocusTerminal(t.ptyId)}
                />
              </div>
              <div className="thumbnail-label">
                <span className={`status-dot ${t.status === 'exited' ? 'exited' : ''}`} />
                <span>{t.name}</span>
                <button
                  className="thumbnail-close"
                  onClick={(e) => { e.stopPropagation(); onKillTerminal(t.ptyId); }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {focusedTerm && (
          <div className="thumbnail-main">
            <TerminalCard
              terminal={focusedTerm}
              isFocused={true}
              isDragging={false}
              isDropTarget={false}
              showDragHandle={false}
              showExpandBtn={false}
              onFocus={() => {}}
              onKill={() => onKillTerminal(focusedTerm.ptyId)}
            />
          </div>
        )}
      </div>
    );
  }

  // Focus view: tabs + single terminal
  if (viewMode === 'focus') {
    const focusedTerm = terminals.find(t => t.ptyId === activeFocus) || terminals[0];

    return (
      <div className="terminal-area">
        {terminals.length > 1 && (
          <div className="focus-tabs">
            {terminals.map(t => (
              <button
                key={t.ptyId}
                className={`btn btn-sm ${t.ptyId === activeFocus ? 'btn-primary' : ''}`}
                onClick={() => onFocusTerminal(t.ptyId)}
              >
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: t.status === 'running' ? 'var(--success)' : 'var(--text-muted)',
                  marginRight: 4,
                }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="terminal-grid view-focus">
          {focusedTerm && (
            <TerminalCard
              terminal={focusedTerm}
              isFocused={true}
              isDragging={false}
              isDropTarget={false}
              showDragHandle={false}
              showExpandBtn={false}
              onFocus={() => {}}
              onKill={() => onKillTerminal(focusedTerm.ptyId)}
            />
          )}
        </div>
      </div>
    );
  }

  // Grid view: equal-sized grid with DnD
  return (
    <div className="terminal-area">
      <div className="terminal-grid view-grid">
        {terminals.map((terminal, index) => (
          <TerminalCard
            key={terminal.ptyId}
            terminal={terminal}
            isFocused={terminal.ptyId === focusedTerminal}
            isDragging={dragIndex === index}
            isDropTarget={dropIndex === index && dragIndex !== index}
            showDragHandle={true}
            showExpandBtn={true}
            onFocus={() => onFocusTerminal(terminal.ptyId)}
            onKill={() => onKillTerminal(terminal.ptyId)}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
