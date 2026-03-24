import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_DIR = path.join(os.homedir(), '.claude', 'session-manager-logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${date}.log`);
}

function rotateIfNeeded(filePath: string) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_LOG_SIZE) {
      fs.renameSync(filePath, filePath.replace('.log', `-${Date.now()}.log`));
    }
  } catch {}
}

function formatMessage(level: string, context: string, message: string, data?: any): string {
  const ts = new Date().toISOString();
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  return `[${ts}] [${level}] [${context}] ${message}${dataStr}\n`;
}

export const logger = {
  info(context: string, message: string, data?: any) {
    ensureDir();
    const file = getLogFile();
    rotateIfNeeded(file);
    fs.appendFileSync(file, formatMessage('INFO', context, message, data));
  },

  error(context: string, message: string, data?: any) {
    ensureDir();
    const file = getLogFile();
    rotateIfNeeded(file);
    fs.appendFileSync(file, formatMessage('ERROR', context, message, data));
    console.error(`[${context}] ${message}`, data || '');
  },

  warn(context: string, message: string, data?: any) {
    ensureDir();
    const file = getLogFile();
    rotateIfNeeded(file);
    fs.appendFileSync(file, formatMessage('WARN', context, message, data));
  },

  getLogPath(): string {
    return getLogFile();
  },

  getRecentLogs(lines: number = 100): string {
    const file = getLogFile();
    if (!fs.existsSync(file)) return '(로그 없음)';
    const content = fs.readFileSync(file, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines).join('\n');
  },
};
