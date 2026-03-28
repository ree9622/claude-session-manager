import * as pty from 'node-pty';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { logger } from './logger';

interface PtyInstance {
  id: string;
  process: pty.IPty;
  name: string;
  sessionId?: string;
  cwd: string;
  createdAt: number;
  status: 'running' | 'exited';
}

export class PtyManager {
  private instances = new Map<string, PtyInstance>();

  create(options: { sessionId?: string; cwd?: string; name?: string; resume?: boolean }): string {
    const id = crypto.randomUUID() as string;
    const cwd = options.cwd || os.homedir();

    // Validate cwd exists
    if (!fs.existsSync(cwd)) {
      logger.error('pty', `cwd does not exist: ${cwd}, falling back to homedir`);
    }
    const safeCwd = fs.existsSync(cwd) ? cwd : os.homedir();

    const shell = process.platform === 'win32'
      ? 'C:\\Program Files\\Git\\bin\\bash.exe'
      : 'bash';

    logger.info('pty', 'Creating PTY', {
      id: id.slice(0, 8),
      sessionId: options.sessionId?.slice(0, 8),
      cwd: safeCwd,
      shell,
    });

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, ['--login', '-i'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: safeCwd,
        env: { ...process.env } as Record<string, string>,
      });
    } catch (err) {
      logger.error('pty', 'Failed to spawn PTY', { error: String(err), cwd: safeCwd, shell });
      throw err;
    }

    logger.info('pty', `PTY spawned, pid=${ptyProcess.pid}`);

    // Build claude command
    let cmd: string;
    if (options.sessionId) {
      cmd = `claude --resume ${options.sessionId}`;
    } else if (options.resume) {
      cmd = `claude --continue`;
    } else {
      const nameArg = options.name ? ` --name "${options.name}"` : '';
      cmd = `claude${nameArg}`;
    }

    // Wait for shell to be ready by detecting first output (prompt),
    // instead of a fixed timeout which can miss slow shell init
    let cmdSent = false;
    const readyDisposable = ptyProcess.onData(() => {
      if (!cmdSent) {
        cmdSent = true;
        readyDisposable.dispose();
        setTimeout(() => {
          logger.info('pty', `Shell ready, sending: ${cmd}`);
          ptyProcess.write(`${cmd}\r`);
        }, 100);
      }
    });

    // Safety fallback
    setTimeout(() => {
      if (!cmdSent) {
        cmdSent = true;
        readyDisposable.dispose();
        logger.warn('pty', `Shell ready timeout (5s), forcing: ${cmd}`);
        ptyProcess.write(`${cmd}\r`);
      }
    }, 5000);

    const instance: PtyInstance = {
      id,
      process: ptyProcess,
      name: options.name || `Session ${this.instances.size + 1}`,
      sessionId: options.sessionId,
      cwd: safeCwd,
      createdAt: Date.now(),
      status: 'running',
    };

    ptyProcess.onExit(({ exitCode }) => {
      logger.info('pty', `PTY exited`, { id: id.slice(0, 8), exitCode });
      instance.status = 'exited';
    });

    this.instances.set(id, instance);
    return id;
  }

  write(id: string, data: string) {
    const instance = this.instances.get(id);
    if (instance && instance.status === 'running') {
      instance.process.write(data);
    }
  }

  resize(id: string, cols: number, rows: number) {
    const instance = this.instances.get(id);
    if (instance && instance.status === 'running') {
      instance.process.resize(cols, rows);
    }
  }

  onData(id: string, callback: (data: string) => void) {
    const instance = this.instances.get(id);
    if (instance) {
      instance.process.onData(callback);
    }
  }

  onExit(id: string, callback: (exitCode: number) => void) {
    const instance = this.instances.get(id);
    if (instance) {
      instance.process.onExit(({ exitCode }) => callback(exitCode));
    }
  }

  kill(id: string) {
    const instance = this.instances.get(id);
    if (instance && instance.status === 'running') {
      const pid = instance.process.pid;
      logger.info('pty', `Killing PTY`, { id: id.slice(0, 8), pid });

      // On Windows, pty.kill() only kills the shell, not child processes (claude, node, etc.)
      // Kill the entire process tree via taskkill /T
      if (process.platform === 'win32' && pid) {
        try {
          execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
        } catch {
          // Process may already be dead
        }
      } else {
        instance.process.kill();
      }
      instance.status = 'exited';
    }
    this.instances.delete(id);
  }

  killAll() {
    logger.info('pty', `Killing all ${this.instances.size} PTY instances`);
    for (const [id] of this.instances) {
      this.kill(id);
    }
  }

  list() {
    return Array.from(this.instances.values()).map(({ id, name, sessionId, cwd, createdAt, status }) => ({
      id, name, sessionId, cwd, createdAt, status,
    }));
  }
}
