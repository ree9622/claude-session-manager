export interface SessionInfo {
  id: string;
  projectDir: string;
  projectName: string;
  cwd: string;
  firstPrompt: string;
  lastActivity: number;
  messageCount: number;
  name?: string;
  favorite?: boolean;
  hidden?: boolean;
  pinned?: boolean;
}

export interface ActiveTerminal {
  ptyId: string;
  sessionId?: string;
  name: string;
  cwd: string;
  status: 'running' | 'exited';
}

export type ViewMode = 'thumbnail' | 'grid' | 'focus';

declare global {
  interface Window {
    api: {
      sessions: {
        list: () => Promise<SessionInfo[]>;
        search: (query: string) => Promise<SessionInfo[]>;
        getDetails: (sessionId: string, projectDir: string) => Promise<any>;
        generateName: (sessionId: string, projectDir: string) => Promise<string>;
        deleteOld: (daysOld: number) => Promise<number>;
        delete: (sessionId: string, projectDir: string) => Promise<boolean>;
        toggleFavorite: (id: string) => Promise<boolean>;
        toggleHidden: (id: string) => Promise<boolean>;
        togglePinned: (id: string) => Promise<boolean>;
        listPinned: () => Promise<string[]>;
      };
      pty: {
        create: (options: { sessionId?: string; cwd?: string; name?: string }) => Promise<string>;
        write: (id: string, data: string) => void;
        resize: (id: string, cols: number, rows: number) => void;
        kill: (id: string) => void;
        killAll: () => void;
        list: () => Promise<any[]>;
        onData: (id: string, callback: (data: string) => void) => () => void;
        onExit: (id: string, callback: (exitCode: number) => void) => () => void;
      };
      state: {
        save: (terminals: Array<{ sessionId?: string; name: string; cwd: string }>) => Promise<void>;
        load: () => Promise<Array<{ sessionId?: string; name: string; cwd: string }>>;
      };
      log: {
        getRecent: (lines?: number) => Promise<string>;
        getPath: () => Promise<string>;
      };
      openExternal: (url: string) => void;
      openDirectoryDialog: () => Promise<string | null>;
      updater: {
        install: () => Promise<void>;
        onStatus: (callback: (status: any) => void) => () => void;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        getAll: () => Promise<Record<string, any>>;
        onChange: (callback: (data: { key: string; value: any }) => void) => () => void;
      };
      nameActiveSessions?: (sessionIds: string[]) => Promise<Record<string, string>>;
      onNamingStart?: (callback: (data: { total: number; reason?: string }) => void) => void;
      onNamingProgress?: (callback: (data: { done: number; total: number; name: string }) => void) => void;
      onNamingDone?: (callback: () => void) => void;
      onNamesChanged?: (callback: () => void) => void;
      onFirstRun?: (callback: () => void) => void;
      onSessionDetected?: (callback: (data: { ptyId: string; sessionId: string }) => void) => void;
    };
  }
}
