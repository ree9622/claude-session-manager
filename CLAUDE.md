# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Windows-first Electron desktop app for managing multiple Claude Code terminal sessions. Grid view, bulk resume, drag & drop, AI-powered session naming. Targets power users running 8+ simultaneous Claude sessions.

## Commands

```bash
npm run dev          # Dev mode (concurrent main + renderer with HMR)
npm run dev:main     # Watch-compile main process only (tsc)
npm run dev:renderer # Vite dev server for renderer only
npm run build        # Production build (tsc + vite build)
npm start            # Launch Electron app
npm run dist         # Create Windows NSIS installer
```

No test framework is configured. No linter is configured.

## Architecture

**Electron app with two processes:**

- **Main process** (`src/main/`) — Node.js: IPC handlers, window/tray management, PTY spawning, session discovery, auto-updater
- **Renderer process** (`src/renderer/`) — React 18 + TypeScript: UI components, terminal rendering via xterm.js (WebGL)

**IPC bridge:** `src/main/preload.ts` exposes `window.api` via `contextBridge`. All main↔renderer communication goes through typed IPC channels (`sessions:*`, `pty:*`, `state:*`, `settings:*`).

### Main Process Modules

| Module | Responsibility |
|--------|---------------|
| `index.ts` | Entry point, IPC handler registration, BrowserWindow/tray, auto-updater, file watchers |
| `pty-manager.ts` | Spawns Git Bash via `node-pty`, sends `claude --resume <id>` commands, process tree cleanup with `taskkill /T /F` |
| `session-parser.ts` | Discovers sessions from `~/.claude/projects/**/*.jsonl`, parses JSONL for metadata, AI naming via `claude -p --model sonnet` |
| `state-store.ts` | Persists active terminals to `~/.claude/session-manager-state.json` |
| `settings.ts` | User prefs (lang, closeToTray, startOnLogin) in `~/.claude/session-manager-settings.json` |
| `logger.ts` | File logging to `~/.claude/session-manager-logs/`, auto-rotated at 5MB |

### Renderer Components

| Component | Responsibility |
|-----------|---------------|
| `App.tsx` | Root state management, session/terminal lifecycle, quit-naming overlay |
| `Sidebar.tsx` | Session list with search, sort, grouping, bulk select, favorites |
| `TerminalGrid.tsx` | Three view modes: thumbnail (preview+focus), grid (equal), focus (tabs) |
| `TerminalView.tsx` | xterm.js wrapper with WebGL addon, FitAddon, right-click paste |
| `Toolbar.tsx` | View switcher, terminal count, bulk actions, language toggle |
| `NewSessionModal.tsx` | Directory picker + optional name for new sessions |

### Key Data Flow

1. **Session discovery:** Main scans `~/.claude/projects/` → parses first 50 lines of `.jsonl` → returns `SessionInfo[]` to renderer
2. **Terminal creation:** Renderer requests `pty:create` → Main spawns Git Bash + `claude --resume <id>` → data streams via `pty:data:<id>` channel
3. **State persistence:** Every terminal add/remove triggers `state:save` → restored on next launch via `state:load`
4. **AI naming:** Extracts first 5 user messages → pipes to `claude -p --model sonnet --no-session-persistence` → caches in `session-names.json`

### Build Tooling

- **Vite** bundles renderer (HMR in dev) + main process via `vite-plugin-electron`
- **TypeScript** — two configs: `tsconfig.json` (renderer, ESNext) and `tsconfig.main.json` (main, CommonJS → `dist/main/`)
- **electron-builder** creates NSIS installer, publishes to GitHub Releases
- `node-pty` and `electron-updater` are external (not bundled by Vite)
- Path alias: `@` → `src/renderer/`

## Windows-First Design

- Shell: Git Bash (`C:\Program Files\Git\bin\bash.exe`)
- Process cleanup: `taskkill /T /F /PID` for process tree kill
- Single-instance lock via `app.requestSingleInstanceLock()`
- System tray with close-to-tray behavior
- Auto-launch via `app.setLoginItemSettings()`

## i18n

Bilingual (EN/KO) via `src/renderer/i18n.ts`. 100+ translation keys, language stored in localStorage and settings.

## Styling

All CSS in `src/renderer/styles/global.css` — dark theme with purple accent (`#7c6bf5`). No CSS framework.

## PTY↔Session Lifecycle Rules

- **`watchForNewSession()`은 PTY가 살아있는 동안 계속 감시한다.** 초기 감지 후 종료하지 않음. Claude Code의 `/clear`가 새 세션 ID를 생성하므로, 동일 PTY에서 sessionId가 여러 번 바뀔 수 있다.
- **`pty:session-detected` 이벤트는 `oldSessionId`를 포함한다.** Renderer는 기존 sessionId가 있어도 교체해야 하며, `!t.sessionId` 같은 가드를 넣지 말 것.
- **세션 파일 감지는 `knownFiles` 스냅샷 기반이다.** 새 `.jsonl`이 나타나면 감지하고, 감지된 파일은 `knownFiles`에 추가해서 다음 변경도 추적.
