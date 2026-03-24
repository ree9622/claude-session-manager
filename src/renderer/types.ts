export interface SessionInfo {
  id: string;
  projectDir: string;
  projectName: string;
  cwd: string;
  firstPrompt: string;
  lastActivity: number;
  messageCount: number;
  name?: string;
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
    };
  }
}
