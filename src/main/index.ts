import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { PtyManager } from './pty-manager';
import { SessionParser } from './session-parser';
import { stateStore, SavedTerminal } from './state-store';
import { logger } from './logger';

let mainWindow: BrowserWindow | null = null;
const ptyManager = new PtyManager();
const sessionParser = new SessionParser();

function createWindow() {
  logger.info('app', 'Creating main window');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#9ca3af',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- IPC Handlers ---

// Session management
ipcMain.handle('sessions:list', async () => {
  return sessionParser.listSessions();
});

ipcMain.handle('sessions:search', async (_e, query: string) => {
  return sessionParser.searchSessions(query);
});

ipcMain.handle('sessions:get-details', async (_e, sessionId: string, projectDir: string) => {
  return sessionParser.getSessionDetails(sessionId, projectDir);
});

ipcMain.handle('sessions:generate-name', async (_e, sessionId: string, projectDir: string) => {
  return sessionParser.generateSessionName(sessionId, projectDir);
});

ipcMain.handle('sessions:delete', async (_e, sessionId: string, projectDir: string) => {
  return sessionParser.deleteSession(sessionId, projectDir);
});

ipcMain.handle('sessions:delete-old', async (_e, daysOld: number) => {
  return sessionParser.deleteOldSessions(daysOld);
});

// PTY management
ipcMain.handle('pty:create', async (_e, options: { sessionId?: string; cwd?: string; name?: string }) => {
  logger.info('ipc', 'pty:create called', options);
  try {
    const id = ptyManager.create(options);
    ptyManager.onData(id, (data) => {
      mainWindow?.webContents.send(`pty:data:${id}`, data);
    });
    ptyManager.onExit(id, (exitCode) => {
      mainWindow?.webContents.send(`pty:exit:${id}`, exitCode);
    });
    return id;
  } catch (err) {
    logger.error('ipc', 'pty:create failed', { error: String(err), options });
    throw err;
  }
});

ipcMain.handle('pty:write', async (_e, id: string, data: string) => {
  ptyManager.write(id, data);
});

ipcMain.handle('pty:resize', async (_e, id: string, cols: number, rows: number) => {
  ptyManager.resize(id, cols, rows);
});

ipcMain.handle('pty:kill', async (_e, id: string) => {
  ptyManager.kill(id);
});

ipcMain.handle('pty:kill-all', async () => {
  ptyManager.killAll();
});

ipcMain.handle('pty:list', async () => {
  return ptyManager.list();
});

// State persistence
ipcMain.handle('state:save', async (_e, terminals: SavedTerminal[]) => {
  stateStore.save(terminals);
});

ipcMain.handle('state:load', async () => {
  return stateStore.load();
});

// Logging
ipcMain.handle('log:get-recent', async (_e, lines: number) => {
  return logger.getRecentLogs(lines);
});

ipcMain.handle('log:get-path', async () => {
  return logger.getLogPath();
});

// Shell
ipcMain.handle('shell:open-external', async (_e, url: string) => {
  shell.openExternal(url);
});

// App lifecycle
app.whenReady().then(createWindow);

// Renderer saves state via beforeunload → state:save IPC.
// Main process only kills PTYs and quits — does NOT overwrite saved state.
app.on('window-all-closed', () => {
  logger.info('app', 'window-all-closed, killing PTYs');
  ptyManager.killAll();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
