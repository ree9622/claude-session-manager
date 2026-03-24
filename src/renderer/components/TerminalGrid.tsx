import React from 'react';
import { TerminalView } from './TerminalView';
import { ActiveTerminal, ViewMode } from '../types';

interface TerminalGridProps {
  terminals: ActiveTerminal[];
  viewMode: ViewMode;
  focusedTerminal: string | null;
  onFocusTerminal: (ptyId: string) => void;
  onKillTerminal: (ptyId: string) => void;
  onTerminalExit: (ptyId: string) => void;
}

export function TerminalGrid({
  terminals,
  viewMode,
  focusedTerminal,
  onFocusTerminal,
  onKillTerminal,
}: TerminalGridProps) {
  if (terminals.length === 0) {
    return (
      <div className="terminal-area">
        <div className="empty-state">
          <div className="icon">⬛</div>
          <p>활성 터미널이 없습니다</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            사이드바에서 세션을 더블클릭하거나 "새 세션"을 눌러 시작하세요
          </p>
        </div>
      </div>
    );
  }

  // In focus mode, show only the focused terminal (or first one)
  const visibleTerminals = viewMode === 'focus'
    ? terminals.filter(t => t.ptyId === (focusedTerminal || terminals[0]?.ptyId))
    : terminals;

  return (
    <div className="terminal-area">
      {/* Focus mode: show tabs for switching */}
      {viewMode === 'focus' && terminals.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 8,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          {terminals.map(t => (
            <button
              key={t.ptyId}
              className={`btn btn-sm ${t.ptyId === (focusedTerminal || terminals[0]?.ptyId) ? 'btn-primary' : ''}`}
              onClick={() => onFocusTerminal(t.ptyId)}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: t.status === 'running' ? 'var(--success)' : 'var(--text-muted)',
                  marginRight: 4,
                }}
              />
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className={`terminal-grid view-${viewMode}`}>
        {visibleTerminals.map(terminal => (
          <div
            key={terminal.ptyId}
            className={`terminal-card ${terminal.ptyId === focusedTerminal ? 'focused' : ''}`}
          >
            <div className="terminal-card-header">
              <div className="terminal-card-title">
                <span className={`status-dot ${terminal.status === 'exited' ? 'exited' : ''}`} />
                <span>{terminal.name}</span>
                {viewMode !== 'focus' && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {terminal.cwd.split('\\').slice(-2).join('/')}
                  </span>
                )}
              </div>
              <div className="terminal-card-actions">
                {viewMode !== 'focus' && (
                  <button
                    className="btn btn-sm"
                    onClick={() => onFocusTerminal(terminal.ptyId)}
                    title="포커스"
                  >
                    ⛶
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onKillTerminal(terminal.ptyId)}
                  title="종료"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="terminal-card-body">
              <TerminalView
                ptyId={terminal.ptyId}
                isVisible={true}
                isFocused={terminal.ptyId === focusedTerminal}
                onFocus={() => onFocusTerminal(terminal.ptyId)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
