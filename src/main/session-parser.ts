import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { spawn } from 'child_process';
import { logger } from './logger';

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
}

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const NAMES_FILE = path.join(CLAUDE_DIR, 'session-names.json');
const META_FILE = path.join(CLAUDE_DIR, 'session-meta.json');

interface SessionMeta { favorite?: boolean; hidden?: boolean; }

export class SessionParser {
  private namesCache: Record<string, string> = {};
  private metaCache: Record<string, SessionMeta> = {};

  constructor() {
    this.loadNames();
    this.loadMeta();
  }

  private loadNames() {
    try {
      if (fs.existsSync(NAMES_FILE)) {
        this.namesCache = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
      }
    } catch {
      this.namesCache = {};
    }
  }

  private loadMeta() {
    try {
      if (fs.existsSync(META_FILE)) {
        this.metaCache = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      }
    } catch {
      this.metaCache = {};
    }
  }

  private saveMeta() {
    fs.writeFileSync(META_FILE, JSON.stringify(this.metaCache, null, 2));
  }

  toggleFavorite(sessionId: string): boolean {
    const current = this.metaCache[sessionId]?.favorite || false;
    if (!this.metaCache[sessionId]) this.metaCache[sessionId] = {};
    this.metaCache[sessionId].favorite = !current;
    this.saveMeta();
    return !current;
  }

  toggleHidden(sessionId: string): boolean {
    const current = this.metaCache[sessionId]?.hidden || false;
    if (!this.metaCache[sessionId]) this.metaCache[sessionId] = {};
    this.metaCache[sessionId].hidden = !current;
    this.saveMeta();
    return !current;
  }

  private saveNames() {
    fs.writeFileSync(NAMES_FILE, JSON.stringify(this.namesCache, null, 2));
  }

  private projectDirToPath(dirName: string): string {
    // C--Users-ko-Desktop → C:\Users\ko\Desktop
    return dirName.replace(/^([A-Z])--/, '$1:\\').replace(/--/g, '\\');
  }

  private projectDirToName(dirName: string): string {
    const fullPath = this.projectDirToPath(dirName);
    const parts = fullPath.split('\\');
    // Return last 2 segments for readability
    return parts.slice(-2).join('/');
  }

  async listSessions(): Promise<SessionInfo[]> {
    // Reload from disk — picks up names/meta changed by running sessions
    this.loadNames();
    this.loadMeta();

    if (!fs.existsSync(PROJECTS_DIR)) return [];

    const projectDirs = fs.readdirSync(PROJECTS_DIR);

    // Collect all parse tasks
    const tasks: Promise<SessionInfo | null>[] = [];

    for (const projectDir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue;
      } catch { continue; }

      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectPath, file);

        tasks.push(
          this.parseSessionQuick(filePath, sessionId, projectDir)
            .then(info => {
              if (info) {
                info.name = this.namesCache[sessionId];
                const meta = this.metaCache[sessionId];
                if (meta) {
                  info.favorite = meta.favorite;
                  info.hidden = meta.hidden;
                }
              }
              return info;
            })
            .catch(() => null)
        );
      }
    }

    // Parse all sessions in parallel
    const results = await Promise.all(tasks);
    const sessions = results.filter((s): s is SessionInfo => s !== null);

    sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    return sessions;
  }

  private async parseSessionQuick(
    filePath: string,
    sessionId: string,
    projectDir: string
  ): Promise<SessionInfo | null> {
    const stat = fs.statSync(filePath);

    // Read first few lines to get first user prompt
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    let firstPrompt = '';
    let cwd = '';
    let messageCount = 0;

    for await (const line of rl) {
      try {
        const msg = JSON.parse(line);
        messageCount++;

        // Extract actual cwd from first message that has it
        if (!cwd && msg.cwd) {
          cwd = msg.cwd;
        }

        if (msg.type === 'user' && !firstPrompt && msg.message?.content) {
          const content = msg.message.content;
          if (typeof content === 'string') {
            firstPrompt = content.slice(0, 200);
          } else if (Array.isArray(content)) {
            const textBlock = content.find((b: any) => b.type === 'text');
            if (textBlock) firstPrompt = textBlock.text.slice(0, 200);
          }
        }

        // Only parse first 50 lines for speed
        if (messageCount > 50) break;
      } catch {
        // Skip unparseable lines
      }
    }

    rl.close();
    stream.destroy();

    return {
      id: sessionId,
      projectDir,
      projectName: this.projectDirToName(projectDir),
      cwd: cwd || this.projectDirToPath(projectDir),
      firstPrompt: firstPrompt || '(세션 데이터 없음)',
      lastActivity: stat.mtimeMs,
      messageCount,
    };
  }

  async searchSessions(query: string): Promise<SessionInfo[]> {
    const all = await this.listSessions();
    const q = query.toLowerCase();
    return all.filter(s =>
      s.firstPrompt.toLowerCase().includes(q) ||
      s.projectName.toLowerCase().includes(q) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      s.id.includes(q)
    );
  }

  async getSessionDetails(sessionId: string, projectDir: string) {
    const filePath = path.join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) return null;

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    const messages: Array<{ type: string; content: string; timestamp?: string }> = [];

    for await (const line of rl) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'user' && msg.message?.content) {
          const content = typeof msg.message.content === 'string'
            ? msg.message.content
            : msg.message.content.find((b: any) => b.type === 'text')?.text || '';
          messages.push({ type: 'user', content: content.slice(0, 500), timestamp: msg.timestamp });
        } else if (msg.type === 'assistant' && msg.message?.content) {
          const content = typeof msg.message.content === 'string'
            ? msg.message.content
            : msg.message.content
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join('\n')
                .slice(0, 500);
          if (content) {
            messages.push({ type: 'assistant', content, timestamp: msg.timestamp });
          }
        }
      } catch {}
    }

    rl.close();
    stream.destroy();

    return {
      id: sessionId,
      projectDir,
      messages: messages.slice(0, 20), // First 20 message pairs
    };
  }

  async generateSessionName(sessionId: string, projectDir: string): Promise<string> {
    const details = await this.getSessionDetails(sessionId, projectDir);
    if (!details || details.messages.length === 0) return 'Empty Session';

    const userMessages = details.messages
      .filter(m => m.type === 'user')
      .slice(0, 5)
      .map(m => m.content)
      .join('\n')
      .slice(0, 1000);

    const prompt = `세션 이름을 한 줄로 생성. 반드시 아래 포맷만 출력하고 다른 텍스트는 절대 붙이지 마.

포맷: [태그] 요약 (최대 40자)
태그: 버그수정/기능/개선/배포/인프라/CS/분석/설정/기타
이슈ID(CLASUP-xxx 등)가 있으면 태그 뒤에 포함.

예시:
[기능] 결제 모듈 리팩토링
[버그수정] CLASUP-978 키오스크 이중결제
[배포] v1.32 프로덕션 배포

대화 내용:
${userMessages}`;

    try {
      const raw = await this.callClaude(prompt);
      // Strip markdown, quotes, take first line only
      const cleaned = raw
        .split('\n')[0]
        .replace(/\*+/g, '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/^#+\s*/, '')
        .trim()
        .slice(0, 50);
      if (cleaned) {
        this.namesCache[sessionId] = cleaned;
        this.saveNames();
        logger.info('session', `Generated name: "${cleaned}" for ${sessionId.slice(0, 8)}`);
        return cleaned;
      }
    } catch (err) {
      logger.error('session', 'claude -p failed, using fallback', String(err));
    }

    // Fallback: simple extraction
    const fallback = userMessages
      .replace(/```[\s\S]*?```/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
    const name = fallback || 'Unnamed Session';
    this.namesCache[sessionId] = name;
    this.saveNames();
    return name;
  }

  private callClaude(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['-p', '--model', 'haiku', '--no-session-persistence'], {
        timeout: 30000,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`claude exit ${code}: ${stderr}`));
        resolve(stdout.trim());
      });
      proc.on('error', reject);

      // Send prompt via stdin
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  findProjectDir(sessionId: string): string | null {
    if (!fs.existsSync(PROJECTS_DIR)) return null;
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      if (fs.existsSync(path.join(PROJECTS_DIR, dir, `${sessionId}.jsonl`))) return dir;
    }
    return null;
  }

  async nameUnnamedSessions(
    sessionIds: string[],
    onProgress?: (done: number, total: number, name: string) => void,
    force = false,
  ): Promise<number> {
    this.loadNames();
    const targets = force ? sessionIds : sessionIds.filter(id => !this.namesCache[id]);
    if (targets.length === 0) return 0;

    const total = targets.length;
    logger.info('session', `Naming ${total} sessions (force=${force})...`);

    let named = 0;
    for (const sessionId of targets) {
      const projectDir = this.findProjectDir(sessionId);
      if (!projectDir) { named++; onProgress?.(named, total, ''); continue; }

      try {
        const name = await this.generateSessionName(sessionId, projectDir);
        named++;
        onProgress?.(named, total, name);
      } catch (err) {
        logger.error('session', `Failed to name ${sessionId.slice(0, 8)}`, err);
        named++;
        onProgress?.(named, total, '');
      }
    }

    logger.info('session', `Named ${named}/${total} sessions`);
    return named;
  }

  setSessionName(sessionId: string, name: string) {
    this.namesCache[sessionId] = name;
    this.saveNames();
  }

  async deleteSession(sessionId: string, projectDir: string): Promise<boolean> {
    const filePath = path.join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) return false;

    fs.unlinkSync(filePath);

    // Also remove the session directory if it exists (subagents, tool-results)
    const sessionDir = path.join(PROJECTS_DIR, projectDir, sessionId);
    if (fs.existsSync(sessionDir) && fs.statSync(sessionDir).isDirectory()) {
      fs.rmSync(sessionDir, { recursive: true });
    }

    // Remove from names cache
    delete this.namesCache[sessionId];
    this.saveNames();

    return true;
  }

  async deleteOldSessions(daysOld: number): Promise<number> {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deleted = 0;

    if (!fs.existsSync(PROJECTS_DIR)) return 0;

    const projectDirs = fs.readdirSync(PROJECTS_DIR);
    for (const projectDir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      if (!fs.statSync(projectPath).isDirectory()) continue;

      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    }

    return deleted;
  }
}
