import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { PtyManager } from './pty-manager';
import { SessionParser } from './session-parser';
import { stateStore, SavedTerminal } from './state-store';
import { logger } from './logger';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const ptyManager = new PtyManager();
const sessionParser = new SessionParser();

function getTrayIconPath() {
  const iconName = process.platform === 'win32' ? 'tray-icon.png' : 'tray-icon.png';
  // In dev, use build/; in production, use resources/
  const devPath = path.join(__dirname, '../../build', iconName);
  const prodPath = path.join(process.resourcesPath, iconName);
  const fs = require('fs');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function createTray() {
  const iconPath = getTrayIconPath();
  const fs = require('fs');

  if (!fs.existsSync(iconPath)) {
    logger.warn('tray', `Tray icon not found: ${iconPath}`);
    return;
  }

  tray = new Tray(iconPath);
  tray.setToolTip('Claude Session Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
    },
    {
      label: 'Start on Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        logger.info('tray', `Start on login: ${menuItem.checked}`);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

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

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

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
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
  logger.info('app', 'before-quit, killing PTYs');
  ptyManager.killAll();
});

app.on('window-all-closed', () => {
  // On Windows, don't quit when window closes (tray keeps it alive)
  // Only quit when isQuitting is true (from tray → Quit)
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
