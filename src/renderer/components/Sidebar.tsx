import React, { useState, useMemo } from 'react';
import { SessionInfo } from '../types';

interface SidebarProps {
  sessions: SessionInfo[];
  selectedSessions: Set<string>;
  onToggleSelect: (id: string) => void;
  onResumeSession: (session: SessionInfo) => void;
  onBulkResume: () => void;
  onSearch: (query: string) => void;
  onNewSession: () => void;
  onGenerateNames: () => void;
  onCleanup: (days: number) => Promise<number>;
  loading: boolean;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export function Sidebar({
  sessions,
  selectedSessions,
  onToggleSelect,
  onResumeSession,
  onBulkResume,
  onSearch,
  onNewSession,
  onGenerateNames,
  onCleanup,
  loading,
}: SidebarProps) {
  const [searchValue, setSearchValue] = useState('');

  // Group sessions by project
  const grouped = useMemo(() => {
    const groups = new Map<string, SessionInfo[]>();
    for (const session of sessions) {
      const key = session.projectName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(session);
    }
    return groups;
  }, [sessions]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <input
          className="search-input"
          type="text"
          placeholder="세션 검색... (이름, 프롬프트, 프로젝트)"
          value={searchValue}
          onChange={handleSearchChange}
        />
        <div className="sidebar-actions">
          <button className="btn btn-primary" onClick={onNewSession}>
            + 새 세션
          </button>
          {selectedSessions.size > 0 && (
            <button className="btn" onClick={onBulkResume}>
              ▶ 선택 열기 ({selectedSessions.size})
            </button>
          )}
        </div>
        <div className="sidebar-actions">
          <button className="btn btn-sm" onClick={onGenerateNames} title="AI로 세션 이름 생성">
            🏷️ 이름 생성
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={async () => {
              const deleted = await onCleanup(30);
              alert(`${deleted}개 세션 정리됨 (30일 이상)`);
            }}
            title="30일 이상 된 세션 정리"
          >
            🗑️ 정리
          </button>
        </div>
      </div>

      <div className="session-list">
        {loading ? (
          <div className="empty-state">
            <p>세션 목록 불러오는 중...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <p>세션이 없습니다</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([project, items]) => (
            <div key={project}>
              <div className="session-group-label">{project}</div>
              {items.map(session => (
                <div
                  key={session.id}
                  className={`session-item ${selectedSessions.has(session.id) ? 'selected' : ''}`}
                  onDoubleClick={() => onResumeSession(session)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div
                      className={`checkbox ${selectedSessions.has(session.id) ? 'checked' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleSelect(session.id); }}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="session-name">
                        {session.name || session.id.slice(0, 8)}
                      </div>
                      <div className="session-prompt">{session.firstPrompt}</div>
                      <div className="session-meta">
                        <span className="session-project">{session.projectName}</span>
                        <span>{timeAgo(session.lastActivity)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
