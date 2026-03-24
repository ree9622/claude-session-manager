import React, { useState, useMemo } from 'react';
import { SessionInfo } from '../types';

type SortMode = 'project' | 'time';

interface SidebarProps {
  sessions: SessionInfo[];
  selectedSessions: Set<string>;
  onToggleSelect: (id: string) => void;
  onResumeSession: (session: SessionInfo) => void;
  onBulkResume: () => void;
  onSearch: (query: string) => void;
  onNewSession: () => void;
  onGenerateName: (session: SessionInfo) => void;
  onDeleteSession: (session: SessionInfo) => void;
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

function timeLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = diff / 3600000;
  if (hours < 24) return '오늘';
  if (hours < 48) return '어제';
  if (hours < 168) return '이번 주';
  if (hours < 720) return '이번 달';
  return '오래 전';
}

function SessionItem({
  session,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onResume,
  onGenerateName,
  onDelete,
  showProject,
}: {
  session: SessionInfo;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onResume: () => void;
  onGenerateName: () => void;
  onDelete: () => void;
  showProject: boolean;
}) {
  return (
    <div className={`session-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed row */}
      <div className="session-item-row" onClick={onToggleExpand}>
        <div
          className={`checkbox ${isSelected ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        />
        <div className="session-item-summary">
          <div className="session-name">
            {session.name || session.id.slice(0, 8)}
          </div>
          <div className="session-prompt">{session.firstPrompt}</div>
          {showProject && (
            <div className="session-item-meta">
              <span className="session-project-tag">{session.projectName}</span>
            </div>
          )}
        </div>
        <span className="session-time">{timeAgo(session.lastActivity)}</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="session-detail" onClick={e => e.stopPropagation()}>
          <div className="session-detail-info">
            <div className="session-detail-row">
              <span className="session-detail-label">ID</span>
              <span className="session-detail-value">{session.id.slice(0, 12)}...</span>
            </div>
            <div className="session-detail-row">
              <span className="session-detail-label">경로</span>
              <span className="session-detail-value">{session.projectName}</span>
            </div>
            <div className="session-detail-row">
              <span className="session-detail-label">메시지</span>
              <span className="session-detail-value">{session.messageCount}개+</span>
            </div>
            {session.firstPrompt && (
              <div className="session-detail-prompt">
                {session.firstPrompt}
              </div>
            )}
          </div>
          <div className="session-detail-actions" onClick={e => e.stopPropagation()}>
            <button className="btn btn-primary btn-sm" onClick={onResume}>
              ▶ 열기
            </button>
            <button
              className="btn btn-sm"
              onClick={onGenerateName}
              title="이 세션의 이름을 AI로 생성"
            >
              🏷️ 이름 생성
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (confirm('이 세션을 삭제할까요?')) onDelete();
              }}
              title="세션 삭제"
            >
              🗑️ 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  sessions,
  selectedSessions,
  onToggleSelect,
  onResumeSession,
  onBulkResume,
  onSearch,
  onNewSession,
  onGenerateName,
  onDeleteSession,
  onCleanup,
  loading,
}: SidebarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('project');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Group sessions by project
  const groupedByProject = useMemo(() => {
    const groups = new Map<string, SessionInfo[]>();
    for (const session of sessions) {
      const key = session.projectName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(session);
    }
    // Sort each group by time
    for (const items of groups.values()) {
      items.sort((a, b) => b.lastActivity - a.lastActivity);
    }
    return groups;
  }, [sessions]);

  // Group sessions by time period
  const groupedByTime = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.lastActivity - a.lastActivity);
    const groups = new Map<string, SessionInfo[]>();
    for (const session of sorted) {
      const key = timeLabel(session.lastActivity);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(session);
    }
    return groups;
  }, [sessions]);

  const groups = sortMode === 'project' ? groupedByProject : groupedByTime;

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

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
          {/* Sort toggle */}
          <div className="sort-toggle">
            <button
              className={`sort-btn ${sortMode === 'project' ? 'active' : ''}`}
              onClick={() => setSortMode('project')}
            >
              경로별
            </button>
            <button
              className={`sort-btn ${sortMode === 'time' ? 'active' : ''}`}
              onClick={() => setSortMode('time')}
            >
              시간별
            </button>
          </div>
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
          Array.from(groups.entries()).map(([groupKey, items]) => {
            const isCollapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey} className="session-group">
                <div
                  className="session-group-header"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <span className={`session-group-chevron ${isCollapsed ? 'collapsed' : ''}`}>
                    ▾
                  </span>
                  <span className="session-group-label">{groupKey}</span>
                  <span className="session-group-count">{items.length}</span>
                </div>
                {!isCollapsed && (
                  <div className="session-group-items">
                    {items.map(session => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isSelected={selectedSessions.has(session.id)}
                        isExpanded={expandedSession === session.id}
                        onToggleSelect={() => onToggleSelect(session.id)}
                        onToggleExpand={() =>
                          setExpandedSession(prev => prev === session.id ? null : session.id)
                        }
                        onResume={() => onResumeSession(session)}
                        onGenerateName={() => onGenerateName(session)}
                        onDelete={() => onDeleteSession(session)}
                        showProject={sortMode === 'time'}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
