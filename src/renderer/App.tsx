import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { TerminalGrid } from './components/TerminalGrid';
import { NewSessionModal } from './components/NewSessionModal';
import { SessionInfo, ActiveTerminal, ViewMode } from './types';
import { t, getLang, setLang } from './i18n';

export function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeTerminals, setActiveTerminals] = useState<ActiveTerminal[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [focusedTerminal, setFocusedTerminal] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lang, setLangState] = useState(getLang());
  const [loading, setLoading] = useState(true);

  const handleLangChange = useCallback(() => {
    const next = lang === 'ko' ? 'en' : 'ko';
    setLang(next);
    setLangState(next);
  }, [lang]);

  useEffect(() => {
    loadSessions();
    restoreSavedTerminals();
  }, []);

  // Auto-save state whenever activeTerminals changes
  useEffect(() => {
    const toSave = activeTerminals
      .filter(t => t.status === 'running')
      .map(t => ({ sessionId: t.sessionId, name: t.name, cwd: t.cwd }));
    window.api.state.save(toSave);
  }, [activeTerminals]);

  const restoreSavedTerminals = async () => {
    try {
      const saved = await window.api.state.load();
      if (saved.length === 0) return;
      for (const t of saved) {
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

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim()) {
      const results = await window.api.sessions.search(query);
      setSessions(results);
    } else {
      loadSessions();
    }
  }, []);

  const handleResumeSession = useCallback(async (session: SessionInfo) => {
    // Prevent duplicate: check if this session is already open
    const alreadyOpen = activeTerminals.find(
      t => t.sessionId === session.id && t.status === 'running'
    );
    if (alreadyOpen) {
      // Focus the existing one instead
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
  }, [activeTerminals]);

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
    await window.api.pty.kill(ptyId);
    setActiveTerminals(prev => prev.filter(t => t.ptyId !== ptyId));
    if (focusedTerminal === ptyId) setFocusedTerminal(null);
  }, [focusedTerminal]);

  const handleCloseAll = useCallback(async () => {
    await window.api.pty.killAll();
    setActiveTerminals([]);
    setFocusedTerminal(null);
  }, []);

  const handleTerminalExit = useCallback((ptyId: string) => {
    setActiveTerminals(prev =>
      prev.map(t => t.ptyId === ptyId ? { ...t, status: 'exited' as const } : t)
    );
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

  // 2) Delete session → also kill from grid if active
  const handleDeleteSession = useCallback(async (session: SessionInfo) => {
    const ok = await window.api.sessions.delete(session.id, session.projectDir);
    if (ok) {
      setSessions(prev => prev.filter(s => s.id !== session.id));
      setSelectedSessions(prev => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
      // Kill any active terminal using this session
      setActiveTerminals(prev => {
        const toKill = prev.filter(t => t.sessionId === session.id);
        toKill.forEach(t => window.api.pty.kill(t.ptyId));
        return prev.filter(t => t.sessionId !== session.id);
      });
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

  // 3) DnD reorder
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
        <h1>{t('app.title')}</h1>
      </div>
      <div className="app-layout">
        <Sidebar
          sessions={sessions}
          selectedSessions={selectedSessions}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
          onToggleSelect={toggleSessionSelection}
          onResumeSession={handleResumeSession}
          onBulkResume={handleBulkResume}
          onSearch={handleSearch}
          onNewSession={() => setShowNewSession(true)}
          onGenerateName={handleGenerateName}
          onDeleteSession={handleDeleteSession}
          onCleanup={handleCleanup}
          loading={loading}
        />
        <div className="main-content">
          <Toolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeCount={activeTerminals.length}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(p => !p)}
            onLangChange={handleLangChange}
            onCloseAll={handleCloseAll}
          />
          <TerminalGrid
            terminals={activeTerminals}
            viewMode={viewMode}
            focusedTerminal={focusedTerminal}
            onFocusTerminal={handleFocusTerminal}
            onKillTerminal={handleKillTerminal}
            onTerminalExit={handleTerminalExit}
            onReorder={handleReorderTerminals}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {showNewSession && (
        <NewSessionModal
          onSubmit={handleNewSession}
          onClose={() => setShowNewSession(false)}
        />
      )}
    </>
  );
}
