import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import os from 'os';
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

  // Watch session-names.json — auto-refresh sidebar when /name-session skill writes to it
  const namesFile = path.join(os.homedir(), '.claude', 'session-names.json');
  let namesDebounce: NodeJS.Timeout | null = null;
  const namesWatcher = fs.watch(namesFile, { persistent: false }, () => {
    if (namesDebounce) clearTimeout(namesDebounce);
    namesDebounce = setTimeout(() => {
      logger.info('watcher', 'session-names.json changed, notifying renderer');
      mainWindow?.webContents.send('names:changed');
    }, 500);
  });
  mainWindow.on('closed', () => namesWatcher.close());

  // Close behavior: naming + tray/quit
  mainWindow.on('close', (e) => {
    if (isQuitting) return; // Already in quit flow, let it close

    e.preventDefault();

    if (settings.get('closeToTray')) {
      mainWindow?.hide();
      return;
    }

    // closeToTray=false → trigger quit (naming handled in before-quit)
    isQuitting = true;
    app.quit();
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
ipcMain.handle('sessions:toggle-pinned', async (_e, id: string) => sessionParser.togglePinned(id));
ipcMain.handle('sessions:list-pinned', async () => sessionParser.listPinned());
ipcMain.handle('sessions:name-active', async (_e, sessionIds: string[]) => {
  logger.info('ipc', `sessions:name-active called, ${sessionIds.length} sessions`);
  mainWindow?.webContents.send('naming:start', { total: sessionIds.length, reason: 'manual' });
  try {
    const nameMap = await sessionParser.nameUnnamedSessions(sessionIds, (done, total, name) => {
      mainWindow?.webContents.send('naming:progress', { done, total, name });
    }, true);
    logger.info('ipc', `sessions:name-active done, ${Object.keys(nameMap).length} named`);
    mainWindow?.webContents.send('naming:done');
    return nameMap;
  } catch (err) {
    logger.error('ipc', 'sessions:name-active failed', String(err));
    mainWindow?.webContents.send('naming:done');
    return {};
  }
});

// PTY management — session ID detection for new sessions
function cwdToProjectDir(cwd: string): string {
  const normalized = cwd.replace(/\//g, '\\');
  return normalized.replace(':\\', '--').replace(/\\/g, '-');
}

function watchForNewSession(ptyId: string, cwd: string) {
  const projectDir = cwdToProjectDir(cwd);
  const projectPath = path.join(os.homedir(), '.claude', 'projects', projectDir);

  // Snapshot existing files — used to detect NEW session files
  let knownFiles: Set<string>;
  try {
    knownFiles = new Set(
      fs.existsSync(projectPath)
        ? fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))
        : []
    );
  } catch {
    knownFiles = new Set();
  }

  // Track whether initial detection resolved (for new sessions without sessionId)
  const inst = ptyManager.list().find(i => i.id === ptyId);
  let initialResolved = !!inst?.sessionId; // Already has sessionId = initial detection done

  function tryDetect() {
    try {
      if (!fs.existsSync(projectPath)) return;
      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        if (!knownFiles.has(f)) {
          // New session file detected
          const sessionId = f.replace('.jsonl', '');
          const currentInst = ptyManager.list().find(i => i.id === ptyId);
          if (!currentInst || currentInst.status === 'exited') return;

          // Skip if this PTY already has this sessionId
          if (currentInst.sessionId === sessionId) {
            knownFiles.add(f);
            continue;
          }

          const oldSessionId = currentInst.sessionId;
          ptyManager.setSessionId(ptyId, sessionId);
          mainWindow?.webContents.send('pty:session-detected', { ptyId, sessionId, oldSessionId });
          logger.info('detect', `Session ${oldSessionId ? 'changed' : 'detected'}: ${sessionId.slice(0, 8)} for PTY ${ptyId.slice(0, 8)}${oldSessionId ? ` (was ${oldSessionId.slice(0, 8)})` : ''}`);

          // Add to known files so we detect NEXT change (e.g., another /clear)
          knownFiles.add(f);
          initialResolved = true;
          return;
        }
      }
    } catch {}
  }

  // Poll every 2s — keeps running to detect /clear session changes
  const pollInterval = setInterval(tryDetect, 2000);

  // fs.watch as secondary (faster detection)
  let watcher: fs.FSWatcher | null = null;
  try {
    if (fs.existsSync(projectPath)) {
      watcher = fs.watch(projectPath, { persistent: false }, () => tryDetect());
    }
  } catch {}

  // Clean up when PTY exits
  const exitCheck = setInterval(() => {
    const inst = ptyManager.list().find(i => i.id === ptyId);
    if (!inst || inst.status === 'exited') {
      tryDetect();
      cleanup();
    }
  }, 5000);

  function cleanup() {
    clearInterval(pollInterval);
    clearInterval(exitCheck);
    try { watcher?.close(); } catch {}
  }

  // Initial check after a delay
  setTimeout(tryDetect, 1000);
}

ipcMain.handle('pty:create', async (_e, options: { sessionId?: string; cwd?: string; name?: string }) => {
  logger.info('ipc', 'pty:create called', options);
  try {
    const id = ptyManager.create(options);
    ptyManager.onData(id, (data) => mainWindow?.webContents.send(`pty:data:${id}`, data));
    ptyManager.onExit(id, (exitCode) => mainWindow?.webContents.send(`pty:exit:${id}`, exitCode));

    // Watch for session file creation (new sessions and /clear which creates a new session)
    if (options.cwd) {
      watchForNewSession(id, options.cwd);
    }

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
ipcMain.handle('settings:get-all', async () => settings.load());
ipcMain.handle('settings:set', async (_e, key: string, value: any) => {
  settings.set(key as any, value);
  if (key === 'lang') updateTrayMenu();
  mainWindow?.webContents.send('settings:changed', { key, value });
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
  app.exit(0); // exit(), not quit() — skip before-quit to avoid hang
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

  let quitPhase: 'idle' | 'naming' | 'ready' = 'idle';

  function forceQuit() {
    logger.info('app', 'Force quitting');
    mainWindow?.webContents.send('naming:done');
    ptyManager.killAll();
    quitPhase = 'ready';
    app.quit();
  }

  app.on('before-quit', (e) => {
    isQuitting = true;

    if (quitPhase === 'ready') {
      ptyManager.killAll();
      return;
    }

    if (quitPhase === 'naming') {
      e.preventDefault();
      return;
    }

    // First quit attempt — check for unnamed sessions
    e.preventDefault();
    quitPhase = 'naming';

    // Last-chance detection: try to find session IDs for PTYs that haven't been detected yet
    const instances = ptyManager.list();
    for (const inst of instances) {
      if (!inst.sessionId && inst.cwd && inst.status === 'running') {
        try {
          const projDir = cwdToProjectDir(inst.cwd);
          const projPath = path.join(os.homedir(), '.claude', 'projects', projDir);
          if (fs.existsSync(projPath)) {
            const files = fs.readdirSync(projPath)
              .filter(f => f.endsWith('.jsonl'))
              .map(f => ({ name: f, mtime: fs.statSync(path.join(projPath, f)).mtimeMs }))
              .sort((a, b) => b.mtime - a.mtime);
            // Use the most recently modified session file as best guess
            if (files.length > 0) {
              const sessionId = files[0].name.replace('.jsonl', '');
              ptyManager.setSessionId(inst.id, sessionId);
              mainWindow?.webContents.send('pty:session-detected', { ptyId: inst.id, sessionId });
              logger.info('app', `Last-chance detection: ${sessionId.slice(0, 8)} for PTY ${inst.id.slice(0, 8)}`);
            }
          }
        } catch (err) {
          logger.error('app', `Last-chance detection failed for PTY ${inst.id.slice(0, 8)}`, String(err));
        }
      }
    }

    // Re-read instances after detection
    const updatedInstances = ptyManager.list();
    const sessionIds = updatedInstances
      .filter(i => i.sessionId && i.status === 'running')
      .map(i => i.sessionId!);

    if (sessionIds.length === 0) {
      forceQuit();
      return;
    }

    // Show window with naming overlay
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.webContents.send('naming:start', { total: sessionIds.length, reason: 'quit' });
    }

    logger.info('app', `Naming ${sessionIds.length} sessions before quit...`);

    const timeout = setTimeout(() => {
      logger.warn('app', 'Naming timeout (30s), force quitting');
      forceQuit();
    }, 30000);

    sessionParser.nameUnnamedSessions(sessionIds, (done, total, name) => {
      mainWindow?.webContents.send('naming:progress', { done, total, name });
    })
      .catch(err => logger.error('app', 'Session naming failed', String(err)))
      .finally(() => {
        clearTimeout(timeout);
        // Safety net: merge any PTY sessions the renderer missed into saved state
        const finalInstances = ptyManager.list().filter(i => i.sessionId);
        const existingState = stateStore.load();
        const existingIds = new Set(existingState.map(s => s.sessionId));
        const missing = finalInstances.filter(i => !existingIds.has(i.sessionId));
        if (missing.length > 0) {
          const merged = [
            ...existingState,
            ...missing.map(i => ({ sessionId: i.sessionId, name: i.name, cwd: i.cwd })),
          ];
          stateStore.save(merged);
          logger.info('app', `Added ${missing.length} missing sessions to state before quit`);
        }
        forceQuit();
      });
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
