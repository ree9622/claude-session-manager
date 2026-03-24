# Claude Session Manager

> **Built for Claude Code power users on Windows.**
> If you're the kind of developer who runs 8+ Claude sessions simultaneously, this is for you.
> Most dev tools assume macOS or Linux. This one is Windows-first.

A desktop app for managing multiple [Claude Code](https://claude.com/claude-code) terminal sessions — grid view, bulk resume, drag & drop, and AI-powered naming. For power users who juggle dozens of Claude sessions across projects every day.

> **Windows에서 Claude Code를 8개씩 켜고 쓰는 파워 유저를 위한 앱.**
> macOS/Linux 전용 도구에 지친 Windows 개발자를 위해 만들었습니다.

---

## Why This Exists / 왜 만들었나

If you use Claude Code heavily, you know the pain:
- You have 10+ terminal sessions open across different projects
- Next morning, you can't remember which session was which
- `/resume` shows a wall of UUIDs — good luck finding the right one
- No way to see all sessions at a glance

Claude Code를 많이 쓰면 공감할 겁니다:
- 프로젝트마다 터미널 세션이 10개 이상
- 다음 날 어떤 세션이 뭔지 기억이 안 남
- `/resume` 하면 UUID 목록만 — 찾는 게 불가능
- 한눈에 보는 방법이 없음

**This app solves all of that. / 이 앱이 전부 해결합니다.**

---

## Features / 주요 기능

### Multi-View Terminal Grid / 멀티 뷰 터미널 그리드
- **Thumbnail View** — Small previews on top, focused terminal below / 상단 썸네일 + 하단 확대 뷰
- **Grid View** — Equal-sized terminals side by side / 균등 크기 그리드
- **Focus View** — Single terminal with tab switching / 탭 전환 단일 뷰

### Session Management / 세션 관리
- **Browse all sessions** — Parsed from `~/.claude/projects/`, grouped by project or time / 프로젝트별·시간별 그룹
- **Search & filter** — By name, prompt content, or project path / 이름·프롬프트·경로로 검색
- **Bulk resume** — Checkbox select → open all at once / 체크 후 일괄 열기
- **Quick open (▶)** — Hover and click to instantly resume / 호버하면 나타나는 빠른 열기
- **Duplicate prevention** — Opening an active session focuses it instead / 중복 열기 방지, 포커스 전환

### AI-Powered Naming / AI 이름 생성
- Uses `claude -p --model haiku` to analyze conversation content and generate meaningful 3-6 word names
- `claude -p --model haiku`로 대화 내용을 분석해 3~6단어 이름 자동 생성

### Persistence / 영속성
- Active terminals saved on every change, restored on next launch / 변경 시마다 자동 저장, 재실행 시 복원
- Session names cached in `~/.claude/session-names.json`

### System Tray / 시스템 트레이
- Minimize to tray — close button hides, tray click toggles / X 버튼 = 트레이로, 트레이 클릭 = 토글
- Optional start on Windows login / Windows 시작 시 자동 실행 옵션

### More / 기타
- **Drag & drop** reorder terminals in grid / 그리드 DnD 순서 변경
- **Collapsible sidebar** for maximum terminal space / 사이드바 접기
- **Session cleanup** — Delete old or individual sessions / 오래된 세션 정리
- **Debug logging** — `~/.claude/session-manager-logs/` / 디버그 로그

---

## Requirements / 요구 사항

| | |
|---|---|
| **OS** | Windows 10 / 11 |
| **Shell** | [Git for Windows](https://gitforwindows.org/) (provides Git Bash) |
| **CLI** | [Claude Code](https://claude.com/claude-code) installed and authenticated |
| **Runtime** | Node.js 18+ |

> **Note:** This app is designed specifically for Windows. macOS/Linux support may come later, but Windows-first is a deliberate choice — there are already plenty of tools for Unix environments.
>
> **참고:** 이 앱은 Windows 전용으로 설계되었습니다.

---

## Getting Started / 시작하기

```bash
git clone https://github.com/ree9622/claude-session-manager.git
cd claude-session-manager
npm install
```

### Development / 개발

```bash
npm run dev
```

### Production Build / 프로덕션 빌드

```bash
npm run build
npm start
```

### Create Installer / 설치파일 생성

```bash
npm run dist
```

---

## How It Works / 동작 원리

1. **Session Discovery** — Parses `~/.claude/projects/**/*.jsonl` to find sessions, extracting first prompt, timestamps, and `cwd` from JSONL data
2. **Terminal Emulation** — `node-pty` spawns Git Bash → `xterm.js` (WebGL) renders the output
3. **Session Resume** — Runs `claude --resume <id>` in an interactive bash shell at the correct working directory
4. **AI Naming** — Feeds first few user messages to `claude -p --model haiku` for summarization
5. **State Persistence** — Saves active terminal list to JSON on every state change (not just on exit)

---

## Tech Stack / 기술 스택

| Component | Technology |
|-----------|-----------|
| Desktop framework | Electron |
| UI | React + TypeScript |
| Terminal emulator | xterm.js (WebGL renderer) |
| PTY | node-pty |
| Build tool | Vite + electron-builder |
| Shell | Git Bash (Windows) |

---

## File Locations / 파일 위치

| File | Purpose |
|------|---------|
| `~/.claude/session-names.json` | Cached session names |
| `~/.claude/session-manager-state.json` | Active terminal state for restore |
| `~/.claude/session-manager-logs/` | Debug logs (auto-rotated at 5MB) |

---

## License

MIT

## Author / 개발자

**samko@samlab.co.kr**
