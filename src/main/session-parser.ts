import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execFile } from 'child_process';
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
}

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const NAMES_FILE = path.join(CLAUDE_DIR, 'session-names.json');

export class SessionParser {
  private namesCache: Record<string, string> = {};

  constructor() {
    this.loadNames();
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
    const sessions: SessionInfo[] = [];

    if (!fs.existsSync(PROJECTS_DIR)) return sessions;

    const projectDirs = fs.readdirSync(PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      if (!fs.statSync(projectPath).isDirectory()) continue;

      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectPath, file);
        const stat = fs.statSync(filePath);

        try {
          const info = await this.parseSessionQuick(filePath, sessionId, projectDir);
          if (info) {
            info.name = this.namesCache[sessionId];
            sessions.push(info);
          }
        } catch {
          // Skip corrupt files
        }
      }
    }

    // Sort by last activity (newest first)
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

    const prompt = `아래 대화 내용을 보고 이 세션의 이름을 한국어 3~6단어로 지어줘. 이름만 출력하고 다른 설명은 붙이지 마.\n\n${userMessages}`;

    try {
      const name = await this.callClaude(prompt);
      const cleaned = name.trim().replace(/^["']|["']$/g, '').slice(0, 50);
      if (cleaned) {
        this.namesCache[sessionId] = cleaned;
        this.saveNames();
        logger.info('session', `Generated name: "${cleaned}" for ${sessionId.slice(0, 8)}`);
        return cleaned;
      }
    } catch (err) {
      logger.error('session', 'claude -p failed, using fallback', err);
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
      const claude = execFile('claude', ['-p', '--model', 'haiku', prompt], {
        timeout: 15000,
        env: { ...process.env },
      }, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    });
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
