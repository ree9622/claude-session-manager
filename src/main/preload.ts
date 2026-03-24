import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Session management
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    search: (query: string) => ipcRenderer.invoke('sessions:search', query),
    getDetails: (sessionId: string, projectDir: string) =>
      ipcRenderer.invoke('sessions:get-details', sessionId, projectDir),
    generateName: (sessionId: string, projectDir: string) =>
      ipcRenderer.invoke('sessions:generate-name', sessionId, projectDir),
    deleteOld: (daysOld: number) => ipcRenderer.invoke('sessions:delete-old', daysOld),
    delete: (sessionId: string, projectDir: string) =>
      ipcRenderer.invoke('sessions:delete', sessionId, projectDir),
  },

  // PTY management
  pty: {
    create: (options: { sessionId?: string; cwd?: string; name?: string }) =>
      ipcRenderer.invoke('pty:create', options),
    write: (id: string, data: string) => ipcRenderer.invoke('pty:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('pty:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('pty:kill', id),
    killAll: () => ipcRenderer.invoke('pty:kill-all'),
    list: () => ipcRenderer.invoke('pty:list'),
    onData: (id: string, callback: (data: string) => void) => {
      const listener = (_event: any, data: string) => callback(data);
      ipcRenderer.on(`pty:data:${id}`, listener);
      return () => ipcRenderer.removeListener(`pty:data:${id}`, listener);
    },
    onExit: (id: string, callback: (exitCode: number) => void) => {
      const listener = (_event: any, exitCode: number) => callback(exitCode);
      ipcRenderer.on(`pty:exit:${id}`, listener);
      return () => ipcRenderer.removeListener(`pty:exit:${id}`, listener);
    },
  },

  // State persistence
  state: {
    save: (terminals: Array<{ sessionId?: string; name: string; cwd: string }>) =>
      ipcRenderer.invoke('state:save', terminals),
    load: () => ipcRenderer.invoke('state:load') as Promise<Array<{ sessionId?: string; name: string; cwd: string }>>,
  },

  // Logging
  log: {
    getRecent: (lines: number = 100) => ipcRenderer.invoke('log:get-recent', lines) as Promise<string>,
    getPath: () => ipcRenderer.invoke('log:get-path') as Promise<string>,
  },

  // Shell & Dialog
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory') as Promise<string | null>,

  // Updater
  updater: {
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: any) => void) => {
      const listener = (_event: any, status: any) => callback(status);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },

  // First run
  onFirstRun: (callback: () => void) => {
    ipcRenderer.on('first-run', () => callback());
  },
});
