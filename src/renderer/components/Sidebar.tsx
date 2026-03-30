import React, { useState, useMemo } from 'react';
import { SessionInfo } from '../types';
import { t } from '../i18n';
import { SessionListSkeleton } from './Skeleton';

type SortMode = 'project' | 'time';

interface SidebarProps {
  sessions: SessionInfo[];
  selectedSessions: Set<string>;
  activeSessionIds: Set<string>;
  collapsed: boolean;
  style?: React.CSSProperties;
  onToggleCollapse: () => void;
  onToggleSelect: (id: string) => void;
  onResumeSession: (session: SessionInfo) => void;
  onBulkResume: () => void;
  onSearch: (query: string) => void;
  onNewSession: () => void;
  onGenerateName: (session: SessionInfo) => void;
  onDeleteSession: (session: SessionInfo) => void;
  onCloseSession: (session: SessionInfo) => void;
  onToggleFavorite: (session: SessionInfo) => void;
  onToggleHidden: (session: SessionInfo) => void;
  onTogglePinned: (session: SessionInfo) => void;
  onRefresh: () => void;
  onCleanup: (days: number) => Promise<number>;
  loading: boolean;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('time.now');
  if (minutes < 60) return t('time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('time.days', { n: days });
  return t('time.months', { n: Math.floor(days / 30) });
}

function timeLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = diff / 3600000;
  if (hours < 24) return t('time.today');
  if (hours < 48) return t('time.yesterday');
  if (hours < 168) return t('time.thisWeek');
  if (hours < 720) return t('time.thisMonth');
  return t('time.older');
}

function SessionItem({
  session, isSelected, isExpanded, isActive,
  onToggleSelect, onToggleExpand, onResume, onClose, onGenerateName, onDelete,
  onToggleFavorite, onToggleHidden, showProject,
}: {
  session: SessionInfo; isSelected: boolean; isExpanded: boolean; isActive: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onResume: () => void; onClose: () => void; onGenerateName: () => void; onDelete: () => void;
  onToggleFavorite: () => void; onToggleHidden: () => void; onTogglePinned: () => void;
  showProject: boolean;
}) {
  return (
    <div className={`session-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}>
      <div className="session-item-row" onClick={onToggleSelect}>
        <div className={`checkbox ${isSelected ? 'checked' : ''}`} />
        <div className="session-item-summary">
          <div className="session-name">{isActive ? '● ' : ''}{session.pinned ? '📌 ' : ''}{session.favorite ? '★ ' : ''}{session.name || session.id.slice(0, 8)}</div>
          <div className="session-prompt">{session.firstPrompt}</div>
          {showProject && (
            <div className="session-item-meta">
              <span className="session-project-tag">{session.projectName}</span>
            </div>
          )}
        </div>
        <button
          className={`pin-toggle ${session.pinned ? 'is-pinned' : ''}`}
          onClick={e => { e.stopPropagation(); onTogglePinned(); }}
          title={session.pinned ? t('session.unpin') : t('session.pin')}
        >
          📌
        </button>
        <button
          className={`favorite-toggle ${session.favorite ? 'is-favorite' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
          title={t('session.favorite')}
        >
          {session.favorite ? '★' : '☆'}
        </button>
        <div className="session-item-actions" onClick={e => e.stopPropagation()}>
          <button className="btn btn-sm session-action-btn" onClick={isActive ? onClose : onResume}>{isActive ? t('session.close') : t('session.open')}</button>
          <button className="btn btn-sm session-action-btn session-delete-btn" onClick={() => { if (confirm(t('session.deleteConfirm'))) onDelete(); }} title={t('session.delete')}>✕</button>
          <button className="btn btn-sm session-action-btn" onClick={onToggleExpand}>{isExpanded ? '−' : '+'}</button>
        </div>
        <span className="session-time">{timeAgo(session.lastActivity)}</span>
      </div>

      {isExpanded && (
        <div className="session-detail" onClick={e => e.stopPropagation()}>
          <div className="session-detail-info">
            <div className="session-detail-row">
              <span className="session-detail-label">ID</span>
              <span className="session-detail-value">{session.id.slice(0, 12)}...</span>
            </div>
            <div className="session-detail-row">
              <span className="session-detail-label">{t('detail.path')}</span>
              <span className="session-detail-value">{session.projectName}</span>
            </div>
            <div className="session-detail-row">
              <span className="session-detail-label">{t('detail.messages')}</span>
              <span className="session-detail-value">{t('session.messages', { n: session.messageCount })}</span>
            </div>
            {session.firstPrompt && (
              <div className="session-detail-prompt">{session.firstPrompt}</div>
            )}
          </div>
          <div className="session-detail-actions" onClick={e => e.stopPropagation()}>
            <button className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-primary'}`} onClick={isActive ? onClose : onResume}>{isActive ? `■ ${t('session.close')}` : `▶ ${t('session.open')}`}</button>
            <button className="btn btn-sm" onClick={onGenerateName}>🏷️ {t('session.generateName')}</button>
            <button className="btn btn-sm" onClick={onToggleFavorite}>
              {session.favorite ? '★' : '☆'} {t('session.favorite')}
            </button>
            <button className="btn btn-sm" onClick={onTogglePinned}>
              📌 {session.pinned ? t('session.unpin') : t('session.pin')}
            </button>
            <button className="btn btn-sm" onClick={onToggleHidden}>
              {t('session.hide')}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(t('session.deleteConfirm'))) onDelete(); }}>
              🗑️ {t('session.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  sessions, selectedSessions, activeSessionIds, collapsed, style, onToggleCollapse,
  onToggleSelect, onResumeSession, onBulkResume, onSearch,
  onNewSession, onGenerateName, onDeleteSession, onCloseSession, onToggleFavorite, onToggleHidden, onTogglePinned, onRefresh, onCleanup, loading,
}: SidebarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [showHidden, setShowHidden] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Filter hidden, filter favorites, sort favorites first
  const filteredSessions = useMemo(() => {
    let list = showHidden ? sessions : sessions.filter(s => !s.hidden);
    if (showFavoritesOnly) list = list.filter(s => s.favorite);
    // Pinned first, then favorites
    list = [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return 0;
    });
    return list;
  }, [sessions, showHidden, showFavoritesOnly]);

  const hiddenCount = useMemo(() => sessions.filter(s => s.hidden).length, [sessions]);
  const favoriteCount = useMemo(() => sessions.filter(s => s.favorite).length, [sessions]);

  const groupedByProject = useMemo(() => {
    const groups = new Map<string, SessionInfo[]>();
    for (const s of filteredSessions) {
      if (!groups.has(s.projectName)) groups.set(s.projectName, []);
      groups.get(s.projectName)!.push(s);
    }
    for (const items of groups.values()) items.sort((a, b) => b.lastActivity - a.lastActivity);
    return groups;
  }, [filteredSessions]);

  const groupedByTime = useMemo(() => {
    const sorted = [...filteredSessions].sort((a, b) => b.lastActivity - a.lastActivity);
    const groups = new Map<string, SessionInfo[]>();
    for (const s of sorted) {
      const key = timeLabel(s.lastActivity);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return groups;
  }, [filteredSessions]);

  const groups = sortMode === 'project' ? groupedByProject : groupedByTime;

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (collapsed) return <div className="sidebar sidebar-collapsed" />;

  return (
    <div className="sidebar" style={style}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            className="search-input"
            type="text"
            placeholder={t('sidebar.search')}
            value={searchValue}
            onChange={e => { setSearchValue(e.target.value); onSearch(e.target.value); }}
            style={{ flex: 1 }}
          />
          <button className="btn-icon" onClick={onRefresh} title={t('sidebar.refresh')}>↻</button>
          <button className="btn-icon sidebar-toggle" onClick={onToggleCollapse} title={t('sidebar.collapse')}>◀</button>
        </div>
        <div className="sidebar-actions">
          {selectedSessions.size > 0 && (
            <button className="btn" onClick={onBulkResume}>▶ {t('sidebar.openSelected')} ({selectedSessions.size})</button>
          )}
        </div>
        <div className="sidebar-actions">
          <div className="sort-toggle">
            <button className={`sort-btn ${sortMode === 'time' ? 'active' : ''}`} onClick={() => setSortMode('time')}>{t('sidebar.sortTime')}</button>
            <button className={`sort-btn ${sortMode === 'project' ? 'active' : ''}`} onClick={() => setSortMode('project')}>{t('sidebar.sortProject')}</button>
          </div>
          {favoriteCount > 0 && (
            <button className={`btn btn-sm ${showFavoritesOnly ? 'btn-favorite-active' : ''}`} onClick={() => setShowFavoritesOnly(p => !p)}>
              ★ {t('sidebar.favorites')} ({favoriteCount})
            </button>
          )}
          <button className="btn btn-sm btn-danger" onClick={async () => {
            const deleted = await onCleanup(30);
            alert(t('sidebar.cleanupResult', { n: deleted }));
          }}>🗑️ {t('sidebar.cleanup')}</button>
          {hiddenCount > 0 && (
            <button className={`btn btn-sm ${showHidden ? 'btn-primary' : ''}`} onClick={() => setShowHidden(p => !p)}>
              {t('sidebar.showHidden')} ({hiddenCount})
            </button>
          )}
        </div>
      </div>

      <div className="session-list">
        {loading ? (
          <SessionListSkeleton />
        ) : sessions.length === 0 ? (
          <div className="empty-state"><p>{t('sidebar.noSessions')}</p></div>
        ) : (
          Array.from(groups.entries()).map(([groupKey, items]) => {
            const isCollapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey} className="session-group">
                <div className="session-group-header" onClick={() => toggleGroup(groupKey)}>
                  <span className={`session-group-chevron ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
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
                        isActive={activeSessionIds.has(session.id)}
                        onToggleSelect={() => onToggleSelect(session.id)}
                        onToggleExpand={() => setExpandedSession(prev => prev === session.id ? null : session.id)}
                        onResume={() => onResumeSession(session)}
                        onClose={() => onCloseSession(session)}
                        onGenerateName={() => onGenerateName(session)}
                        onDelete={() => onDeleteSession(session)}
                        onToggleFavorite={() => onToggleFavorite(session)}
                        onToggleHidden={() => onToggleHidden(session)}
                        onTogglePinned={() => onTogglePinned(session)}
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
