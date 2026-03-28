import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { TerminalGrid } from './components/TerminalGrid';
import { NewSessionModal } from './components/NewSessionModal';
import { SettingsModal } from './components/SettingsModal';
import { UpdateBanner } from './components/UpdateBanner';
import { TerminalRestoringSkeleton } from './components/Skeleton';
import { SessionInfo, ActiveTerminal, ViewMode } from './types';
import { t, getLang, setLang } from './i18n';

export function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeTerminals, setActiveTerminals] = useState<ActiveTerminal[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [viewMode, setViewModeRaw] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('viewMode') as ViewMode) || 'grid'; } catch { return 'grid'; }
  });
  const [focusedTerminal, setFocusedTerminal] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  });
  const [gridColumns, setGridColumns] = useState(() => {
    try { return parseInt(localStorage.getItem('gridColumns') || '0', 10); } catch { return 0; }
  });

  // Settings-driven state
  const [fontSize, setFontSize] = useState(13);
  const [scrollback, setScrollback] = useState(5000);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('sidebarWidth') || '320', 10); } catch { return 320; }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load settings on mount
  useEffect(() => {
    window.api.settings.getAll().then((all: any) => {
      if (all.fontSize) setFontSize(all.fontSize);
      if (all.scrollback) setScrollback(all.scrollback);
      if (all.sidebarWidth) setSidebarWidth(all.sidebarWidth);
      if (all.notifications !== undefined) setNotificationsEnabled(all.notifications);
    });

    const unsub = window.api.settings.onChange(({ key, value }) => {
      if (key === 'fontSize') setFontSize(value);
      if (key === 'scrollback') setScrollback(value);
      if (key === 'sidebarWidth') setSidebarWidth(value);
      if (key === 'notifications') setNotificationsEnabled(value);
    });
    return unsub;
  }, []);

  // Keyboard shortcuts: Ctrl+/- for font size
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const next = Math.min(24, fontSize + 1);
        setFontSize(next);
        window.api.settings.set('fontSize', next);
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        const next = Math.max(8, fontSize - 1);
        setFontSize(next);
        window.api.settings.set('fontSize', next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fontSize]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    try { localStorage.setItem('viewMode', mode); } catch {}
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      return next;
    });
  }, []);
  const changeGridColumns = useCallback((cols: number) => {
    setGridColumns(cols);
    try { localStorage.setItem('gridColumns', String(cols)); } catch {}
  }, []);
  const [lang, setLangState] = useState(getLang());
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreCount, setRestoreCount] = useState(0);

  const handleLangChange = useCallback(() => {
    const next = lang === 'ko' ? 'en' : 'ko';
    setLang(next);
    setLangState(next);
    window.api.settings.set('lang', next);
  }, [lang]);

  // Sidebar drag resize
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(200, Math.min(window.innerWidth * 0.5, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // Persist sidebar width on change (debounced)
  const sidebarSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sidebarSaveTimer.current) clearTimeout(sidebarSaveTimer.current);
    sidebarSaveTimer.current = setTimeout(() => {
      localStorage.setItem('sidebarWidth', String(sidebarWidth));
      window.api.settings.set('sidebarWidth', sidebarWidth);
    }, 300);
  }, [sidebarWidth]);

  // Naming overlay
  const [namingState, setNamingState] = useState<{ active: boolean; done: number; total: number; name: string; reason: string }>({
    active: false, done: 0, total: 0, name: '', reason: '',
  });

  useEffect(() => {
    window.api.onNamingStart?.((data: { total: number; reason?: string }) => {
      setNamingState({ active: true, done: 0, total: data.total, name: '', reason: data.reason || 'manual' });
    });
    window.api.onNamingProgress?.((data: { done: number; total: number; name: string }) => {
      setNamingState(prev => ({ ...prev, done: data.done, total: data.total, name: data.name }));
    });
    window.api.onNamingDone?.(() => {
      setNamingState({ active: false, done: 0, total: 0, name: '', reason: '' });
    });
  }, []);

  // Auto-refresh sidebar when session-names.json changes (e.g., /name-session skill)
  useEffect(() => {
    window.api.onNamesChanged?.(() => {
      loadSessions();
    });
  }, []);

  // First run notice
  useEffect(() => {
    window.api.onFirstRun?.(() => {
      const msg = lang === 'ko'
        ? '클로드 세션 매니저에 오신 걸 환영합니다!\n\n닫기(X) 버튼을 누르면 앱이 종료되지 않고 시스템 트레이로 최소화됩니다.\n트레이 아이콘을 클릭하면 다시 열 수 있고, 우클릭 → 종료로 완전히 끌 수 있습니다.\n\n이 동작은 트레이 우클릭 메뉴에서 변경할 수 있습니다.'
        : 'Welcome to Claude Session Manager!\n\nClosing the window minimizes to system tray instead of quitting.\nClick the tray icon to show/hide. Right-click → Quit to exit.\n\nYou can change this behavior from the tray context menu.';
      alert(msg);
    });
  }, []);

  // "User intent" — the sessions the user wants open, independent of PTY state.
  const savedSessionsRef = useRef<Array<{ sessionId?: string; name: string; cwd: string }>>([]);

  const saveState = useCallback(() => {
    window.api.state.save(savedSessionsRef.current);
  }, []);

  const trackOpen = useCallback((t: { sessionId?: string; name: string; cwd: string }) => {
    if (!t.sessionId) return;
    savedSessionsRef.current = [
      ...savedSessionsRef.current.filter(s => s.sessionId !== t.sessionId),
      t,
    ];
    saveState();
  }, [saveState]);

  const trackClose = useCallback((sessionId?: string) => {
    if (!sessionId) return;
    savedSessionsRef.current = savedSessionsRef.current.filter(s => s.sessionId !== sessionId);
    saveState();
  }, [saveState]);

  const trackCloseAll = useCallback(() => {
    savedSessionsRef.current = [];
    saveState();
  }, [saveState]);

  useEffect(() => {
    const interval = setInterval(saveState, 10000);
    return () => clearInterval(interval);
  }, [saveState]);

  // Detect session ID for newly created sessions
  useEffect(() => {
    window.api.onSessionDetected?.((data: { ptyId: string; sessionId: string }) => {
      setActiveTerminals(prev => {
        const target = prev.find(t => t.ptyId === data.ptyId && !t.sessionId);
        if (target) {
          trackOpen({ sessionId: data.sessionId, name: target.name, cwd: target.cwd });
        }
        return prev.map(t =>
          t.ptyId === data.ptyId && !t.sessionId
            ? { ...t, sessionId: data.sessionId }
            : t
        );
      });
      loadSessions();
    });
  }, [trackOpen]);

  useEffect(() => {
    loadSessions();
    restoreSavedTerminals().then(() => restorePinnedSessions());
  }, []);

  const restoreSavedTerminals = async () => {
    try {
      const saved = await window.api.state.load();
      const resumable = saved.filter(t => t.sessionId);
      if (resumable.length === 0) return;

      setRestoring(true);
      setRestoreCount(resumable.length);
      savedSessionsRef.current = resumable;

      for (const t of resumable) {
        const ptyId = await window.api.pty.create({
          sessionId: t.sessionId,
          cwd: t.cwd,
          name: t.name,
        });
        setActiveTerminals(prev => [...prev, {
          ptyId,
          sessionId: t.sessionId,
          name: t.name,
          cwd: t.cwd,
          status: 'running',
        }]);
      }
    } catch (err) {
      console.error('[restore] Failed:', err);
    } finally {
      setRestoring(false);
    }
  };

  // Auto-restore pinned sessions not already open
  const restorePinnedSessions = async () => {
    try {
      const pinnedIds = await window.api.sessions.listPinned();
      if (pinnedIds.length === 0) return;

      const allSessions = await window.api.sessions.list();
      for (const id of pinnedIds) {
        // Skip if already open from state restore
        setActiveTerminals(prev => {
          const alreadyOpen = prev.find(t => t.sessionId === id && t.status === 'running');
          return prev; // just checking, don't mutate
        });

        const session = allSessions.find(s => s.id === id);
        if (session) {
          // Check again outside setState
          const currentTerminals = await new Promise<ActiveTerminal[]>(resolve => {
            setActiveTerminals(prev => { resolve(prev); return prev; });
          });
          if (!currentTerminals.find(t => t.sessionId === id && t.status === 'running')) {
            const name = session.name || session.firstPrompt.slice(0, 40);
            const ptyId = await window.api.pty.create({
              sessionId: session.id,
              cwd: session.cwd,
              name,
            });
            setActiveTerminals(prev => [...prev, {
              ptyId,
              sessionId: session.id,
              name,
              cwd: session.cwd,
              status: 'running',
            }]);
            trackOpen({ sessionId: session.id, name, cwd: session.cwd });
          }
        }
      }
    } catch (err) {
      console.error('[pin-restore] Failed:', err);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const list = await window.api.sessions.list();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
    setLoading(false);
  };

  const activeSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of activeTerminals) {
      if (t.sessionId && t.status === 'running') ids.add(t.sessionId);
    }
    return ids;
  }, [activeTerminals]);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim()) {
      const results = await window.api.sessions.search(query);
      setSessions(results);
    } else {
      loadSessions();
    }
  }, []);

  const handleResumeSession = useCallback(async (session: SessionInfo) => {
    const alreadyOpen = activeTerminals.find(
      t => t.sessionId === session.id && t.status === 'running'
    );
    if (alreadyOpen) {
      setFocusedTerminal(alreadyOpen.ptyId);
      return;
    }

    const name = session.name || session.firstPrompt.slice(0, 40);
    const ptyId = await window.api.pty.create({
      sessionId: session.id,
      cwd: session.cwd,
      name,
    });
    setActiveTerminals(prev => [...prev, {
      ptyId,
      sessionId: session.id,
      name,
      cwd: session.cwd,
      status: 'running',
    }]);
    trackOpen({ sessionId: session.id, name, cwd: session.cwd });
  }, [activeTerminals, trackOpen]);

  const handleBulkResume = useCallback(async () => {
    const toResume = sessions.filter(s => selectedSessions.has(s.id));
    for (const session of toResume) {
      await handleResumeSession(session);
    }
    setSelectedSessions(new Set());
  }, [sessions, selectedSessions, handleResumeSession]);

  const handleNewSession = useCallback(async (cwd: string, name: string) => {
    const ptyId = await window.api.pty.create({ cwd, name });
    setActiveTerminals(prev => [...prev, {
      ptyId,
      name: name || 'New Session',
      cwd,
      status: 'running',
    }]);
    setShowNewSession(false);
  }, []);

  const handleKillTerminal = useCallback(async (ptyId: string) => {
    const terminal = activeTerminals.find(t => t.ptyId === ptyId);
    await window.api.pty.kill(ptyId);
    setActiveTerminals(prev => prev.filter(t => t.ptyId !== ptyId));
    if (focusedTerminal === ptyId) setFocusedTerminal(null);
    trackClose(terminal?.sessionId);
  }, [focusedTerminal, activeTerminals, trackClose]);

  const handleCloseAll = useCallback(async () => {
    await window.api.pty.killAll();
    setActiveTerminals([]);
    setFocusedTerminal(null);
    trackCloseAll();
  }, [trackCloseAll]);

  const [manualNaming, setManualNaming] = useState(false);
  const handleNameAll = useCallback(async () => {
    const sessionIds = activeTerminals
      .filter(t => t.sessionId && t.status === 'running')
      .map(t => t.sessionId!);
    if (sessionIds.length === 0) return;
    setManualNaming(true);
    try {
      const nameMap: Record<string, string> = await window.api.nameActiveSessions!(sessionIds);
      setActiveTerminals(prev => prev.map(t =>
        t.sessionId && nameMap[t.sessionId] ? { ...t, name: nameMap[t.sessionId] } : t
      ));
      savedSessionsRef.current = savedSessionsRef.current.map(s =>
        s.sessionId && nameMap[s.sessionId] ? { ...s, name: nameMap[s.sessionId] } : s
      );
      saveState();
      await loadSessions();
    } finally {
      setManualNaming(false);
    }
  }, [activeTerminals, saveState]);

  const handleRenameTerminal = useCallback((ptyId: string, newName: string) => {
    setActiveTerminals(prev => prev.map(t =>
      t.ptyId === ptyId ? { ...t, name: newName } : t
    ));
    const terminal = activeTerminals.find(t => t.ptyId === ptyId);
    if (terminal?.sessionId) {
      savedSessionsRef.current = savedSessionsRef.current.map(s =>
        s.sessionId === terminal.sessionId ? { ...s, name: newName } : s
      );
      saveState();
    }
  }, [activeTerminals, saveState]);

  const handleTerminalExit = useCallback((ptyId: string) => {
    setActiveTerminals(prev =>
      prev.map(t => t.ptyId === ptyId ? { ...t, status: 'exited' as const } : t)
    );
  }, []);

  const handleToggleFavorite = useCallback(async (session: SessionInfo) => {
    const val = await window.api.sessions.toggleFavorite(session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, favorite: val } : s));
  }, []);

  const handleToggleHidden = useCallback(async (session: SessionInfo) => {
    const val = await window.api.sessions.toggleHidden(session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, hidden: val } : s));
  }, []);

  const handleTogglePinned = useCallback(async (session: SessionInfo) => {
    const val = await window.api.sessions.togglePinned(session.id);
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, pinned: val } : s));
  }, []);

  const handleGenerateName = useCallback(async (session: SessionInfo) => {
    try {
      const name = await window.api.sessions.generateName(session.id, session.projectDir);
      setSessions(prev =>
        prev.map(s => s.id === session.id ? { ...s, name } : s)
      );
    } catch (err) {
      console.error('Failed to generate name:', err);
    }
  }, []);

  const handleDeleteSession = useCallback(async (session: SessionInfo) => {
    const ok = await window.api.sessions.delete(session.id, session.projectDir);
    if (ok) {
      setSessions(prev => prev.filter(s => s.id !== session.id));
      setSelectedSessions(prev => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
      setActiveTerminals(prev => {
        const toKill = prev.filter(t => t.sessionId === session.id);
        toKill.forEach(t => window.api.pty.kill(t.ptyId));
        return prev.filter(t => t.sessionId !== session.id);
      });
      trackClose(session.id);
    }
  }, []);

  const handleCleanup = useCallback(async (days: number) => {
    const deleted = await window.api.sessions.deleteOld(days);
    if (deleted > 0) await loadSessions();
    return deleted;
  }, []);

  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const handleFocusTerminal = useCallback((ptyId: string) => {
    setFocusedTerminal(ptyId);
  }, []);

  const handleReorderTerminals = useCallback((fromIndex: number, toIndex: number) => {
    setActiveTerminals(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return (
    <>
      <div className="titlebar">
        <h1>{t('app.title')} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>v{APP_VERSION}</span></h1>
      </div>
      <UpdateBanner />
      <div className="app-layout">
        <Sidebar
          sessions={sessions}
          selectedSessions={selectedSessions}
          activeSessionIds={activeSessionIds}
          collapsed={sidebarCollapsed}
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
          onToggleCollapse={toggleSidebar}
          onToggleSelect={toggleSessionSelection}
          onResumeSession={handleResumeSession}
          onBulkResume={handleBulkResume}
          onSearch={handleSearch}
          onNewSession={() => setShowNewSession(true)}
          onGenerateName={handleGenerateName}
          onToggleFavorite={handleToggleFavorite}
          onToggleHidden={handleToggleHidden}
          onTogglePinned={handleTogglePinned}
          onDeleteSession={handleDeleteSession}
          onRefresh={loadSessions}
          onCleanup={handleCleanup}
          loading={loading}
        />
        {!sidebarCollapsed && (
          <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} />
        )}
        <div className="main-content">
          <Toolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeCount={activeTerminals.length}
            sidebarCollapsed={sidebarCollapsed}
            gridColumns={gridColumns}
            onGridColumnsChange={changeGridColumns}
            onToggleSidebar={toggleSidebar}
            onLangChange={handleLangChange}
            onCloseAll={handleCloseAll}
            onNewSession={() => setShowNewSession(true)}
            onNameAll={handleNameAll}
            naming={manualNaming}
            onOpenSettings={() => setShowSettings(true)}
          />
          {restoring && activeTerminals.length === 0 ? (
            <div className="terminal-area">
              <TerminalRestoringSkeleton count={restoreCount} />
            </div>
          ) : (
          <TerminalGrid
            terminals={activeTerminals}
            viewMode={viewMode}
            focusedTerminal={focusedTerminal}
            gridColumns={gridColumns}
            fontSize={fontSize}
            scrollback={scrollback}
            notificationsEnabled={notificationsEnabled}
            onFocusTerminal={handleFocusTerminal}
            onKillTerminal={handleKillTerminal}
            onTerminalExit={handleTerminalExit}
            onReorder={handleReorderTerminals}
            onRenameTerminal={handleRenameTerminal}
            onViewModeChange={setViewMode}
            onNewSession={() => setShowNewSession(true)}
          />
          )}
        </div>
      </div>

      {showNewSession && (
        <NewSessionModal
          onSubmit={handleNewSession}
          onClose={() => setShowNewSession(false)}
          sessions={sessions}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {namingState.active && (
        <div className="naming-overlay">
          <div className="naming-content">
            <div className="naming-spinner" />
            <div className="naming-title">{t(namingState.reason === 'quit' ? 'naming.titleQuit' : 'naming.title')}</div>
            <div className="naming-progress">{namingState.done} / {namingState.total}</div>
            {namingState.name && <div className="naming-current">{namingState.name}</div>}
          </div>
        </div>
      )}
    </>
  );
}
