import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { PtyManager } from './pty-manager';
import { SessionParser } from './session-parser';
import { stateStore, SavedTerminal } from './state-store';
import { logger } from './logger';
import { settings } from './settings';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const ptyManager = new PtyManager();
const sessionParser = new SessionParser();

function getTrayIconPath() {
  const fs = require('fs');
  const devPath = path.join(__dirname, '../../build/tray-icon.png');
  const prodPath = path.join(process.resourcesPath, 'tray-icon.png');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function getTrayLabel(key: string): string {
  const lang = settings.get('lang');
  const labels: Record<string, Record<string, string>> = {
    showHide: { en: 'Show / Hide', ko: '보이기 / 숨기기' },
    startOnLogin: { en: 'Start on login', ko: '로그인 시 시작' },
    closeToTray: { en: 'Minimize to tray on close', ko: '닫을 때 트레이로 최소화' },
    quit: { en: 'Quit', ko: '종료' },
  };
  return labels[key]?.[lang] || labels[key]?.['en'] || key;
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
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: getTrayLabel('showHide'),
      click: () => {
        if (mainWindow?.isVisible()) mainWindow.hide();
        else { mainWindow?.show(); mainWindow?.focus(); }
      },
    },
    {
      label: getTrayLabel('closeToTray'),
      type: 'checkbox',
      checked: settings.get('closeToTray'),
      click: (menuItem) => {
        settings.set('closeToTray', menuItem.checked);
      },
    },
    {
      label: getTrayLabel('startOnLogin'),
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        settings.set('startOnLogin', menuItem.checked);
      },
    },
    { type: 'separator' },
    {
      label: getTrayLabel('quit'),
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  logger.info('app', 'Creating main window');

  const fs = require('fs');
  const iconDev = path.join(__dirname, '../../build/icon.png');
  const iconProd = path.join(process.resourcesPath, 'icon.png');
  const iconPath = fs.existsSync(iconDev) ? iconDev : (fs.existsSync(iconProd) ? iconProd : undefined);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
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

  // Close behavior based on settings
  mainWindow.on('close', (e) => {
    if (!isQuitting && settings.get('closeToTray')) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // First run: show close behavior notice
  if (settings.get('firstRun')) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('first-run');
    });
    settings.set('firstRun', false);
  }
}

// --- IPC Handlers ---

// Session management
ipcMain.handle('sessions:list', async () => sessionParser.listSessions());
ipcMain.handle('sessions:search', async (_e, q: string) => sessionParser.searchSessions(q));
ipcMain.handle('sessions:get-details', async (_e, id: string, dir: string) => sessionParser.getSessionDetails(id, dir));
ipcMain.handle('sessions:generate-name', async (_e, id: string, dir: string) => sessionParser.generateSessionName(id, dir));
ipcMain.handle('sessions:delete', async (_e, id: string, dir: string) => sessionParser.deleteSession(id, dir));
ipcMain.handle('sessions:delete-old', async (_e, days: number) => sessionParser.deleteOldSessions(days));
ipcMain.handle('sessions:toggle-favorite', async (_e, id: string) => sessionParser.toggleFavorite(id));
ipcMain.handle('sessions:toggle-hidden', async (_e, id: string) => sessionParser.toggleHidden(id));

// PTY management
ipcMain.handle('pty:create', async (_e, options: { sessionId?: string; cwd?: string; name?: string }) => {
  logger.info('ipc', 'pty:create called', options);
  try {
    const id = ptyManager.create(options);
    ptyManager.onData(id, (data) => mainWindow?.webContents.send(`pty:data:${id}`, data));
    ptyManager.onExit(id, (exitCode) => mainWindow?.webContents.send(`pty:exit:${id}`, exitCode));
    return id;
  } catch (err) {
    logger.error('ipc', 'pty:create failed', { error: String(err), options });
    throw err;
  }
});

ipcMain.handle('pty:write', async (_e, id: string, data: string) => ptyManager.write(id, data));
ipcMain.handle('pty:resize', async (_e, id: string, cols: number, rows: number) => ptyManager.resize(id, cols, rows));
ipcMain.handle('pty:kill', async (_e, id: string) => ptyManager.kill(id));
ipcMain.handle('pty:kill-all', async () => ptyManager.killAll());
ipcMain.handle('pty:list', async () => ptyManager.list());

// State persistence
ipcMain.handle('state:save', async (_e, terminals: SavedTerminal[]) => stateStore.save(terminals));
ipcMain.handle('state:load', async () => stateStore.load());

// Settings
ipcMain.handle('settings:get', async (_e, key: string) => settings.get(key as any));
ipcMain.handle('settings:set', async (_e, key: string, value: any) => {
  settings.set(key as any, value);
  if (key === 'lang') updateTrayMenu();
});

// Logging
ipcMain.handle('log:get-recent', async (_e, lines: number) => logger.getRecentLogs(lines));
ipcMain.handle('log:get-path', async () => logger.getLogPath());

// Shell & Dialog
ipcMain.handle('shell:open-external', async (_e, url: string) => shell.openExternal(url));
ipcMain.handle('dialog:open-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select working directory',
  });
  return result.canceled ? null : result.filePaths[0];
});

// Auto-updater
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => logger.info('updater', 'Checking...'));
  autoUpdater.on('update-available', (info) => {
    logger.info('updater', `Available: v${info.version}`);
    mainWindow?.webContents.send('updater:status', { type: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => logger.info('updater', 'Up to date'));
  autoUpdater.on('download-progress', (p) => {
    mainWindow?.webContents.send('updater:status', { type: 'progress', percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updater', `Downloaded: v${info.version}`);
    mainWindow?.webContents.send('updater:status', { type: 'ready', version: info.version });
  });
  autoUpdater.on('error', (err) => logger.error('updater', 'Error', String(err)));

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 30 * 60 * 1000);
}

ipcMain.handle('updater:install', async () => autoUpdater.quitAndInstall());

// Single instance lock — prevent multiple app windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to open a second instance — focus existing window
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupAutoUpdater();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    logger.info('app', 'before-quit');
    ptyManager.killAll();
  });

  app.on('window-all-closed', () => {
    // If closeToTray is off, quit the app
    if (!settings.get('closeToTray')) {
      isQuitting = true;
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) createWindow();
    else mainWindow.show();
  });
}
