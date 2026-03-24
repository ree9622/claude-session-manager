import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { TerminalGrid } from './components/TerminalGrid';
import { NewSessionModal } from './components/NewSessionModal';
import { SessionInfo, ActiveTerminal, ViewMode } from './types';

export function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeTerminals, setActiveTerminals] = useState<ActiveTerminal[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [focusedTerminal, setFocusedTerminal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewSession, setShowNewSession] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

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
    setSearchQuery(query);
    if (query.trim()) {
      const results = await window.api.sessions.search(query);
      setSessions(results);
    } else {
      loadSessions();
    }
  }, []);

  const handleResumeSession = useCallback(async (session: SessionInfo) => {
    const cwd = session.projectDir
      .replace(/^([A-Z])--/, '$1:\\')
      .replace(/--/g, '\\');

    const ptyId = await window.api.pty.create({
      sessionId: session.id,
      cwd,
      name: session.name || session.firstPrompt.slice(0, 40),
    });

    setActiveTerminals(prev => [...prev, {
      ptyId,
      sessionId: session.id,
      name: session.name || session.firstPrompt.slice(0, 40),
      cwd,
      status: 'running',
    }]);
  }, []);

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
      name: name || `New Session`,
      cwd,
      status: 'running',
    }]);
    setShowNewSession(false);
  }, []);

  const handleKillTerminal = useCallback(async (ptyId: string) => {
    await window.api.pty.kill(ptyId);
    setActiveTerminals(prev => prev.filter(t => t.ptyId !== ptyId));
    if (focusedTerminal === ptyId) {
      setFocusedTerminal(null);
    }
  }, [focusedTerminal]);

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

  const handleDeleteSession = useCallback(async (session: SessionInfo) => {
    const ok = await window.api.sessions.delete(session.id, session.projectDir);
    if (ok) {
      setSessions(prev => prev.filter(s => s.id !== session.id));
      setSelectedSessions(prev => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  }, []);

  const handleCleanup = useCallback(async (days: number) => {
    const deleted = await window.api.sessions.deleteOld(days);
    if (deleted > 0) {
      await loadSessions();
    }
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
    if (viewMode === 'thumbnail') {
      setViewMode('focus');
    }
  }, [viewMode]);

  return (
    <>
      <div className="titlebar">
        <h1>Claude Session Manager</h1>
      </div>
      <div className="app-layout">
        <Sidebar
          sessions={sessions}
          selectedSessions={selectedSessions}
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
          />
          <TerminalGrid
            terminals={activeTerminals}
            viewMode={viewMode}
            focusedTerminal={focusedTerminal}
            onFocusTerminal={handleFocusTerminal}
            onKillTerminal={handleKillTerminal}
            onTerminalExit={handleTerminalExit}
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
