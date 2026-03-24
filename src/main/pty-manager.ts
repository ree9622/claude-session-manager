import * as pty from 'node-pty';
import crypto from 'crypto';
import os from 'os';

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

  create(options: { sessionId?: string; cwd?: string; name?: string }): string {
    const id = crypto.randomUUID() as string;
    const cwd = options.cwd || os.homedir();
    // Use bash (Git Bash on Windows) since claude runs in bash
    const shell = process.platform === 'win32'
      ? 'C:\\Program Files\\Git\\bin\\bash.exe'
      : 'bash';

    // Build the claude command
    let args: string[] = [];
    if (options.sessionId) {
      args = ['--login', '-c', `claude --resume ${options.sessionId}`];
    } else {
      const nameArg = options.name ? ` --name "${options.name}"` : '';
      args = ['--login', '-c', `claude${nameArg}`];
    }

    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });

    const instance: PtyInstance = {
      id,
      process: ptyProcess,
      name: options.name || `Session ${this.instances.size + 1}`,
      sessionId: options.sessionId,
      cwd,
      createdAt: Date.now(),
      status: 'running',
    };

    ptyProcess.onExit(() => {
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
      instance.process.kill();
      instance.status = 'exited';
    }
    this.instances.delete(id);
  }

  killAll() {
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
